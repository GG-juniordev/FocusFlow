import { idleFocus } from './defaults'
import { isHex } from './palette'
import { defaultToolLibrary, sanitizeLibrary, sanitizeTools, snapshotTool } from './tools'
import { MINUTE, eventMinutes, toDateKey } from './time'
import type { Action, AppData, CalendarEvent, FocusState, LibraryTool, Settings, Task, TaskDraft } from './types'

/**
 * Pure state transitions. The main process applies these as the source of truth;
 * renderers apply the same function optimistically so the UI responds instantly.
 */
export function applyAction(data: AppData, action: Action, now: number): AppData {
  switch (action.type) {
    case 'task/upsert':
      return upsertTask(data, action.task, now)
    case 'task/remove':
      return removeTask(data, action.id, now)
    case 'task/reorder':
      return reorderTasks(data, action.ids)
    case 'task/setStatus':
      return setTaskStatus(data, action.id, action.status, now)
    case 'event/upsert':
      return upsertEvent(data, action.event)
    case 'event/remove':
      return { ...data, events: data.events.filter((e) => e.id !== action.id) }
    case 'event/toTask':
      return eventToTask(data, action.id, action.taskId, now)
    case 'category/upsert':
      return upsertCategory(data, action.category)
    case 'category/remove':
      return removeCategory(data, action.id)
    case 'tool/upsert':
      return upsertLibraryTool(data, action.tool)
    case 'tool/remove':
      return removeLibraryTool(data, action.id)
    case 'tool/restoreDefaults': {
      const missing = defaultToolLibrary().filter((d) => !data.tools.some((t) => t.id === d.id))
      return missing.length ? { ...data, tools: [...data.tools, ...missing] } : data
    }
    case 'settings/update':
      return updateSettings(data, action.patch)
    case 'focus/set':
      return setFocus(data, action.taskId, now)
    case 'focus/start':
      return startFocus(data, now)
    case 'focus/pause':
      return pauseFocus(data, now)
    case 'focus/reset':
      return resetFocus(data, now)
    case 'focus/complete':
      return completeFocus(data, now)
    case 'focus/extend':
      return extendFocus(data, action.minutes, now)
    case 'focus/startBreak':
      return startBreak(data, now)
    case 'focus/endBreak':
      return { ...data, focus: idleFocus(data.settings.focusMin) }
    case 'focus/tick':
      return tickFocus(data, now)
    default:
      return data
  }
}

/* ---------- tasks ---------- */

function clampMinutes(value: unknown, fallback: number, max = 24 * 60): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, max)
}

function upsertTask(data: AppData, draft: TaskDraft, now: number): AppData {
  const existing = data.tasks.find((t) => t.id === draft.id)
  if (existing) {
    const merged: Task = { ...existing, ...draft, id: existing.id }
    merged.title = (merged.title ?? '').trim() || existing.title
    merged.tools = draft.tools === undefined ? existing.tools : taskTools(data, draft.tools)
    merged.estimateMin = clampMinutes(merged.estimateMin, existing.estimateMin)
    let focus = data.focus
    // Keep an untouched timer in step with a changed estimate.
    if (
      focus.taskId === merged.id &&
      focus.phase === 'focus' &&
      focus.status === 'idle' &&
      merged.estimateMin !== existing.estimateMin
    ) {
      const ms = merged.estimateMin * MINUTE
      focus = { ...focus, durationMs: ms, remainingMs: ms }
    }
    return { ...data, focus, tasks: data.tasks.map((t) => (t.id === merged.id ? merged : t)) }
  }

  const title = (draft.title ?? '').trim()
  if (!title) return data
  const maxOrder = data.tasks.reduce((m, t) => Math.max(m, t.order), -1)
  const task: Task = {
    id: draft.id,
    title,
    notes: draft.notes ?? '',
    tools: taskTools(data, draft.tools),
    estimateMin: clampMinutes(draft.estimateMin, data.settings.focusMin),
    priority: draft.priority ?? 'medium',
    categoryId: draft.categoryId ?? null,
    dueDate: draft.dueDate ?? null,
    status: draft.status ?? 'todo',
    order: draft.order ?? maxOrder + 1,
    spentMs: 0,
    createdAt: now,
    completedAt: null
  }
  return { ...data, tasks: [...data.tasks, task] }
}

function removeTask(data: AppData, id: string, now: number): AppData {
  let next = data
  if (data.focus.taskId === id) next = { ...settle(data, now), focus: idleFocus(data.settings.focusMin) }
  return {
    ...next,
    tasks: next.tasks.filter((t) => t.id !== id),
    events: next.events.map((e) => (e.taskId === id ? { ...e, taskId: null } : e))
  }
}

/** `ids` is the new order of some or all tasks; unlisted tasks keep their relative order after them. */
function reorderTasks(data: AppData, ids: string[]): AppData {
  const position = new Map(ids.map((id, i) => [id, i]))
  const sorted = [...data.tasks].sort((a, b) => {
    const pa = position.get(a.id)
    const pb = position.get(b.id)
    if (pa !== undefined && pb !== undefined) return pa - pb
    if (pa !== undefined) return -1
    if (pb !== undefined) return 1
    return a.order - b.order
  })
  const order = new Map(sorted.map((t, i) => [t.id, i]))
  return { ...data, tasks: data.tasks.map((t) => ({ ...t, order: order.get(t.id) ?? t.order })) }
}

function setTaskStatus(data: AppData, id: string, status: Task['status'], now: number): AppData {
  const task = data.tasks.find((t) => t.id === id)
  if (!task || task.status === status) return data
  let next = data
  if (status === 'done' && data.focus.taskId === id) {
    next = { ...settle(data, now), focus: idleFocus(data.settings.focusMin) }
  }
  return {
    ...next,
    tasks: next.tasks.map((t) =>
      t.id === id ? { ...t, status, completedAt: status === 'done' ? now : null } : t
    )
  }
}

/* ---------- calendar ---------- */

function upsertEvent(data: AppData, draft: Partial<CalendarEvent> & { id: string }): AppData {
  const existing = data.events.find((e) => e.id === draft.id)
  const base: CalendarEvent = existing ?? {
    id: draft.id,
    title: '',
    notes: '',
    start: '',
    end: '',
    categoryId: null,
    taskId: null
  }
  const merged: CalendarEvent = { ...base, ...draft, id: base.id }
  merged.title = (merged.title ?? '').trim() || existing?.title || ''
  const startMs = Date.parse(merged.start)
  if (!merged.title || Number.isNaN(startMs)) return data
  let endMs = Date.parse(merged.end)
  if (Number.isNaN(endMs) || endMs <= startMs) endMs = startMs + 15 * MINUTE
  merged.start = new Date(startMs).toISOString()
  merged.end = new Date(endMs).toISOString()

  let tasks = data.tasks
  if (merged.taskId) {
    const day = toDateKey(new Date(startMs))
    // Time-blocking a task gives it a date if it had none, and that date follows
    // the block when it moves to another day. A date the user chose is left alone.
    const previousDay = existing ? toDateKey(new Date(existing.start)) : null
    tasks = tasks.map((t) =>
      t.id === merged.taskId && (!t.dueDate || t.dueDate === previousDay) && t.dueDate !== day
        ? { ...t, dueDate: day }
        : t
    )
  }
  const events = existing
    ? data.events.map((e) => (e.id === merged.id ? merged : e))
    : [...data.events, merged]
  return { ...data, tasks, events }
}

function eventToTask(data: AppData, id: string, taskId: string, now: number): AppData {
  const event = data.events.find((e) => e.id === id)
  if (!event || event.taskId) return data
  const withTask = upsertTask(
    data,
    {
      id: taskId,
      title: event.title,
      notes: event.notes,
      estimateMin: eventMinutes(event.start, event.end),
      categoryId: event.categoryId,
      dueDate: toDateKey(new Date(event.start))
    },
    now
  )
  return { ...withTask, events: withTask.events.map((e) => (e.id === id ? { ...e, taskId } : e)) }
}

/* ---------- tool library ---------- */

/** Validate a task's tools and refresh linked ones from the library, so the snapshot is current. */
function taskTools(data: AppData, raw: unknown) {
  return sanitizeTools(raw).map((t) => snapshotTool(t, data.tools))
}

function upsertLibraryTool(data: AppData, raw: LibraryTool): AppData {
  const [tool] = sanitizeLibrary([raw])
  if (!tool) return data
  const exists = data.tools.some((t) => t.id === tool.id)
  return {
    ...data,
    tools: exists ? data.tools.map((t) => (t.id === tool.id ? tool : t)) : [...data.tools, tool]
  }
}

/**
 * Remove a tool from the library. Tasks that used it keep it as a plain,
 * unlinked tool with its last name, link and icon, so nothing on them breaks.
 */
function removeLibraryTool(data: AppData, id: string): AppData {
  const tool = data.tools.find((t) => t.id === id)
  if (!tool) return data
  const detached = { ...tool, id: null }
  return {
    ...data,
    tools: data.tools.filter((t) => t.id !== id),
    tasks: data.tasks.map((task) =>
      task.tools.some((t) => t.id === id)
        ? { ...task, tools: task.tools.map((t) => (t.id === id ? detached : t)) }
        : task
    )
  }
}

/* ---------- categories & settings ---------- */

function upsertCategory(data: AppData, category: AppData['categories'][number]): AppData {
  const exists = data.categories.some((c) => c.id === category.id)
  return {
    ...data,
    categories: exists
      ? data.categories.map((c) => (c.id === category.id ? { ...c, ...category } : c))
      : [...data.categories, category]
  }
}

function removeCategory(data: AppData, id: string): AppData {
  return {
    ...data,
    categories: data.categories.filter((c) => c.id !== id),
    tasks: data.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
    events: data.events.map((e) => (e.categoryId === id ? { ...e, categoryId: null } : e))
  }
}

function updateSettings(data: AppData, patch: Partial<Settings>): AppData {
  const settings: Settings = { ...data.settings, ...patch }
  settings.focusMin = clampMinutes(settings.focusMin, data.settings.focusMin, 600)
  settings.breakMin = clampMinutes(settings.breakMin, data.settings.breakMin, 120)
  if (settings.bgColor !== null && !isHex(settings.bgColor)) settings.bgColor = data.settings.bgColor
  if (settings.surfaceColor !== null && !isHex(settings.surfaceColor)) settings.surfaceColor = data.settings.surfaceColor
  if (!isHex(settings.accent)) settings.accent = data.settings.accent
  let focus = data.focus
  // An untouched timer with no task follows the default session length.
  if (focus.status === 'idle' && focus.taskId === null) {
    const minutes = focus.phase === 'break' ? settings.breakMin : settings.focusMin
    focus = { ...focus, durationMs: minutes * MINUTE, remainingMs: minutes * MINUTE }
  }
  return { ...data, settings, focus }
}

/* ---------- focus timer ---------- */

/** Credit the running stretch to the focused task and freeze the countdown. */
function settle(data: AppData, now: number): AppData {
  const f = data.focus
  if (f.status !== 'running' || f.endsAt === null) return data
  const remaining = Math.max(0, f.endsAt - now)
  const focus: FocusState = { ...f, status: 'paused', remainingMs: remaining, endsAt: null, runStartedAt: null }
  if (f.phase !== 'focus' || !f.taskId || f.runStartedAt === null) return { ...data, focus }
  const worked = Math.max(0, Math.min(now, f.endsAt) - f.runStartedAt)
  return {
    ...data,
    focus,
    tasks: data.tasks.map((t) => (t.id === f.taskId ? { ...t, spentMs: t.spentMs + worked } : t))
  }
}

function setFocus(data: AppData, taskId: string | null, now: number): AppData {
  if (taskId === data.focus.taskId && data.focus.phase === 'focus') return data
  const settled = settle(data, now)
  if (taskId === null) return { ...settled, focus: idleFocus(data.settings.focusMin) }
  const task = settled.tasks.find((t) => t.id === taskId)
  if (!task) return data
  const tasks =
    task.status === 'done'
      ? settled.tasks.map((t) => (t.id === taskId ? { ...t, status: 'todo' as const, completedAt: null } : t))
      : settled.tasks
  return { ...settled, tasks, focus: { ...idleFocus(task.estimateMin), taskId } }
}

function startFocus(data: AppData, now: number): AppData {
  const f = data.focus
  if (f.status !== 'idle' && f.status !== 'paused') return data
  if (f.phase === 'focus' && !f.taskId) return data
  if (f.remainingMs <= 0) return data
  return {
    ...data,
    focus: { ...f, status: 'running', endsAt: now + f.remainingMs, runStartedAt: now }
  }
}

function pauseFocus(data: AppData, now: number): AppData {
  return data.focus.status === 'running' ? settle(data, now) : data
}

function resetFocus(data: AppData, now: number): AppData {
  const settled = settle(data, now)
  const f = settled.focus
  return {
    ...settled,
    focus: { ...f, status: 'idle', remainingMs: f.durationMs, endsAt: null, runStartedAt: null }
  }
}

function completeFocus(data: AppData, now: number): AppData {
  const taskId = data.focus.taskId
  if (data.focus.phase !== 'focus' || !taskId) return data
  const settled = settle(data, now)
  return {
    ...settled,
    tasks: settled.tasks.map((t) => (t.id === taskId ? { ...t, status: 'done', completedAt: now } : t)),
    // Offer a break: an idle break countdown the user can start or skip.
    focus: { ...idleFocus(data.settings.breakMin), phase: 'break' }
  }
}

function extendFocus(data: AppData, minutes: number, now: number): AppData {
  const add = clampMinutes(minutes, 5, 240) * MINUTE
  const f = data.focus
  if (f.status === 'running' && f.endsAt !== null) {
    return { ...data, focus: { ...f, endsAt: f.endsAt + add, durationMs: f.durationMs + add } }
  }
  if (f.status === 'finished') {
    // Out of time but not done: keep going straight away.
    return {
      ...data,
      focus: {
        ...f,
        status: 'running',
        durationMs: f.durationMs + add,
        remainingMs: add,
        endsAt: now + add,
        runStartedAt: now
      }
    }
  }
  return { ...data, focus: { ...f, durationMs: f.durationMs + add, remainingMs: f.remainingMs + add } }
}

function startBreak(data: AppData, now: number): AppData {
  const settled = settle(data, now)
  const base = { ...idleFocus(data.settings.breakMin), phase: 'break' as const }
  return { ...settled, focus: { ...base, status: 'running', endsAt: now + base.remainingMs, runStartedAt: now } }
}

function tickFocus(data: AppData, now: number): AppData {
  const f = data.focus
  if (f.status !== 'running' || f.endsAt === null || now < f.endsAt) return data
  const settled = settle(data, now)
  return { ...settled, focus: { ...settled.focus, status: 'finished', remainingMs: 0 } }
}

/* ---------- selectors ---------- */

export function sortedTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.order - b.order)
}

export function focusedTask(data: AppData): Task | null {
  if (!data.focus.taskId) return null
  return data.tasks.find((t) => t.id === data.focus.taskId) ?? null
}

/**
 * Events that should raise a "starting soon" reminder at `now`.
 * `seen` holds keys already notified so a reminder fires once per event start time.
 */
export function dueReminders(
  events: CalendarEvent[],
  now: number,
  seen: Set<string>,
  leadMs = 5 * MINUTE
): CalendarEvent[] {
  const due: CalendarEvent[] = []
  for (const e of events) {
    const start = Date.parse(e.start)
    if (Number.isNaN(start)) continue
    const until = start - now
    if (until <= 0 || until > leadMs) continue
    const key = `${e.id}:${start}`
    if (seen.has(key)) continue
    seen.add(key)
    due.push(e)
  }
  return due
}
