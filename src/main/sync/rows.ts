import { isHex } from '@shared/palette'
import { sanitizeSubtasks } from '@shared/subtasks'
import { sanitizeIcon, sanitizeTools, presetById, isSafeUrl } from '@shared/tools'
import type { CalendarEvent, Category, LibraryTool, Task } from '@shared/types'
import { SETTINGS_ID, type RemoteRow, type SyncRecord, type SyncedSettings, type Table } from './core'

/**
 * Translation between FocusFlow records and the Postgres rows in supabase/schema.sql.
 * Rows read back are treated as untrusted: every field is checked and defaulted.
 */

export const TABLE_NAMES: Record<Table, string> = {
  tasks: 'tasks',
  events: 'calendar_events',
  categories: 'categories',
  tools: 'custom_tools',
  settings: 'user_settings'
}

export type Row = Record<string, unknown>

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}
const iso = (v: unknown): string | null => {
  const ms = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}
const ms = (v: unknown): number | null => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isNaN(t) ? null : t
}
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback

/** Record -> row to upload. */
export function toRow(table: Table, userId: string, id: string, updatedAt: string, record: SyncRecord): Row {
  const base = { user_id: userId, updated_at: updatedAt }
  switch (table) {
    case 'tasks': {
      const t = record as Task
      return {
        ...base,
        id,
        deleted_at: null,
        title: t.title,
        notes: t.notes,
        estimated_minutes: t.estimateMin,
        priority: t.priority,
        category_id: t.categoryId,
        due_date: t.dueDate,
        tools: t.tools,
        subtasks: t.subtasks,
        is_completed: t.status === 'done',
        position: t.order,
        spent_ms: Math.round(t.spentMs),
        created_at: new Date(t.createdAt).toISOString(),
        completed_at: t.completedAt === null ? null : new Date(t.completedAt).toISOString()
      }
    }
    case 'events': {
      const e = record as CalendarEvent
      return {
        ...base,
        id,
        deleted_at: null,
        title: e.title,
        notes: e.notes,
        task_id: e.taskId,
        start_time: e.start,
        end_time: e.end,
        category_id: e.categoryId
      }
    }
    case 'categories': {
      const c = record as Category
      return { ...base, id, deleted_at: null, name: c.name, color: c.color }
    }
    case 'tools': {
      const t = record as LibraryTool
      return {
        ...base,
        id,
        deleted_at: null,
        name: t.label,
        url: t.url,
        preset: t.preset,
        icon_type: t.icon?.type ?? null,
        icon_value: t.icon ? (t.icon.type === 'emoji' ? t.icon.value : t.icon.src) : null
      }
    }
    case 'settings': {
      const s = record as SyncedSettings
      return {
        ...base,
        theme_mode: s.theme,
        accent_color: s.accent,
        bg_color: s.bgColor,
        surface_color: s.surfaceColor,
        focus_duration: s.focusMin,
        break_duration: s.breakMin,
        language: s.language
      }
    }
  }
}

function recordFrom(table: Table, id: string, row: Row): SyncRecord | null {
  switch (table) {
    case 'tasks': {
      const title = str(row.title).trim()
      if (!title) return null
      const task: Task = {
        id,
        title,
        notes: str(row.notes),
        tools: sanitizeTools(row.tools),
        subtasks: sanitizeSubtasks(row.subtasks),
        estimateMin: Math.max(1, Math.round(num(row.estimated_minutes, 25))),
        priority: oneOf(row.priority, ['high', 'medium', 'low'] as const, 'medium'),
        categoryId: strOrNull(row.category_id),
        dueDate: /^\d{4}-\d{2}-\d{2}/.test(str(row.due_date)) ? str(row.due_date).slice(0, 10) : null,
        status: row.is_completed === true ? 'done' : 'todo',
        order: num(row.position, 0),
        spentMs: Math.max(0, num(row.spent_ms, 0)),
        createdAt: ms(row.created_at) ?? Date.now(),
        completedAt: ms(row.completed_at)
      }
      return task
    }
    case 'events': {
      const start = iso(row.start_time)
      const end = iso(row.end_time)
      if (!start || !end || Date.parse(end) <= Date.parse(start)) return null
      const event: CalendarEvent = {
        id,
        title: str(row.title).trim() || 'Untitled',
        notes: str(row.notes),
        start,
        end,
        categoryId: strOrNull(row.category_id),
        taskId: strOrNull(row.task_id)
      }
      return event
    }
    case 'categories': {
      const category: Category = { id, name: str(row.name), color: isHex(row.color) ? row.color : '#8a93a6' }
      return category
    }
    case 'tools': {
      const label = str(row.name).trim().slice(0, 60)
      if (!label) return null
      const iconValue = str(row.icon_value)
      const tool: LibraryTool = {
        id,
        label,
        url: typeof row.url === 'string' && isSafeUrl(row.url) ? row.url : null,
        preset: typeof row.preset === 'string' && presetById(row.preset) ? row.preset : null,
        icon:
          row.icon_type === 'emoji'
            ? sanitizeIcon({ type: 'emoji', value: iconValue })
            : row.icon_type === 'image'
              ? sanitizeIcon({ type: 'image', src: iconValue })
              : null
      }
      return tool
    }
    case 'settings': {
      // Only fields that are valid are taken; the rest keep their local value.
      const s: Partial<SyncedSettings> = {}
      if (row.theme_mode === 'dark' || row.theme_mode === 'light' || row.theme_mode === 'system') s.theme = row.theme_mode
      if (isHex(row.accent_color)) s.accent = row.accent_color
      if (row.bg_color === null || isHex(row.bg_color)) s.bgColor = row.bg_color
      if (row.surface_color === null || isHex(row.surface_color)) s.surfaceColor = row.surface_color
      if (row.language === 'en' || row.language === 'it') s.language = row.language
      const focus = Math.round(num(row.focus_duration, 0))
      const rest = Math.round(num(row.break_duration, 0))
      if (focus >= 1 && focus <= 600) s.focusMin = focus
      if (rest >= 1 && rest <= 120) s.breakMin = rest
      return s
    }
  }
}

/** Row from the cloud -> something the sync core can merge. Null if unusable. */
export function fromRow(table: Table, row: Row): RemoteRow | null {
  const id = table === 'settings' ? SETTINGS_ID : str(row.id)
  const updatedAt = iso(row.updated_at)
  const syncedAt = str(row.synced_at)
  if (!id || !updatedAt || !syncedAt) return null
  const deletedAt = table === 'settings' ? null : iso(row.deleted_at)
  const record = deletedAt ? null : recordFrom(table, id, row)
  // A live row that fails validation is skipped rather than treated as a deletion.
  if (!deletedAt && !record) return null
  return { id, updatedAt, deletedAt, syncedAt, record }
}
