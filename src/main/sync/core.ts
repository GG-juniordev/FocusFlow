import { DEFAULT_CATEGORIES, idleFocus } from '@shared/defaults'
import { defaultToolLibrary } from '@shared/tools'
import type { AppData, CalendarEvent, Category, LibraryTool, Settings, Task } from '@shared/types'

/**
 * The pure half of cloud sync: tracking what changed locally, merging what
 * arrives from the cloud, and working out what to send. No network, no Electron.
 *
 * Model: every record has a last-modified stamp. The newer stamp wins a conflict.
 * Local changes made while signed in go into a persisted queue (`dirty`, `deleted`)
 * that survives restarts and being offline, and is drained when a sync succeeds.
 */

/** Sync order matters: categories and tools before the tasks and events that refer to them. */
export const TABLES = ['categories', 'tools', 'tasks', 'events', 'settings'] as const
export type Table = (typeof TABLES)[number]

/** The settings row has one record per account. */
export const SETTINGS_ID = 'settings'

/** Preferences that follow the account. Window/startup behaviour stays per PC. */
export const SYNCED_SETTINGS = ['theme', 'accent', 'bgColor', 'surfaceColor', 'language', 'focusMin', 'breakMin'] as const
export type SyncedSettings = Pick<Settings, (typeof SYNCED_SETTINGS)[number]>

export type SyncRecord = Task | CalendarEvent | Category | LibraryTool | Partial<SyncedSettings>

/** Stamp given to records that predate sync, so anything edited since wins over them. */
export const LEGACY_STAMP = '2000-01-01T00:00:00.000Z'

export interface SyncMeta {
  /** Account this PC's data is linked to; null in local (guest) mode. */
  userId: string | null
  email: string | null
  /** Per table: server position up to which changes have been pulled. */
  cursors: Partial<Record<Table, string>>
  /** Per table: id -> when the local copy last changed (ISO). Tracked in guest mode too. */
  stamps: Record<Table, Record<string, string>>
  /** Per table: ids changed locally and not yet uploaded. */
  dirty: Record<Table, string[]>
  /** Per table: id -> when it was deleted locally, not yet uploaded. */
  deleted: Record<Table, Record<string, string>>
  lastSyncedAt: number | null
}

/** A row as the cloud returns it. */
export interface RemoteRow {
  id: string
  updatedAt: string
  deletedAt: string | null
  /** Server-assigned position used as the pull cursor. */
  syncedAt: string
  record: SyncRecord | null
}

export interface PushBatch {
  upserts: { id: string; updatedAt: string; record: SyncRecord }[]
  removes: { id: string; deletedAt: string }[]
}

/** Where the data lives remotely. Supabase in the app; an in-memory fake in tests. */
export interface Remote {
  pull(table: Table, since: string | null): Promise<RemoteRow[]>
  upsert(table: Table, rows: PushBatch['upserts']): Promise<void>
  remove(table: Table, rows: PushBatch['removes']): Promise<void>
}

const perTable = <T>(make: () => T): Record<Table, T> =>
  Object.fromEntries(TABLES.map((t) => [t, make()])) as Record<Table, T>

export const emptySyncMeta = (): SyncMeta => ({
  userId: null,
  email: null,
  cursors: {},
  stamps: perTable(() => ({})),
  dirty: perTable(() => []),
  deleted: perTable(() => ({})),
  lastSyncedAt: null
})

type Dict = Record<string, unknown>
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)
const stringMap = (v: unknown): Record<string, string> =>
  isDict(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string')) as Record<string, string> : {}

/** Rebuild sync state from disk, tolerating anything missing or malformed. */
export function normalizeSyncMeta(raw: unknown): SyncMeta {
  const meta = emptySyncMeta()
  if (!isDict(raw)) return meta
  meta.userId = typeof raw.userId === 'string' && raw.userId ? raw.userId : null
  meta.email = typeof raw.email === 'string' ? raw.email : null
  meta.lastSyncedAt = typeof raw.lastSyncedAt === 'number' ? raw.lastSyncedAt : null
  const cursors = stringMap(raw.cursors)
  for (const t of TABLES) {
    if (cursors[t]) meta.cursors[t] = cursors[t]
    meta.stamps[t] = stringMap(isDict(raw.stamps) ? raw.stamps[t] : null)
    meta.deleted[t] = stringMap(isDict(raw.deleted) ? raw.deleted[t] : null)
    const dirty = isDict(raw.dirty) ? raw.dirty[t] : null
    meta.dirty[t] = Array.isArray(dirty) ? [...new Set(dirty.filter((x): x is string => typeof x === 'string'))] : []
  }
  return meta
}

const at = (iso: string | undefined): number => (iso ? Date.parse(iso) || 0 : 0)

const pickSettings = (s: Settings): SyncedSettings =>
  Object.fromEntries(SYNCED_SETTINGS.map((k) => [k, s[k]])) as SyncedSettings

/** A table's records by id. Settings is a single record. */
export function recordsOf(data: AppData, table: Table): Map<string, SyncRecord> {
  if (table === 'settings') return new Map([[SETTINGS_ID, pickSettings(data.settings)]])
  const list: { id: string }[] = data[table]
  return new Map(list.map((r) => [r.id, r as SyncRecord]))
}

function withRecords(data: AppData, table: Table, records: Map<string, SyncRecord>): AppData {
  if (table === 'settings') {
    const incoming = records.get(SETTINGS_ID) as Partial<SyncedSettings> | undefined
    return incoming ? { ...data, settings: { ...data.settings, ...incoming } } : data
  }
  return { ...data, [table]: [...records.values()] }
}

const sameRecord = (table: Table, a: SyncRecord | undefined, b: SyncRecord | undefined): boolean => {
  if (table !== 'settings') return a === b
  if (!a || !b) return a === b
  return SYNCED_SETTINGS.every((k) => (a as SyncedSettings)[k] === (b as SyncedSettings)[k])
}

/**
 * Note what a local change touched. Stamps are kept in every mode so a later
 * merge knows which side is newer; the upload queue is only kept while linked.
 */
export function trackChange(meta: SyncMeta, next: AppData, prev: AppData, nowIso: string): boolean {
  let changed = false
  // A change must always be newer than the version it was made on top of, even
  // if this PC's clock is behind the device that wrote that version.
  const after_ = (previous: string | undefined): string =>
    at(previous) >= at(nowIso) ? new Date(at(previous) + 1).toISOString() : nowIso
  const linked = meta.userId !== null
  for (const table of TABLES) {
    if (table !== 'settings' && next[table] === prev[table]) continue
    const before = recordsOf(prev, table)
    const after = recordsOf(next, table)
    for (const [id, record] of after) {
      if (sameRecord(table, before.get(id), record)) continue
      meta.stamps[table][id] = after_(meta.stamps[table][id])
      delete meta.deleted[table][id]
      if (linked && !meta.dirty[table].includes(id)) meta.dirty[table].push(id)
      changed = true
    }
    for (const id of before.keys()) {
      if (after.has(id)) continue
      const deletedAt = after_(meta.stamps[table][id])
      delete meta.stamps[table][id]
      meta.dirty[table] = meta.dirty[table].filter((x) => x !== id)
      if (linked) meta.deleted[table][id] = deletedAt
      changed = true
    }
  }
  return changed
}

export const pendingCount = (meta: SyncMeta): number =>
  TABLES.reduce((n, t) => n + meta.dirty[t].length + Object.keys(meta.deleted[t]).length, 0)

/** Queue everything on this PC for upload (first link to an account). */
export function markAllDirty(meta: SyncMeta, data: AppData, tables: readonly Table[] = TABLES): void {
  for (const table of tables) {
    for (const id of recordsOf(data, table).keys()) {
      if (!meta.stamps[table][id]) meta.stamps[table][id] = LEGACY_STAMP
      if (!meta.dirty[table].includes(id)) meta.dirty[table].push(id)
    }
  }
}

/**
 * Fold rows pulled from the cloud into local data. For each row the newer side
 * wins: an unsent local edit or delete is kept only if it is newer than the row.
 * Returns the same `data` object when nothing changed.
 */
export function mergePulled(data: AppData, meta: SyncMeta, table: Table, rows: RemoteRow[]): AppData {
  if (rows.length === 0) return data
  const records = recordsOf(data, table)
  const dirty = new Set(meta.dirty[table])
  const stamps = meta.stamps[table]
  const deleted = meta.deleted[table]
  let changed = false

  for (const row of rows) {
    const { id } = row
    if (deleted[id]) {
      if (row.deletedAt) {
        delete deleted[id] // already deleted in the cloud: nothing left to send
        continue
      }
      if (at(row.updatedAt) <= at(deleted[id])) continue // our delete is newer: keep it queued
      delete deleted[id] // edited elsewhere after we deleted it: it comes back
    } else if (dirty.has(id) && at(row.updatedAt) <= at(stamps[id])) {
      continue // our unsent edit is newer (or this is our own upload echoing back)
    }

    if (row.deletedAt || !row.record) {
      if (records.delete(id)) changed = true
      delete stamps[id]
    } else {
      const unchanged = records.has(id) && stamps[id] === row.updatedAt && !dirty.has(id)
      if (!unchanged) {
        records.set(id, row.record)
        changed = true
      }
      stamps[id] = row.updatedAt
    }
    dirty.delete(id)
  }

  meta.dirty[table] = [...dirty]
  return changed ? withRecords(data, table, records) : data
}

/** What to upload for a table right now. */
export function collectPush(data: AppData, meta: SyncMeta, table: Table): PushBatch {
  const records = recordsOf(data, table)
  const upserts: PushBatch['upserts'] = []
  for (const id of meta.dirty[table]) {
    const record = records.get(id)
    if (record) upserts.push({ id, updatedAt: meta.stamps[table][id] ?? LEGACY_STAMP, record })
  }
  const removes = Object.entries(meta.deleted[table]).map(([id, deletedAt]) => ({ id, deletedAt }))
  return { upserts, removes }
}

/** Clear what was uploaded from the queue, unless it changed again while the upload was in flight. */
export function ackPush(meta: SyncMeta, table: Table, batch: PushBatch): void {
  const sent = new Map(batch.upserts.map((u) => [u.id, u.updatedAt]))
  meta.dirty[table] = meta.dirty[table].filter((id) => {
    if (!sent.has(id)) return recordStillQueued(meta, table, id)
    return (meta.stamps[table][id] ?? LEGACY_STAMP) !== sent.get(id)
  })
  for (const { id, deletedAt } of batch.removes) {
    if (meta.deleted[table][id] === deletedAt) delete meta.deleted[table][id]
  }
}

// A queued id whose record no longer exists has nothing to upload; its deletion is queued separately.
const recordStillQueued = (meta: SyncMeta, table: Table, id: string): boolean => id in meta.stamps[table]

/** Repair references left dangling by a merge (e.g. a task deleted on another device). */
export function tidy(data: AppData): AppData {
  const taskIds = new Set(data.tasks.map((t) => t.id))
  const categoryIds = new Set(data.categories.map((c) => c.id))
  const category = (id: string | null): string | null => (id && categoryIds.has(id) ? id : null)
  let touched = false

  const tasks = data.tasks.map((t) => {
    if (category(t.categoryId) === t.categoryId) return t
    touched = true
    return { ...t, categoryId: null }
  })
  const events = data.events.map((e) => {
    const taskId = e.taskId && taskIds.has(e.taskId) ? e.taskId : null
    const categoryId = category(e.categoryId)
    if (taskId === e.taskId && categoryId === e.categoryId) return e
    touched = true
    return { ...e, taskId, categoryId }
  })
  let focus = data.focus
  if (focus.phase === 'focus' && focus.taskId && !taskIds.has(focus.taskId)) {
    focus = idleFocus(data.settings.focusMin)
    touched = true
  }
  return touched ? { ...data, tasks, events, focus } : data
}

/** Remove everything that belongs to an account, leaving an empty local workspace. */
export function clearAccountData(data: AppData, withDefaults: boolean): AppData {
  return {
    ...data,
    tasks: [],
    events: [],
    categories: withDefaults ? DEFAULT_CATEGORIES.map((c) => ({ ...c })) : [],
    tools: withDefaults ? defaultToolLibrary() : [],
    focus: idleFocus(data.settings.focusMin)
  }
}

/** Forget the account link and the upload queue; keep stamps so a later merge still knows what is newer. */
export function unlink(meta: SyncMeta): void {
  meta.userId = null
  meta.email = null
  meta.cursors = {}
  meta.dirty = perTable(() => [])
  meta.deleted = perTable(() => ({}))
  meta.lastSyncedAt = null
}

export function resetStamps(meta: SyncMeta): void {
  meta.stamps = perTable(() => ({}))
}
