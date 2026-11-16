import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultData } from '@shared/defaults'
import { applyAction, sortedTasks } from '@shared/model'
import { contrast, customPalette, readableAccent, THEME_DEFAULTS } from '@shared/palette'
import { sanitizeSubtasks, subtaskProgress } from '@shared/subtasks'
import type { AppData, Subtask } from '@shared/types'
import { Controller } from '../src/main/controller'
import { JsonStore, normalize } from '../src/main/store'
import { SyncEngine } from '../src/main/sync/engine'
import type { Remote } from '../src/main/sync/core'

const step = (id: string, title: string, position: number, isCompleted = false): Subtask => ({ id, title, isCompleted, position })
const STEPS = [step('s1', 'Outline', 0), step('s2', 'Draft', 1), step('s3', 'Review', 2)]
const google = { id: 'builtin-google', label: 'Google', url: 'https://www.google.com', preset: 'google', icon: null }

function withTask(): AppData {
  return applyAction(defaultData(), { type: 'task/upsert', task: { id: 't', title: 'Essay', subtasks: STEPS, tools: [google] } }, 0)
}

describe('checklist data', () => {
  it('drops junk and duplicates, and renumbers positions in order', () => {
    const clean = sanitizeSubtasks([
      { id: 'b', title: 'Second', position: 5 },
      { id: 'a', title: '  First  ', position: 1, isCompleted: true },
      { id: 'a', title: 'Duplicate id' },
      { id: 'c', title: '   ' },
      { title: 'No id' },
      'nope'
    ])
    expect(clean).toEqual([step('a', 'First', 0, true), step('b', 'Second', 1)])
    expect(sanitizeSubtasks(undefined)).toEqual([])
    expect(subtaskProgress(clean)).toEqual({ done: 1, total: 2 })
  })

  it('is stored on a new task and kept when other fields are edited', () => {
    let d = withTask()
    expect(d.tasks[0].subtasks.map((s) => s.title)).toEqual(['Outline', 'Draft', 'Review'])
    d = applyAction(d, { type: 'task/upsert', task: { id: 't', priority: 'high', title: 'Essay v2' } }, 0)
    expect(d.tasks[0].subtasks).toHaveLength(3)
    expect(d.tasks[0].tools).toHaveLength(1)
  })

  it('ticks one step without touching the others', () => {
    let d = applyAction(withTask(), { type: 'task/toggleSubtask', taskId: 't', subtaskId: 's2' }, 0)
    expect(d.tasks[0].subtasks.map((s) => s.isCompleted)).toEqual([false, true, false])
    d = applyAction(d, { type: 'task/toggleSubtask', taskId: 't', subtaskId: 's2' }, 0)
    expect(d.tasks[0].subtasks.map((s) => s.isCompleted)).toEqual([false, false, false])
    // Unknown ids change nothing.
    expect(applyAction(d, { type: 'task/toggleSubtask', taskId: 't', subtaskId: 'nope' }, 0)).toBe(d)
    expect(applyAction(d, { type: 'task/toggleSubtask', taskId: 'nope', subtaskId: 's1' }, 0)).toBe(d)
  })

  it('reorders, renames and removes steps through the task form', () => {
    const d = applyAction(
      withTask(),
      { type: 'task/upsert', task: { id: 't', subtasks: [step('s3', 'Review twice', 0), step('s1', 'Outline', 1)] } },
      0
    )
    expect(d.tasks[0].subtasks).toEqual([step('s3', 'Review twice', 0), step('s1', 'Outline', 1)])
  })
})

describe('task operations never lose or duplicate steps and tools', () => {
  const snapshot = (d: AppData, id: string) => {
    const t = d.tasks.find((x) => x.id === id)!
    return { steps: t.subtasks.map((s) => s.id), tools: t.tools.map((x) => x.label) }
  }
  const expected = { steps: ['s1', 's2', 's3'], tools: ['Google'] }

  it('completing, reopening and focusing', () => {
    let d = withTask()
    d = applyAction(d, { type: 'task/setStatus', id: 't', status: 'done' }, 1)
    d = applyAction(d, { type: 'task/setStatus', id: 't', status: 'todo' }, 2)
    d = applyAction(d, { type: 'focus/set', taskId: 't' }, 3)
    d = applyAction(d, { type: 'focus/start' }, 4)
    d = applyAction(d, { type: 'focus/complete' }, 5)
    expect(d.tasks).toHaveLength(1)
    expect(snapshot(d, 't')).toEqual(expected)
  })

  it('drag-and-drop reordering', () => {
    let d = withTask()
    d = applyAction(d, { type: 'task/upsert', task: { id: 'u', title: 'Other' } }, 0)
    d = applyAction(d, { type: 'task/reorder', ids: ['u', 't'] }, 0)
    expect(sortedTasks(d.tasks).map((x) => x.id)).toEqual(['u', 't'])
    expect(d.tasks).toHaveLength(2)
    expect(snapshot(d, 't')).toEqual(expected)
  })

  it('saving the same form twice does not create a second task', () => {
    let d = withTask()
    d = applyAction(d, { type: 'task/upsert', task: { id: 't', title: 'Essay', subtasks: STEPS, tools: [google, google] } }, 0)
    expect(d.tasks).toHaveLength(1)
    expect(snapshot(d, 't')).toEqual(expected)
  })

  it('deleting a task removes only that task', () => {
    let d = withTask()
    d = applyAction(d, { type: 'task/upsert', task: { id: 'u', title: 'Other', subtasks: [step('x', 'Keep me', 0)] } }, 0)
    d = applyAction(d, { type: 'task/remove', id: 't' }, 0)
    expect(d.tasks.map((x) => x.id)).toEqual(['u'])
    expect(d.tasks[0].subtasks).toHaveLength(1)
  })
})

describe('persistence and sync', () => {
  it('tasks saved before checklists existed load with an empty one', () => {
    const { data } = normalize({ data: { tasks: [{ id: 'old', title: 'Old task' }] } }, 0)
    expect(data.tasks[0].subtasks).toEqual([])
  })

  it('steps survive a save and reload, and a round trip through the cloud', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'focusflow-steps-'))
    try {
      const rows = new Map<string, { updatedAt: string; record: unknown; n: number }>()
      let n = 0
      const remote: Remote = {
        pull: async (table, since) =>
          [...rows.entries()]
            .filter(([k, r]) => k.startsWith(table + '/') && (!since || String(r.n).padStart(6, '0') > since))
            .sort((a, b) => a[1].n - b[1].n)
            .map(([k, r]) => ({ id: k.split('/')[1], updatedAt: r.updatedAt, deletedAt: null, syncedAt: String(r.n).padStart(6, '0'), record: r.record as never })),
        upsert: async (table, batch) => {
          for (const r of batch) rows.set(`${table}/${r.id}`, { updatedAt: r.updatedAt, record: JSON.parse(JSON.stringify(r.record)), n: ++n })
        },
        remove: async () => {}
      }
      const a = new Controller(new JsonStore(dir))
      const engineA = new SyncEngine(a, { configured: true })
      a.dispatch({ type: 'task/upsert', task: { id: 't', title: 'Essay', subtasks: STEPS } })
      a.dispatch({ type: 'task/toggleSubtask', taskId: 't', subtaskId: 's1' })
      a.flush()
      expect(new JsonStore(dir).load().data.tasks[0].subtasks.map((s) => s.isCompleted)).toEqual([true, false, false])

      engineA.setUser({ id: 'u', email: null }, remote)
      await engineA.choose('merge')

      const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'focusflow-steps-'))
      const b = new Controller(new JsonStore(dirB))
      const engineB = new SyncEngine(b, { configured: true })
      engineB.setUser({ id: 'u', email: null }, remote)
      await engineB.syncNow()
      expect(b.data.tasks[0].subtasks).toEqual([step('s1', 'Outline', 0, true), step('s2', 'Draft', 1), step('s3', 'Review', 2)])
      fs.rmSync(dirB, { recursive: true, force: true })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('accent colour as text', () => {
  it('stays readable for any accent on every built-in and custom background', () => {
    const palettes = [THEME_DEFAULTS.dark, THEME_DEFAULTS.light, customPalette('#000000', null), customPalette('#0d1430', '#172045'), customPalette('#f3ede1', '#fffaf0')]
    for (const accent of ['#0044b3', '#F0A63A', '#000000', '#ffffff', '#5DBB63', '#101a17']) {
      for (const p of palettes) {
        const text = readableAccent(accent, p)
        expect(Math.min(contrast(text, p.bg), contrast(text, p.surface)), `${accent} on ${p.bg}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('leaves an already-readable accent alone', () => {
    expect(readableAccent('#f0a63a', THEME_DEFAULTS.dark)).toBe('#f0a63a')
  })
})
