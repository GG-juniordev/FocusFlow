import { DEFAULT_CATEGORIES } from '@shared/defaults'
import { defaultToolLibrary } from '@shared/tools'
import type { CloudState } from '@shared/types'
import type { Controller } from '../controller'
import {
  SETTINGS_ID,
  TABLES,
  ackPush,
  clearAccountData,
  collectPush,
  markAllDirty,
  mergePulled,
  pendingCount,
  resetStamps,
  tidy,
  trackChange,
  unlink,
  type Remote,
  type SyncMeta
} from './core'

export interface SyncUser {
  id: string
  email: string | null
}

/** Raised by a Remote so the UI can say something useful. */
export class SyncError extends Error {
  constructor(
    readonly kind: 'network' | 'schema' | 'auth' | 'server',
    message: string
  ) {
    super(message)
  }
}

interface Options {
  configured: boolean
  /** Turn off timers; tests drive sync by calling syncNow(). */
  manual?: boolean
}

const CHANGE_DELAY_MS = 1_500
const POLL_MS = 60_000
const RETRY_MS = 30_000

/**
 * Keeps this PC's data and a cloud account in step.
 *
 * The app always reads and writes local data first. This engine watches those
 * changes, queues them (the queue is saved to disk), and in the background
 * pulls remote changes, merges them, and uploads the queue. If the cloud cannot
 * be reached the queue simply waits and is retried.
 */
export class SyncEngine {
  private user: SyncUser | null = null
  private remote: Remote | null = null
  private phase: CloudState['phase'] = 'local'
  private error: string | null = null
  private running: Promise<void> | null = null
  private again = false
  /** Bumped whenever the account changes, so a cycle in flight for the old one stops. */
  private epoch = 0
  /** After "keep cloud only": add defaults for anything the account turned out not to have. */
  private seedMissing = false
  private timer: NodeJS.Timeout | null = null
  private poll: NodeJS.Timeout | null = null
  private readonly listeners = new Set<(state: CloudState) => void>()
  private readonly unsubscribe: () => void

  constructor(
    private readonly controller: Controller,
    private readonly options: Options
  ) {
    this.unsubscribe = controller.subscribe((next, prev, origin) => {
      if (origin !== 'local') return
      if (!trackChange(this.meta, next, prev, new Date().toISOString())) return
      controller.updateMeta(() => {})
      if (this.linked) {
        this.emit()
        this.schedule(CHANGE_DELAY_MS)
      }
    })
    if (!options.manual) {
      this.poll = setInterval(() => this.linked && this.schedule(0), POLL_MS)
    }
  }

  private get meta(): SyncMeta {
    return this.controller.meta.sync
  }

  /** Signed in, and the user has decided how local data joins the account. */
  private get linked(): boolean {
    return this.user !== null && this.meta.userId === this.user.id
  }

  get state(): CloudState {
    const { tasks, events } = this.controller.data
    return {
      configured: this.options.configured,
      user: this.user,
      phase: this.phase,
      pending: this.linked ? pendingCount(this.meta) : 0,
      lastSyncedAt: this.meta.lastSyncedAt,
      error: this.error,
      local: { tasks: tasks.length, events: events.length }
    }
  }

  onState(listener: (state: CloudState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    const state = this.state
    for (const listener of this.listeners) listener(state)
  }

  private setPhase(phase: CloudState['phase'], error: string | null = null): void {
    this.phase = phase
    this.error = error
    this.emit()
  }

  /** The signed-in account changed (sign-in, restored session, or session lost). */
  setUser(user: SyncUser | null, remote: Remote | null): void {
    if ((user?.id ?? null) === (this.user?.id ?? null)) {
      // Same account (e.g. a token refresh): nothing to redo.
      this.remote = remote
      return
    }
    this.epoch++
    this.user = user
    this.remote = remote
    if (!user) {
      // Session ended. Data and the account link stay, so signing back in resumes quietly.
      this.setPhase('local')
      return
    }
    if (this.meta.userId === user.id) {
      this.setPhase('syncing')
      this.schedule(0)
      return
    }
    const { tasks, events } = this.controller.data
    if (tasks.length + events.length > 0) {
      // There is work on this PC: the user decides whether it joins the account.
      this.setPhase('choose')
    } else {
      void this.choose('merge')
    }
  }

  /** First link of this PC to the account. */
  async choose(mode: 'merge' | 'cloud'): Promise<void> {
    const user = this.user
    if (!user || this.linked) return
    const meta = this.meta
    unlink(meta)
    if (mode === 'cloud') {
      this.controller.backup('before-cloud')
      resetStamps(meta)
      this.seedMissing = true
      this.controller.replace(clearAccountData(this.controller.data, false), 'sync')
    } else {
      // Queue everything here for upload. Records that exist on both sides are
      // matched by id, and the newer copy wins, so nothing is duplicated.
      markAllDirty(meta, this.controller.data)
    }
    meta.userId = user.id
    meta.email = user.email
    this.controller.updateMeta(() => {})
    this.setPhase('syncing')
    await this.syncNow()
  }

  /** Sign-out: back to local mode, keeping or clearing what is on this PC. */
  async detach(keepLocal: boolean): Promise<void> {
    // Give queued changes a last chance to upload before the link is cut.
    if (this.linked && pendingCount(this.meta) > 0) await this.syncNow()
    this.epoch++
    this.user = null
    this.remote = null
    this.seedMissing = false
    unlink(this.meta)
    if (!keepLocal) {
      resetStamps(this.meta)
      this.controller.replace(clearAccountData(this.controller.data, true), 'sync')
    }
    this.controller.updateMeta(() => {})
    this.setPhase('local')
  }

  /** Run a sync now (or join the one in progress) and wait for it. */
  async syncNow(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.running) {
      this.again = true
      await this.running
      return
    }
    this.running = this.cycle().finally(() => {
      this.running = null
      if (this.again) {
        this.again = false
        this.schedule(0)
      }
    })
    await this.running
  }

  private schedule(delay: number): void {
    if (this.options.manual) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.syncNow(), delay)
  }

  private async cycle(): Promise<void> {
    const remote = this.remote
    if (!remote || !this.linked) return
    const epoch = this.epoch
    const stale = (): boolean => epoch !== this.epoch
    const meta = this.meta
    if (this.phase !== 'synced') this.setPhase('syncing')

    try {
      const pulled: Partial<Record<(typeof TABLES)[number], number>> = {}
      for (const table of TABLES) {
        const rows = await remote.pull(table, meta.cursors[table] ?? null)
        if (stale()) return
        pulled[table] = rows.length
        if (rows.length === 0) continue
        const merged = mergePulled(this.controller.data, meta, table, rows)
        meta.cursors[table] = rows[rows.length - 1].syncedAt
        this.controller.replace(tidy(merged), 'sync')
      }

      if (this.seedMissing) {
        this.seedMissing = false
        this.seedDefaults(pulled)
      }

      for (const table of TABLES) {
        const batch = collectPush(this.controller.data, meta, table)
        if (batch.upserts.length > 0) await remote.upsert(table, batch.upserts)
        if (batch.removes.length > 0) await remote.remove(table, batch.removes)
        if (stale()) return
        ackPush(meta, table, batch)
      }

      meta.lastSyncedAt = Date.now()
      this.controller.updateMeta(() => {})
      this.setPhase('synced')
    } catch (error) {
      if (stale()) return
      this.controller.updateMeta(() => {})
      const kind = error instanceof SyncError ? error.kind : 'server'
      if (kind === 'network') this.setPhase('offline', 'network')
      else this.setPhase('error', kind === 'schema' ? 'schema' : error instanceof Error ? error.message : String(error))
      this.schedule(RETRY_MS)
    }
  }

  /** A brand-new account has no categories, tools or settings: give it the defaults. */
  private seedDefaults(pulled: Partial<Record<(typeof TABLES)[number], number>>): void {
    let data = this.controller.data
    const seeded: (typeof TABLES)[number][] = []
    if (!pulled.categories && data.categories.length === 0) {
      data = { ...data, categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })) }
      seeded.push('categories')
    }
    if (!pulled.tools && data.tools.length === 0) {
      data = { ...data, tools: defaultToolLibrary() }
      seeded.push('tools')
    }
    if (!pulled.settings) seeded.push('settings')
    this.controller.replace(data, 'sync')
    const now = new Date().toISOString()
    for (const table of seeded) {
      if (table === 'settings') this.meta.stamps.settings[SETTINGS_ID] ??= now
      markAllDirty(this.meta, this.controller.data, [table])
    }
  }

  dispose(): void {
    this.unsubscribe()
    if (this.timer) clearTimeout(this.timer)
    if (this.poll) clearInterval(this.poll)
    this.timer = null
    this.poll = null
  }
}
