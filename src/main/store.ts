import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_SETTINGS, defaultData, idleFocus } from '@shared/defaults'
import { isHex } from '@shared/palette'
import { sanitizeSubtasks } from '@shared/subtasks'
import { randomUUID } from 'node:crypto'
import { emptySyncMeta, normalizeSyncMeta, type SyncMeta } from './sync/core'
import { defaultToolLibrary, sameTool, sanitizeLibrary, sanitizeTools } from '@shared/tools'
import type { AppData, CalendarEvent, Category, FocusState, Settings, Task } from '@shared/types'

export const SCHEMA_VERSION = 1

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximized?: boolean
}

/** Persisted state that is not part of what the UI renders. */
export interface Meta {
  window: { main?: WindowBounds; mini?: { x: number; y: number } }
  trayHintShown: boolean
  /** Cloud sync bookkeeping: account link, change stamps, upload queue. */
  sync: SyncMeta
}

interface Persisted {
  schemaVersion: number
  savedAt: number
  data: AppData
  meta: Meta
}

export type LoadSource = 'file' | 'backup' | 'fresh'

export interface Loaded {
  data: AppData
  meta: Meta
  source: LoadSource
}

const defaultMeta = (): Meta => ({ window: {}, trayHintShown: false, sync: emptySyncMeta() })

/**
 * A single JSON document on disk, written atomically (temp file + rename) so a
 * crash mid-write can never leave a half-written file. A backup of the last
 * file that loaded cleanly is kept alongside it.
 */
export class JsonStore {
  readonly file: string
  readonly backup: string
  private readonly tmp: string
  private pending: Persisted | null = null
  private timer: NodeJS.Timeout | null = null

  constructor(
    readonly dir: string,
    private readonly debounceMs = 250
  ) {
    this.file = path.join(dir, 'data.json')
    this.backup = path.join(dir, 'data.bak.json')
    this.tmp = path.join(dir, 'data.json.tmp')
  }

  load(now = Date.now()): Loaded {
    fs.mkdirSync(this.dir, { recursive: true })

    const main = this.read(this.file)
    if (main) {
      try {
        fs.copyFileSync(this.file, this.backup)
      } catch {
        // A missing backup is not worth failing startup over.
      }
      return { ...normalize(main, now), source: 'file' }
    }

    if (fs.existsSync(this.file)) {
      // Unreadable: set it aside rather than overwrite it, so nothing is lost for good.
      try {
        fs.renameSync(this.file, path.join(this.dir, `data.corrupt-${now}.json`))
      } catch {
        // ignore
      }
    }

    const backup = this.read(this.backup)
    if (backup) return { ...normalize(backup, now), source: 'backup' }

    return { data: defaultData(), meta: defaultMeta(), source: 'fresh' }
  }

  /** Copy the current data file next to itself, e.g. data.before-cloud-<time>.json. */
  copyAside(label: string): string | null {
    try {
      const target = path.join(this.dir, `data.${label}-${Date.now()}.json`)
      fs.copyFileSync(this.file, target)
      return target
    } catch {
      return null
    }
  }

  /** Queue a write; rapid changes collapse into one. */
  save(data: AppData, meta: Meta): void {
    this.pending = { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), data, meta }
    if (this.timer) return
    this.timer = setTimeout(() => this.flush(), this.debounceMs)
  }

  /** Write any queued state right now. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.pending) return
    const payload = this.pending
    this.pending = null
    payload.savedAt = Date.now()
    fs.mkdirSync(this.dir, { recursive: true })
    fs.writeFileSync(this.tmp, JSON.stringify(payload, null, 2), 'utf8')
    fs.renameSync(this.tmp, this.file)
  }

  private read(file: string): unknown | null {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
}

/* ---------- validation: never trust the shape of what is on disk ---------- */

type Dict = Record<string, unknown>
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback
const list = (v: unknown): Dict[] => (Array.isArray(v) ? v.filter(isDict) : [])

export function normalize(raw: unknown, now: number): { data: AppData; meta: Meta } {
  const root = isDict(raw) ? raw : {}
  const d = isDict(root.data) ? root.data : {}
  const savedAt = num(root.savedAt, now)

  const s = isDict(d.settings) ? d.settings : {}
  const settings: Settings = {
    launchAtStartup: bool(s.launchAtStartup, DEFAULT_SETTINGS.launchAtStartup),
    startMinimized: bool(s.startMinimized, DEFAULT_SETTINGS.startMinimized),
    alwaysOnTop: bool(s.alwaysOnTop, DEFAULT_SETTINGS.alwaysOnTop),
    notificationSounds: bool(s.notificationSounds, DEFAULT_SETTINGS.notificationSounds),
    theme: oneOf(s.theme, ['dark', 'light', 'system'] as const, DEFAULT_SETTINGS.theme),
    accent: isHex(s.accent) ? s.accent : DEFAULT_SETTINGS.accent,
    bgColor: isHex(s.bgColor) ? s.bgColor : null,
    surfaceColor: isHex(s.surfaceColor) ? s.surfaceColor : null,
    language: oneOf(s.language, ['en', 'it'] as const, DEFAULT_SETTINGS.language),
    focusMin: Math.min(600, Math.max(1, Math.round(num(s.focusMin, DEFAULT_SETTINGS.focusMin)))),
    breakMin: Math.min(120, Math.max(1, Math.round(num(s.breakMin, DEFAULT_SETTINGS.breakMin))))
  }

  const categories: Category[] = Array.isArray(d.categories)
    ? list(d.categories)
        .filter((c) => typeof c.id === 'string' && c.id)
        .map((c) => ({ id: c.id as string, name: str(c.name, ''), color: str(c.color, '#8A93A6') }))
    : defaultData().categories
  const library = loadLibrary(d, s)
  const categoryIds = new Set(categories.map((c) => c.id))
  const category = (v: unknown): string | null => (typeof v === 'string' && categoryIds.has(v) ? v : null)

  const tasks: Task[] = list(d.tasks)
    .filter((t) => typeof t.id === 'string' && t.id && typeof t.title === 'string' && t.title.trim())
    .map((t, i) => ({
      id: t.id as string,
      title: (t.title as string).trim(),
      notes: str(t.notes, ''),
      tools: linkTools(sanitizeTools(t.tools), library),
      subtasks: sanitizeSubtasks(t.subtasks),
      estimateMin: Math.max(1, Math.round(num(t.estimateMin, settings.focusMin))),
      priority: oneOf(t.priority, ['high', 'medium', 'low'] as const, 'medium'),
      categoryId: category(t.categoryId),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(str(t.dueDate, '')) ? (t.dueDate as string) : null,
      status: oneOf(t.status, ['todo', 'done'] as const, 'todo'),
      order: num(t.order, i),
      spentMs: Math.max(0, num(t.spentMs, 0)),
      createdAt: num(t.createdAt, now),
      completedAt: typeof t.completedAt === 'number' ? t.completedAt : null
    }))
  const taskIds = new Set(tasks.map((t) => t.id))

  const events: CalendarEvent[] = list(d.events)
    .filter(
      (e) =>
        typeof e.id === 'string' &&
        e.id &&
        !Number.isNaN(Date.parse(str(e.start, ''))) &&
        Date.parse(str(e.end, '')) > Date.parse(str(e.start, ''))
    )
    .map((e) => ({
      id: e.id as string,
      title: str(e.title, '').trim() || 'Untitled',
      notes: str(e.notes, ''),
      start: new Date(Date.parse(e.start as string)).toISOString(),
      end: new Date(Date.parse(e.end as string)).toISOString(),
      categoryId: category(e.categoryId),
      taskId: typeof e.taskId === 'string' && taskIds.has(e.taskId) ? e.taskId : null
    }))

  const data: AppData = { tasks, events, categories, tools: library, settings, focus: normalizeFocus(d.focus, settings, taskIds, savedAt) }

  const m = isDict(root.meta) ? root.meta : {}
  const w = isDict(m.window) ? m.window : {}
  const meta: Meta = { window: {}, trayHintShown: bool(m.trayHintShown, false), sync: normalizeSyncMeta(m.sync) }
  if (isDict(w.main) && ['x', 'y', 'width', 'height'].every((k) => typeof (w.main as Dict)[k] === 'number')) {
    const b = w.main
    meta.window.main = {
      x: b.x as number,
      y: b.y as number,
      width: b.width as number,
      height: b.height as number,
      maximized: bool(b.maximized, false)
    }
  }
  if (isDict(w.mini) && typeof w.mini.x === 'number' && typeof w.mini.y === 'number') {
    meta.window.mini = { x: w.mini.x, y: w.mini.y }
  }

  return { data, meta }
}

function normalizeFocus(raw: unknown, settings: Settings, taskIds: Set<string>, savedAt: number): FocusState {
  if (!isDict(raw)) return idleFocus(settings.focusMin)
  const phase = oneOf(raw.phase, ['focus', 'break'] as const, 'focus')
  const taskId = strOrNull(raw.taskId)
  if (phase === 'focus' && (!taskId || !taskIds.has(taskId))) return idleFocus(settings.focusMin)

  const fallback = (phase === 'break' ? settings.breakMin : settings.focusMin) * 60_000
  const durationMs = Math.max(1000, num(raw.durationMs, fallback))
  let status = oneOf(raw.status, ['idle', 'running', 'paused', 'finished'] as const, 'idle')
  let remaining = Math.min(durationMs, Math.max(0, num(raw.remainingMs, durationMs)))

  // The app closed mid-run. Time it was not open does not count: resume as paused
  // with whatever was left when the file was last written.
  if (status === 'running') {
    const endsAt = num(raw.endsAt, savedAt)
    remaining = Math.min(durationMs, Math.max(0, endsAt - savedAt))
    status = remaining > 0 ? 'paused' : 'finished'
  }

  return {
    taskId: phase === 'focus' ? taskId : null,
    phase,
    status,
    durationMs,
    remainingMs: status === 'idle' ? durationMs : remaining,
    endsAt: null,
    runStartedAt: null
  }
}

/**
 * The tool library. Files from before it existed get the built-in tools plus any
 * tools saved under the old "savedTools" setting.
 */
function loadLibrary(d: Dict, s: Dict) {
  if (Array.isArray(d.tools)) return sanitizeLibrary(d.tools)
  const library = defaultToolLibrary()
  for (const legacy of sanitizeTools(s.savedTools, 40)) {
    if (!library.some((t) => sameTool({ ...t, id: null }, legacy))) library.push({ ...legacy, id: randomUUID() })
  }
  return library
}

/** Older task tools had no library id: link them to a matching library tool so Settings edits reach them. */
function linkTools(tools: ReturnType<typeof sanitizeTools>, library: ReturnType<typeof sanitizeLibrary>) {
  return tools.map((t) => {
    if (t.id) return t
    const match = library.find((l) => sameTool({ ...l, id: null }, t))
    return match ? { ...t, id: match.id } : t
  })
}
