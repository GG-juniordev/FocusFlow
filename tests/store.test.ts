import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultData } from '@shared/defaults'
import { applyAction } from '@shared/model'
import { MINUTE } from '@shared/time'
import { Controller } from '../src/main/controller'
import { JsonStore, normalize } from '../src/main/store'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'focusflow-test-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const meta = () => ({ window: {}, trayHintShown: false })

describe('JsonStore', () => {
  it('starts fresh with seeded categories when nothing is on disk', () => {
    const loaded = new JsonStore(dir).load()
    expect(loaded.source).toBe('fresh')
    expect(loaded.data.categories.map((c) => c.name)).toEqual(['Work', 'Study', 'Personal'])
    expect(loaded.data.settings.launchAtStartup).toBe(true)
  })

  it('round-trips data through the file', () => {
    const store = new JsonStore(dir)
    const data = applyAction(defaultData(), { type: 'task/upsert', task: { id: 'a', title: 'Persist me' } }, 1000)
    store.save(data, meta())
    store.flush()

    const loaded = new JsonStore(dir).load()
    expect(loaded.source).toBe('file')
    expect(loaded.data.tasks).toHaveLength(1)
    expect(loaded.data.tasks[0].title).toBe('Persist me')
    expect(fs.existsSync(path.join(dir, 'data.json.tmp'))).toBe(false)
  })

  it('collapses rapid saves into one write of the latest state', async () => {
    const store = new JsonStore(dir, 20)
    let data = defaultData()
    for (const title of ['one', 'two', 'three']) {
      data = applyAction(data, { type: 'task/upsert', task: { id: title, title } }, 1000)
      store.save(data, meta())
    }
    expect(fs.existsSync(store.file)).toBe(false)
    await new Promise((r) => setTimeout(r, 80))
    expect(new JsonStore(dir).load().data.tasks).toHaveLength(3)
  })

  it('recovers from a corrupt file using the backup, keeping the bad file aside', () => {
    const store = new JsonStore(dir)
    const data = applyAction(defaultData(), { type: 'task/upsert', task: { id: 'a', title: 'Survivor' } }, 1000)
    store.save(data, meta())
    store.flush()
    new JsonStore(dir).load() // a clean load refreshes the backup

    fs.writeFileSync(store.file, '{"data": {"tasks": [{"id": "a", "ti', 'utf8')
    const loaded = new JsonStore(dir).load()
    expect(loaded.source).toBe('backup')
    expect(loaded.data.tasks[0].title).toBe('Survivor')
    expect(fs.readdirSync(dir).some((f) => f.startsWith('data.corrupt-'))).toBe(true)
  })

  it('falls back to defaults when both file and backup are unreadable', () => {
    fs.writeFileSync(path.join(dir, 'data.json'), 'not json', 'utf8')
    fs.writeFileSync(path.join(dir, 'data.bak.json'), '', 'utf8')
    expect(new JsonStore(dir).load().source).toBe('fresh')
  })
})

describe('normalize', () => {
  it('fills in missing fields and drops malformed records', () => {
    const { data } = normalize(
      {
        data: {
          tasks: [{ id: 'a', title: 'Ok', priority: 'urgent', categoryId: 'gone' }, { id: 'b' }, 'junk'],
          events: [
            { id: 'e', title: 'Fine', start: '2026-11-16T09:00:00Z', end: '2026-11-16T10:00:00Z', taskId: 'missing' },
            { id: 'bad', title: 'Backwards', start: '2026-11-16T10:00:00Z', end: '2026-11-16T09:00:00Z' }
          ],
          settings: { theme: 'neon', accent: 'red', focusMin: 99999 }
        }
      },
      0
    )
    expect(data.tasks).toHaveLength(1)
    expect(data.tasks[0]).toMatchObject({ priority: 'medium', categoryId: null, status: 'todo' })
    expect(data.events).toHaveLength(1)
    expect(data.events[0].taskId).toBeNull()
    expect(data.settings).toMatchObject({ theme: 'dark', accent: '#F0A63A', focusMin: 600, language: 'en' })
  })

  it('resumes a timer that was running at shutdown as paused, without counting time while closed', () => {
    const savedAt = 1_000_000
    const { data } = normalize(
      {
        savedAt,
        data: {
          tasks: [{ id: 'a', title: 'Task' }],
          focus: {
            taskId: 'a',
            phase: 'focus',
            status: 'running',
            durationMs: 30 * MINUTE,
            endsAt: savedAt + 12 * MINUTE,
            runStartedAt: savedAt - 18 * MINUTE
          }
        }
      },
      savedAt + 500 * MINUTE
    )
    expect(data.focus).toMatchObject({ status: 'paused', remainingMs: 12 * MINUTE, endsAt: null, taskId: 'a' })
  })

  it('drops focus on a task that no longer exists', () => {
    const { data } = normalize({ data: { focus: { taskId: 'ghost', phase: 'focus', status: 'paused' } } }, 0)
    expect(data.focus).toMatchObject({ taskId: null, status: 'idle' })
  })
})

describe('Controller', () => {
  it('applies actions, notifies subscribers and persists', () => {
    const store = new JsonStore(dir)
    const controller = new Controller(store)
    const seen: number[] = []
    controller.subscribe((next) => seen.push(next.tasks.length))

    controller.dispatch({ type: 'task/upsert', task: { id: 'a', title: 'One' } })
    controller.dispatch({ type: 'task/upsert', task: { id: 'b', title: '  ' } }) // no-op: not announced
    controller.flush()

    expect(seen).toEqual([1])
    expect(new JsonStore(dir).load().data.tasks.map((t) => t.title)).toEqual(['One'])
    controller.dispose()
  })

  it('finishes a running session on its own when time runs out', async () => {
    const controller = new Controller(new JsonStore(dir))
    controller.dispatch({ type: 'task/upsert', task: { id: 'a', title: 'Short' } })
    controller.dispatch({ type: 'focus/set', taskId: 'a' })
    // Shrink the session to 40ms so the test does not wait a real minute.
    controller.data = { ...controller.data, focus: { ...controller.data.focus, durationMs: 40, remainingMs: 40 } }

    const finished = new Promise<void>((resolve) => {
      controller.subscribe((next, prev) => {
        if (prev.focus.status === 'running' && next.focus.status === 'finished') resolve()
      })
    })
    controller.dispatch({ type: 'focus/start' })
    await finished
    expect(controller.data.focus.status).toBe('finished')
    controller.dispose()
  })
})
