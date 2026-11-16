import type { Subtask } from './types'

export const MAX_SUBTASKS = 50
const MAX_TITLE = 200

/**
 * Validate a task's checklist from the UI, disk or the cloud: drop junk and
 * duplicate ids, keep the given order, and renumber positions 0..n-1.
 */
export function sanitizeSubtasks(raw: unknown): Subtask[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const items: Subtask[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id.slice(0, 80) : ''
    const title = typeof r.title === 'string' ? r.title.trim().slice(0, MAX_TITLE) : ''
    if (!id || !title || seen.has(id)) continue
    seen.add(id)
    items.push({
      id,
      title,
      isCompleted: r.isCompleted === true,
      position: typeof r.position === 'number' && Number.isFinite(r.position) ? r.position : items.length
    })
    if (items.length >= MAX_SUBTASKS) break
  }
  return items
    .map((s, index) => ({ s, index }))
    .sort((a, b) => a.s.position - b.s.position || a.index - b.index)
    .map(({ s }, position) => ({ ...s, position }))
}

export function subtaskProgress(subtasks: Subtask[]): { done: number; total: number } {
  return { done: subtasks.filter((s) => s.isCompleted).length, total: subtasks.length }
}
