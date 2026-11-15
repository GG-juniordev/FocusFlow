import { describe, expect, it } from 'vitest'
import { defaultData } from '@shared/defaults'
import { applyAction, dueReminders, sortedTasks } from '@shared/model'
import { MINUTE, formatClock, formatDuration, remainingMs } from '@shared/time'
import type { Action, AppData, CalendarEvent } from '@shared/types'

const T0 = Date.UTC(2026, 10, 16, 9, 0, 0)

function run(data: AppData, steps: [Action, number][]): AppData {
  return steps.reduce((d, [action, at]) => applyAction(d, action, at), data)
}

function withTasks(...titles: string[]): AppData {
  return titles.reduce(
    (d, title, i) => applyAction(d, { type: 'task/upsert', task: { id: `t${i + 1}`, title } }, T0),
    defaultData()
  )
}

describe('time formatting', () => {
  it('formats durations', () => {
    expect(formatDuration(15)).toBe('15m')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(90)).toBe('1h 30m')
    expect(formatDuration(120)).toBe('2h')
  })

  it('formats the countdown, rounding up so 00:00 only shows at zero', () => {
    expect(formatClock(25 * MINUTE)).toBe('25:00')
    expect(formatClock(59_001)).toBe('01:00')
    expect(formatClock(1)).toBe('00:01')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(-500)).toBe('00:00')
    expect(formatClock(65 * MINUTE)).toBe('1:05:00')
  })
})

describe('tasks', () => {
  it('creates a task with defaults and ignores blank titles', () => {
    const d = withTasks('Write report')
    expect(d.tasks).toHaveLength(1)
    expect(d.tasks[0]).toMatchObject({ title: 'Write report', priority: 'medium', status: 'todo', estimateMin: 25 })
    const same = applyAction(d, { type: 'task/upsert', task: { id: 'x', title: '   ' } }, T0)
    expect(same.tasks).toHaveLength(1)
  })

  it('edits without losing fields and keeps the title when blanked', () => {
    let d = withTasks('A')
    d = applyAction(d, { type: 'task/upsert', task: { id: 't1', priority: 'high', estimateMin: 45 } }, T0)
    d = applyAction(d, { type: 'task/upsert', task: { id: 't1', title: '' } }, T0)
    expect(d.tasks[0]).toMatchObject({ title: 'A', priority: 'high', estimateMin: 45 })
  })

  it('reorders listed tasks and keeps the rest after them', () => {
    let d = withTasks('A', 'B', 'C', 'D')
    d = applyAction(d, { type: 'task/reorder', ids: ['t3', 't1'] }, T0)
    expect(sortedTasks(d.tasks).map((t) => t.id)).toEqual(['t3', 't1', 't2', 't4'])
  })

  it('removing a task unlinks its time blocks and clears focus', () => {
    let d = withTasks('A')
    d = run(d, [
      [{ type: 'event/upsert', event: { id: 'e1', title: 'A', start: iso(60), end: iso(90), taskId: 't1' } }, T0],
      [{ type: 'focus/set', taskId: 't1' }, T0],
      [{ type: 'task/remove', id: 't1' }, T0]
    ])
    expect(d.tasks).toHaveLength(0)
    expect(d.events[0].taskId).toBeNull()
    expect(d.focus.taskId).toBeNull()
  })

  it('removing a category clears it from tasks and events', () => {
    let d = withTasks('A')
    d = run(d, [
      [{ type: 'task/upsert', task: { id: 't1', categoryId: 'cat-work' } }, T0],
      [{ type: 'category/remove', id: 'cat-work' }, T0]
    ])
    expect(d.tasks[0].categoryId).toBeNull()
    expect(d.categories.some((c) => c.id === 'cat-work')).toBe(false)
  })
})

const iso = (minutesFromT0: number): string => new Date(T0 + minutesFromT0 * MINUTE).toISOString()

describe('calendar', () => {
  it('rejects blocks without a title and repairs an end before the start', () => {
    let d = defaultData()
    d = applyAction(d, { type: 'event/upsert', event: { id: 'e1', title: '', start: iso(0), end: iso(30) } }, T0)
    expect(d.events).toHaveLength(0)
    d = applyAction(d, { type: 'event/upsert', event: { id: 'e1', title: 'Call', start: iso(60), end: iso(30) } }, T0)
    expect(Date.parse(d.events[0].end) - Date.parse(d.events[0].start)).toBe(15 * MINUTE)
  })

  it('moving a block changes only its times', () => {
    let d = defaultData()
    d = applyAction(d, { type: 'event/upsert', event: { id: 'e1', title: 'Call', start: iso(0), end: iso(30) } }, T0)
    d = applyAction(d, { type: 'event/upsert', event: { id: 'e1', start: iso(120), end: iso(180) } }, T0)
    expect(d.events[0]).toMatchObject({ title: 'Call', start: iso(120), end: iso(180) })
  })

  it('time-blocking a task gives it a date; converting a block makes a linked task', () => {
    let d = withTasks('A')
    d = applyAction(
      d,
      { type: 'event/upsert', event: { id: 'e1', title: 'A', start: iso(0), end: iso(25), taskId: 't1' } },
      T0
    )
    const firstDay = d.tasks[0].dueDate
    expect(firstDay).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // Moving the block to another day takes the task's date with it...
    d = applyAction(d, { type: 'event/upsert', event: { id: 'e1', start: iso(48 * 60), end: iso(48 * 60 + 25) } }, T0)
    expect(d.tasks[0].dueDate).not.toBe(firstDay)
    // ...unless the user set a different date themselves.
    d = applyAction(d, { type: 'task/upsert', task: { id: 't1', dueDate: '2027-01-01' } }, T0)
    d = applyAction(d, { type: 'event/upsert', event: { id: 'e1', start: iso(96 * 60), end: iso(96 * 60 + 25) } }, T0)
    expect(d.tasks[0].dueDate).toBe('2027-01-01')

    d = applyAction(d, { type: 'event/upsert', event: { id: 'e2', title: 'Dentist', start: iso(60), end: iso(150) } }, T0)
    d = applyAction(d, { type: 'event/toTask', id: 'e2', taskId: 'new' }, T0)
    const made = d.tasks.find((t) => t.id === 'new')
    expect(made).toMatchObject({ title: 'Dentist', estimateMin: 90 })
    expect(d.events.find((e) => e.id === 'e2')?.taskId).toBe('new')
    // Converting twice must not create a second task.
    const again = applyAction(d, { type: 'event/toTask', id: 'e2', taskId: 'dup' }, T0)
    expect(again.tasks).toHaveLength(d.tasks.length)
  })
})

describe('focus timer', () => {
  const focused = (estimateMin = 30): AppData =>
    run(withTasks('A', 'B'), [
      [{ type: 'task/upsert', task: { id: 't1', estimateMin } }, T0],
      [{ type: 'focus/set', taskId: 't1' }, T0]
    ])

  it('loads the task estimate into the timer', () => {
    const d = focused(30)
    expect(d.focus).toMatchObject({ taskId: 't1', status: 'idle', durationMs: 30 * MINUTE, remainingMs: 30 * MINUTE })
  })

  it('will not start without a task', () => {
    const d = applyAction(defaultData(), { type: 'focus/start' }, T0)
    expect(d.focus.status).toBe('idle')
  })

  it('counts down only while running, across pause and resume', () => {
    let d = focused(30)
    d = applyAction(d, { type: 'focus/start' }, T0)
    expect(remainingMs(d.focus, T0 + 10 * MINUTE)).toBe(20 * MINUTE)

    d = applyAction(d, { type: 'focus/pause' }, T0 + 10 * MINUTE)
    expect(d.focus.status).toBe('paused')
    // An hour passes while paused: nothing is lost.
    expect(remainingMs(d.focus, T0 + 70 * MINUTE)).toBe(20 * MINUTE)

    d = applyAction(d, { type: 'focus/start' }, T0 + 70 * MINUTE)
    expect(remainingMs(d.focus, T0 + 75 * MINUTE)).toBe(15 * MINUTE)
    expect(d.tasks[0].spentMs).toBe(10 * MINUTE)
  })

  it('finishes on tick once time is up, and not before', () => {
    let d = applyAction(focused(30), { type: 'focus/start' }, T0)
    d = applyAction(d, { type: 'focus/tick' }, T0 + 29 * MINUTE)
    expect(d.focus.status).toBe('running')
    d = applyAction(d, { type: 'focus/tick' }, T0 + 30 * MINUTE)
    expect(d.focus).toMatchObject({ status: 'finished', remainingMs: 0 })
    expect(d.tasks[0].spentMs).toBe(30 * MINUTE)
  })

  it('does not credit time past the end of the session (e.g. the PC slept)', () => {
    let d = applyAction(focused(30), { type: 'focus/start' }, T0)
    d = applyAction(d, { type: 'focus/tick' }, T0 + 300 * MINUTE)
    expect(d.tasks[0].spentMs).toBe(30 * MINUTE)
  })

  it('reset restores the full duration', () => {
    let d = run(focused(30), [
      [{ type: 'focus/start' }, T0],
      [{ type: 'focus/reset' }, T0 + 5 * MINUTE]
    ])
    expect(d.focus).toMatchObject({ status: 'idle', remainingMs: 30 * MINUTE, endsAt: null })
    d = applyAction(d, { type: 'focus/extend', minutes: 5 }, T0)
    expect(d.focus.remainingMs).toBe(35 * MINUTE)
  })

  it('extending a finished session resumes it', () => {
    let d = run(focused(30), [
      [{ type: 'focus/start' }, T0],
      [{ type: 'focus/tick' }, T0 + 30 * MINUTE],
      [{ type: 'focus/extend', minutes: 5 }, T0 + 31 * MINUTE]
    ])
    expect(d.focus.status).toBe('running')
    expect(remainingMs(d.focus, T0 + 31 * MINUTE)).toBe(5 * MINUTE)
    d = applyAction(d, { type: 'focus/tick' }, T0 + 36 * MINUTE)
    expect(d.tasks[0].spentMs).toBe(35 * MINUTE)
  })

  it('complete marks the task done, records time and offers a break', () => {
    const d = run(focused(30), [
      [{ type: 'focus/start' }, T0],
      [{ type: 'focus/complete' }, T0 + 12 * MINUTE]
    ])
    expect(d.tasks[0]).toMatchObject({ status: 'done', spentMs: 12 * MINUTE, completedAt: T0 + 12 * MINUTE })
    expect(d.focus).toMatchObject({ phase: 'break', status: 'idle', taskId: null, durationMs: 5 * MINUTE })
  })

  it('runs and ends a break', () => {
    let d = run(focused(30), [
      [{ type: 'focus/complete' }, T0],
      [{ type: 'focus/startBreak' }, T0]
    ])
    expect(d.focus).toMatchObject({ phase: 'break', status: 'running' })
    d = applyAction(d, { type: 'focus/tick' }, T0 + 5 * MINUTE)
    expect(d.focus).toMatchObject({ phase: 'break', status: 'finished' })
    d = applyAction(d, { type: 'focus/endBreak' }, T0 + 6 * MINUTE)
    expect(d.focus).toMatchObject({ phase: 'focus', status: 'idle', taskId: null })
  })

  it('switching focus mid-run credits the first task', () => {
    const d = run(focused(30), [
      [{ type: 'focus/start' }, T0],
      [{ type: 'focus/set', taskId: 't2' }, T0 + 7 * MINUTE]
    ])
    expect(d.tasks.find((t) => t.id === 't1')?.spentMs).toBe(7 * MINUTE)
    expect(d.focus).toMatchObject({ taskId: 't2', status: 'idle' })
  })

  it('an untouched timer follows a changed estimate; a started one does not', () => {
    let d = focused(30)
    d = applyAction(d, { type: 'task/upsert', task: { id: 't1', estimateMin: 60 } }, T0)
    expect(d.focus.remainingMs).toBe(60 * MINUTE)
    d = applyAction(d, { type: 'focus/start' }, T0)
    d = applyAction(d, { type: 'task/upsert', task: { id: 't1', estimateMin: 15 } }, T0 + MINUTE)
    expect(d.focus.durationMs).toBe(60 * MINUTE)
  })
})

describe('settings', () => {
  it('clamps durations and ignores nonsense', () => {
    let d = applyAction(defaultData(), { type: 'settings/update', patch: { focusMin: 5000, breakMin: 0 } }, T0)
    expect(d.settings.focusMin).toBe(600)
    expect(d.settings.breakMin).toBe(5)
    d = applyAction(d, { type: 'settings/update', patch: { focusMin: Number.NaN } }, T0)
    expect(d.settings.focusMin).toBe(600)
  })
})

describe('event reminders', () => {
  const event = (id: string, startMin: number): CalendarEvent => ({
    id,
    title: id,
    notes: '',
    start: iso(startMin),
    end: iso(startMin + 30),
    categoryId: null,
    taskId: null
  })

  it('fires once, inside the five minutes before the start', () => {
    const seen = new Set<string>()
    const events = [event('soon', 4), event('later', 20), event('past', -1)]
    expect(dueReminders(events, T0, seen).map((e) => e.id)).toEqual(['soon'])
    expect(dueReminders(events, T0 + 20_000, seen)).toEqual([])
    expect(dueReminders(events, T0 + 16 * MINUTE, seen).map((e) => e.id)).toEqual(['later'])
  })

  it('fires again if the event is moved to a new time', () => {
    const seen = new Set<string>()
    expect(dueReminders([event('a', 3)], T0, seen)).toHaveLength(1)
    expect(dueReminders([event('a', 63)], T0 + 59 * MINUTE, seen)).toHaveLength(1)
  })
})
