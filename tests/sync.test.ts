import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Controller } from '../src/main/controller'
import { JsonStore } from '../src/main/store'
import { SETTINGS_ID, type PushBatch, type Remote, type RemoteRow, type SyncRecord, type Table } from '../src/main/sync/core'
import { SyncEngine, SyncError } from '../src/main/sync/engine'
import { fromRow, toRow } from '../src/main/sync/rows'

/**
 * An in-memory stand-in for the cloud tables, behaving like supabase/schema.sql:
 * rows keyed by (user, id), a server-assigned sync position, soft deletes, and
 * the guard that refuses to overwrite a row with an older one.
 * Records pass through the real row mapping, so that is exercised too.
 */
class FakeCloud {
  private seq = 0
  rows = new Map<string, { table: Table; user: string; row: Record<string, unknown> }>()
  offline = false

  private position(): string {
    return new Date(Date.UTC(2030, 0, 1) + ++this.seq).toISOString()
  }

  for(user: string): Remote {
    const check = (): void => {
      if (this.offline) throw new SyncError('network', 'fetch failed')
    }
    const key = (table: Table, id: string): string => `${user}/${table}/${id}`
    return {
      pull: async (table, since) => {
        check()
        return [...this.rows.values()]
          .filter((r) => r.table === table && r.user === user && (!since || String(r.row.synced_at) > since))
          .sort((a, b) => String(a.row.synced_at).localeCompare(String(b.row.synced_at)))
          .map((r) => fromRow(table, r.row))
          .filter((r): r is RemoteRow => r !== null)
      },
      upsert: async (table, rows: PushBatch['upserts']) => {
        check()
        for (const r of rows) {
          const existing = this.rows.get(key(table, r.id))
          if (existing && Date.parse(String(existing.row.updated_at)) > Date.parse(r.updatedAt)) continue
          const row = { ...toRow(table, user, r.id, r.updatedAt, r.record), synced_at: this.position() }
          this.rows.set(key(table, r.id), { table, user, row })
        }
      },
      remove: async (table, rows: PushBatch['removes']) => {
        check()
        for (const r of rows) {
          const existing = this.rows.get(key(table, r.id))
          if (!existing || Date.parse(String(existing.row.updated_at)) > Date.parse(r.deletedAt)) continue
          existing.row = { ...existing.row, deleted_at: r.deletedAt, updated_at: r.deletedAt, synced_at: this.position() }
        }
      }
    }
  }

  live(user: string, table: Table): Record<string, unknown>[] {
    return [...this.rows.values()].filter((r) => r.user === user && r.table === table && !r.row.deleted_at).map((r) => r.row)
  }
}

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

/** One PC: its own data folder, controller and sync engine. */
function device(dir?: string) {
  const folder = dir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'focusflow-sync-'))
  if (!dir) dirs.push(folder)
  const controller = new Controller(new JsonStore(folder))
  const engine = new SyncEngine(controller, { configured: true })
  const add = (id: string, title: string): void => controller.dispatch({ type: 'task/upsert', task: { id, title } })
  const titles = (): string[] => controller.data.tasks.map((t) => t.title).sort()
  return { folder, controller, engine, add, titles }
}

const ALICE = { id: 'alice', email: 'alice@example.com' }
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 3))

describe('guest mode', () => {
  it('works with no account and queues nothing', () => {
    const pc = device()
    pc.add('t1', 'Local only')
    expect(pc.engine.state).toMatchObject({ phase: 'local', user: null, pending: 0 })
    expect(pc.controller.meta.sync.userId).toBeNull()
    // The change time is still recorded, so a later merge knows what is newer.
    expect(pc.controller.meta.sync.stamps.tasks.t1).toBeTruthy()
  })
})

describe('first sign-in', () => {
  it('asks before touching existing local work, then uploads it on "transfer & merge"', async () => {
    const cloud = new FakeCloud()
    const pc = device()
    pc.add('t1', 'Write report')
    pc.controller.dispatch({ type: 'event/upsert', event: { id: 'e1', title: 'Call', start: '2026-11-16T09:00:00Z', end: '2026-11-16T10:00:00Z' } })

    pc.engine.setUser(ALICE, cloud.for('alice'))
    expect(pc.engine.state).toMatchObject({ phase: 'choose', local: { tasks: 1, events: 1 } })
    expect(cloud.rows.size).toBe(0) // nothing leaves the PC until the user decides

    await pc.engine.choose('merge')
    expect(pc.engine.state).toMatchObject({ phase: 'synced', pending: 0 })
    expect(cloud.live('alice', 'tasks').map((r) => r.title)).toEqual(['Write report'])
    expect(cloud.live('alice', 'events')).toHaveLength(1)
    expect(cloud.live('alice', 'categories')).toHaveLength(3)
    expect(cloud.live('alice', 'tools').length).toBeGreaterThan(0)
    expect(cloud.live('alice', 'settings')).toHaveLength(1)
    expect(pc.controller.meta.sync.userId).toBe('alice')
  })

  it('links silently when there is no local work, and pulls the account down', async () => {
    const cloud = new FakeCloud()
    const a = device()
    a.add('t1', 'From the first PC')
    a.engine.setUser(ALICE, cloud.for('alice'))
    await a.engine.choose('merge')

    const b = device()
    b.engine.setUser(ALICE, cloud.for('alice'))
    await b.engine.syncNow()
    expect(b.engine.state.phase).toBe('synced')
    expect(b.titles()).toEqual(['From the first PC'])
  })

  it('merging never duplicates: same ids on both sides collapse, the newer copy wins', async () => {
    const cloud = new FakeCloud()
    const a = device()
    a.add('shared', 'Old title')
    a.engine.setUser(ALICE, cloud.for('alice'))
    await a.engine.choose('merge')

    // A second PC has the same task id (e.g. restored from a copy) with a newer edit, plus its own task.
    const b = device()
    await tick()
    b.add('shared', 'Newer title')
    b.add('only-b', 'Only on B')
    b.engine.setUser(ALICE, cloud.for('alice'))
    await b.engine.choose('merge')

    expect(b.titles()).toEqual(['Newer title', 'Only on B'])
    expect(cloud.live('alice', 'tasks').map((r) => r.title).sort()).toEqual(['Newer title', 'Only on B'])
    // Default categories and built-in tools exist on both PCs but only once in the cloud.
    expect(cloud.live('alice', 'categories')).toHaveLength(3)

    await a.engine.syncNow()
    expect(a.titles()).toEqual(['Newer title', 'Only on B'])
  })

  it('a newer cloud record is not overwritten by an older local one', async () => {
    const cloud = new FakeCloud()
    const b = device()
    b.add('shared', 'Stale local copy')
    await tick()
    const a = device()
    a.add('shared', 'Fresh cloud copy')
    a.engine.setUser(ALICE, cloud.for('alice'))
    await a.engine.choose('merge')

    b.engine.setUser(ALICE, cloud.for('alice'))
    await b.engine.choose('merge')
    expect(b.titles()).toEqual(['Fresh cloud copy'])
    expect(cloud.live('alice', 'tasks').map((r) => r.title)).toEqual(['Fresh cloud copy'])
  })

  it('"keep cloud only" replaces local data with the account, after saving a backup', async () => {
    const cloud = new FakeCloud()
    const a = device()
    a.add('t1', 'Cloud task')
    a.engine.setUser(ALICE, cloud.for('alice'))
    await a.engine.choose('merge')

    const b = device()
    b.add('local', 'Local task to discard')
    b.controller.flush()
    b.engine.setUser(ALICE, cloud.for('alice'))
    await b.engine.choose('cloud')

    expect(b.titles()).toEqual(['Cloud task'])
    expect(cloud.live('alice', 'tasks')).toHaveLength(1)
    const backup = fs.readdirSync(b.folder).find((f) => f.startsWith('data.before-cloud-'))
    expect(backup).toBeTruthy()
    expect(fs.readFileSync(path.join(b.folder, backup!), 'utf8')).toContain('Local task to discard')
  })

  it('"keep cloud only" on a brand-new account still leaves usable defaults', async () => {
    const cloud = new FakeCloud()
    const pc = device()
    pc.add('local', 'Discard me')
    pc.engine.setUser(ALICE, cloud.for('alice'))
    await pc.engine.choose('cloud')
    expect(pc.controller.data.tasks).toHaveLength(0)
    expect(pc.controller.data.categories).toHaveLength(3)
    expect(pc.controller.data.tools.length).toBeGreaterThan(0)
    expect(cloud.live('alice', 'categories')).toHaveLength(3)
  })
})

describe('staying in sync', () => {
  async function pair() {
    const cloud = new FakeCloud()
    const a = device()
    const b = device()
    a.engine.setUser(ALICE, cloud.for('alice'))
    b.engine.setUser(ALICE, cloud.for('alice'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    return { cloud, a, b }
  }

  it('nothing is sent or fetched until a sync is asked for', async () => {
    const { cloud, a, b } = await pair()
    const before = cloud.rows.size
    a.add('t1', 'Edited locally')
    a.controller.dispatch({ type: 'task/upsert', task: { id: 't1', notes: 'more edits' } })
    await new Promise((r) => setTimeout(r, 120))
    expect(cloud.rows.size).toBe(before)
    expect(a.engine.state).toMatchObject({ phase: 'pending', pending: 1 })
    expect(b.titles()).toEqual([])

    await a.engine.syncNow()
    expect(a.engine.state).toMatchObject({ phase: 'synced', pending: 0 })
    expect(a.engine.state.lastSyncedAt).toBeGreaterThan(0)
    // The other device also only changes when it syncs.
    await new Promise((r) => setTimeout(r, 60))
    expect(b.titles()).toEqual([])
    await b.engine.syncNow()
    expect(b.titles()).toEqual(['Edited locally'])
  })

  it('a session restored at startup does not sync by itself; a fresh sign-in does', async () => {
    const { cloud, a } = await pair()
    a.add('t1', 'Waiting')
    a.controller.flush()
    a.engine.dispose()
    const before = cloud.rows.size

    const restarted = device(a.folder)
    restarted.engine.setUser(ALICE, cloud.for('alice')) // restored session
    await new Promise((r) => setTimeout(r, 60))
    expect(cloud.rows.size).toBe(before)
    expect(restarted.engine.state).toMatchObject({ phase: 'pending', pending: 1 })

    restarted.engine.setUser(null, null)
    restarted.engine.setUser(ALICE, cloud.for('alice'), true) // the user just signed in
    await new Promise((r) => setTimeout(r, 60))
    expect(restarted.engine.state).toMatchObject({ phase: 'synced', pending: 0 })
  })

  it('edits, completions and deletions travel between devices', async () => {
    const { a, b } = await pair()
    a.add('t1', 'Task one')
    a.add('t2', 'Task two')
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect(b.titles()).toEqual(['Task one', 'Task two'])

    b.controller.dispatch({ type: 'task/setStatus', id: 't1', status: 'done' })
    b.controller.dispatch({ type: 'task/remove', id: 't2' })
    await b.engine.syncNow()
    await a.engine.syncNow()
    expect(a.controller.data.tasks.map((t) => [t.title, t.status])).toEqual([['Task one', 'done']])
  })

  it('settings, categories and tool icons sync; per-PC settings do not', async () => {
    const { a, b } = await pair()
    a.controller.dispatch({ type: 'settings/update', patch: { accent: '#4C8DF6', bgColor: '#0d1430', language: 'it', alwaysOnTop: true } })
    a.controller.dispatch({ type: 'category/upsert', category: { id: 'c9', name: 'Music', color: '#E0569B' } })
    a.controller.dispatch({ type: 'tool/upsert', tool: { id: 'x', label: 'Anki', url: null, preset: null, icon: { type: 'emoji', value: '🧠' } } })
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect(b.controller.data.settings).toMatchObject({ accent: '#4C8DF6', bgColor: '#0d1430', language: 'it', alwaysOnTop: false })
    expect(b.controller.data.categories.find((c) => c.id === 'c9')?.name).toBe('Music')
    expect(b.controller.data.tools.find((t) => t.id === 'x')?.icon).toEqual({ type: 'emoji', value: '🧠' })
  })

  it('queues changes while offline, survives a restart, and uploads once back online', async () => {
    const { cloud, a, b } = await pair()
    cloud.offline = true
    a.add('t1', 'Written offline')
    a.controller.dispatch({ type: 'task/upsert', task: { id: 't1', notes: 'edited offline' } })
    await a.engine.syncNow()
    expect(a.engine.state).toMatchObject({ phase: 'offline', error: 'network', pending: 1 })
    expect(a.titles()).toEqual(['Written offline']) // the app itself is unaffected

    // Close and reopen the app while still offline: the queue is on disk.
    a.controller.flush()
    a.engine.dispose()
    const reopened = device(a.folder)
    reopened.engine.setUser(ALICE, cloud.for('alice'))
    expect(reopened.engine.state.pending).toBe(1)

    cloud.offline = false
    await reopened.engine.syncNow()
    expect(reopened.engine.state).toMatchObject({ phase: 'synced', pending: 0 })
    await b.engine.syncNow()
    expect(b.controller.data.tasks[0]).toMatchObject({ title: 'Written offline', notes: 'edited offline' })
  })

  it('when two devices edit the same task, the later edit wins on both', async () => {
    const { a, b } = await pair()
    a.add('t1', 'Original')
    await a.engine.syncNow()
    await b.engine.syncNow()

    a.controller.dispatch({ type: 'task/upsert', task: { id: 't1', title: 'Edit from A' } })
    await tick()
    b.controller.dispatch({ type: 'task/upsert', task: { id: 't1', title: 'Later edit from B' } })
    await a.engine.syncNow()
    await b.engine.syncNow()
    await a.engine.syncNow()
    expect(a.titles()).toEqual(['Later edit from B'])
    expect(b.titles()).toEqual(['Later edit from B'])
  })

  it('a task deleted on one device and edited later on another comes back', async () => {
    const { a, b } = await pair()
    a.add('t1', 'Original')
    await a.engine.syncNow()
    await b.engine.syncNow()

    a.controller.dispatch({ type: 'task/remove', id: 't1' })
    await tick()
    b.controller.dispatch({ type: 'task/upsert', task: { id: 't1', title: 'Still needed' } })
    await a.engine.syncNow()
    await b.engine.syncNow()
    await a.engine.syncNow()
    expect(a.titles()).toEqual(['Still needed'])
  })

  it('a deletion elsewhere clears the focus timer and unlinks calendar blocks without crashing', async () => {
    const { a, b } = await pair()
    a.add('t1', 'Focused here')
    a.controller.dispatch({ type: 'event/upsert', event: { id: 'e1', title: 'Block', start: '2026-11-16T09:00:00Z', end: '2026-11-16T10:00:00Z', taskId: 't1' } })
    await a.engine.syncNow()
    await b.engine.syncNow()
    b.controller.dispatch({ type: 'focus/set', taskId: 't1' })

    a.controller.dispatch({ type: 'task/remove', id: 't1' })
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect(b.controller.data.tasks).toHaveLength(0)
    expect(b.controller.data.focus.taskId).toBeNull()
    expect(b.controller.data.events[0].taskId).toBeNull()
  })

  it('accounts are separate', async () => {
    const cloud = new FakeCloud()
    const a = device()
    a.add('t1', 'Alice only')
    a.engine.setUser(ALICE, cloud.for('alice'))
    await a.engine.choose('merge')
    const bob = device()
    bob.engine.setUser({ id: 'bob', email: null }, cloud.for('bob'))
    await bob.engine.syncNow()
    expect(bob.titles()).toEqual([])
  })

  it('reports a missing database schema as such', async () => {
    const pc = device()
    const broken: Remote = {
      pull: async () => {
        throw new SyncError('schema', 'Could not find the table public.tasks')
      },
      upsert: async () => {},
      remove: async () => {}
    }
    pc.engine.setUser(ALICE, broken)
    await pc.engine.syncNow()
    expect(pc.engine.state).toMatchObject({ phase: 'error', error: 'schema' })
  })
})

describe('signing out', () => {
  it('keeping a local copy returns to guest mode with the data intact', async () => {
    const cloud = new FakeCloud()
    const pc = device()
    pc.add('t1', 'Keep me')
    pc.engine.setUser(ALICE, cloud.for('alice'))
    await pc.engine.choose('merge')

    pc.add('t2', 'Added just before signing out')
    await pc.engine.detach(true)
    expect(pc.engine.state).toMatchObject({ phase: 'local', user: null, pending: 0 })
    expect(pc.titles()).toEqual(['Added just before signing out', 'Keep me'])
    expect(cloud.live('alice', 'tasks')).toHaveLength(2) // the last change was uploaded first

    // Guest edits after sign-out stay on the PC.
    pc.add('t3', 'Guest again')
    expect(cloud.live('alice', 'tasks')).toHaveLength(2)

    // Signing back in asks again, and merging does not duplicate what is already there.
    pc.engine.setUser(ALICE, cloud.for('alice'))
    expect(pc.engine.state.phase).toBe('choose')
    await pc.engine.choose('merge')
    expect(cloud.live('alice', 'tasks')).toHaveLength(3)
    expect(pc.titles()).toHaveLength(3)
  })

  it('clearing removes account data from the PC but not from the cloud', async () => {
    const cloud = new FakeCloud()
    const pc = device()
    pc.add('t1', 'In the cloud')
    pc.engine.setUser(ALICE, cloud.for('alice'))
    await pc.engine.choose('merge')

    await pc.engine.detach(false)
    expect(pc.controller.data.tasks).toHaveLength(0)
    expect(pc.controller.data.categories).toHaveLength(3)
    expect(cloud.live('alice', 'tasks')).toHaveLength(1)

    // Signing in again brings everything back, with no prompt since the PC is empty.
    pc.engine.setUser(ALICE, cloud.for('alice'))
    await pc.engine.syncNow()
    expect(pc.titles()).toEqual(['In the cloud'])
  })
})

describe('row mapping', () => {
  it('round-trips a task through its database row', () => {
    const task: SyncRecord = {
      id: 't',
      title: 'Study',
      notes: 'ch. 4',
      tools: [{ id: null, label: 'Google', url: 'https://www.google.com', preset: 'google', icon: null }],
      subtasks: [{ id: 's1', title: 'Read', isCompleted: true, position: 0 }],
      estimateMin: 45,
      priority: 'high',
      categoryId: 'cat-study',
      dueDate: '2026-11-20',
      status: 'done',
      order: 3,
      spentMs: 61_000,
      createdAt: 1_700_000_000_000,
      completedAt: 1_700_000_500_000
    }
    const row = { ...toRow('tasks', 'u', 't', '2026-11-15T10:00:00.000Z', task), synced_at: '2026-11-15T10:00:01.123456+00:00' }
    expect(fromRow('tasks', row)).toEqual({
      id: 't',
      updatedAt: '2026-11-15T10:00:00.000Z',
      deletedAt: null,
      syncedAt: '2026-11-15T10:00:01.123456+00:00',
      record: task
    })
  })

  it('ignores invalid settings fields instead of applying them', () => {
    const row = { user_id: 'u', updated_at: '2026-11-15T10:00:00Z', synced_at: 'x', theme_mode: 'neon', accent_color: '#123456', focus_duration: 9999 }
    expect(fromRow('settings', row)).toMatchObject({ id: SETTINGS_ID, record: { accent: '#123456' } })
    expect(fromRow('settings', row)?.record).not.toHaveProperty('theme')
    expect(fromRow('settings', row)?.record).not.toHaveProperty('focusMin')
  })
})
