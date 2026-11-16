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
}

type Phase = 'local' | 'choose' | 'syncing' | 'synced' | 'offline' | 'error'

/**
 * Keeps this PC's data and a cloud account in step, on request.
 *
 * The app always reads and writes local data. This engine only watches those
 * changes and remembers which records still need uploading (that list is saved
 * to disk). Nothing is sent or fetched in the background: a sync runs when the
 * user presses "Sync now", signs in, or signs out. One sync pulls remote
 * changes, merges them (the newer copy of a record wins), then uploads the list.
 */
export class SyncEngine {
  private user: SyncUser | null = null
  private remote: Remote | null = null
  private phase: Phase = 'local'
  private error: string | null = null
  private running: Promise<void> | null = null
  /** Bumped whenever the account changes, so a sync in flight for the old one stops. */
  private epoch = 0
  /** After "keep cloud only": add defaults for anything the account turned out not to have. */
  private seedMissing = false
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
      // Only the "unsynced changes" count changes here; nothing is uploaded.
      if (this.linked) this.emit()
    })
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
    const pending = this.linked ? pendingCount(this.meta) : 0
    return {
      configured: this.options.configured,
      user: this.user,
      // "Synced" only while there is nothing waiting to be uploaded.
      phase: this.phase === 'synced' && pending > 0 ? 'pending' : this.phase,
      pending,
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

  private setPhase(phase: Phase, error: string | null = null): void {
    this.phase = phase
    this.error = error
    this.emit()
  }

  /**
   * The signed-in account changed. `interactive` is true when the user has just
   * signed in (so a first sync is expected); a session restored at startup does
   * not sync by itself.
   */
  setUser(user: SyncUser | null, remote: Remote | null, interactive = false): void {
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
      this.setPhase('synced')
      if (interactive) void this.syncNow()
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
    // Give unsynced changes a last chance to upload before the link is cut.
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

  /** Run one sync and wait for it. If one is already running, wait for that and then run again. */
  async syncNow(): Promise<void> {
    if (this.running) await this.running
    this.running = this.cycle().finally(() => {
      this.running = null
    })
    await this.running
  }

  private async cycle(): Promise<void> {
    const remote = this.remote
    if (!remote || !this.linked) return
    const epoch = this.epoch
    const stale = (): boolean => epoch !== this.epoch
    const meta = this.meta
    this.setPhase('syncing')

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
      // Nothing is lost: unsynced changes stay listed for the next attempt.
      if (kind === 'network') this.setPhase('offline', 'network')
      else this.setPhase('error', kind === 'schema' ? 'schema' : error instanceof Error ? error.message : String(error))
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
  }
}
