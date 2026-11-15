import { applyAction } from '@shared/model'
import type { Action, AppData } from '@shared/types'
import type { JsonStore, LoadSource, Meta } from './store'

/** 'sync' marks changes that arrived from the cloud, so they are not queued for upload again. */
export type Origin = 'local' | 'sync'
export type Listener = (next: AppData, prev: AppData, origin: Origin) => void

/**
 * Owns the application state. Every change goes through `dispatch`, which
 * applies it, queues a save, re-arms the focus timer and tells subscribers.
 */
export class Controller {
  data: AppData
  meta: Meta
  readonly source: LoadSource
  private readonly listeners = new Set<Listener>()
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly store: JsonStore) {
    const loaded = store.load()
    this.data = loaded.data
    this.meta = loaded.meta
    this.source = loaded.source
    if (loaded.source !== 'file') this.store.save(this.data, this.meta)
  }

  dispatch(action: Action): void {
    const prev = this.data
    const next = applyAction(prev, action, Date.now())
    if (next === prev) return
    this.data = next
    this.store.save(next, this.meta)
    this.arm()
    for (const listener of this.listeners) listener(next, prev, 'local')
  }

  /** Swap in a whole new state (cloud merges, clearing data on sign-out). */
  replace(next: AppData, origin: Origin): void {
    const prev = this.data
    if (next === prev) return
    this.data = next
    this.store.save(next, this.meta)
    this.arm()
    for (const listener of this.listeners) listener(next, prev, origin)
  }

  /** Copy the data file aside before a change that discards local data. */
  backup(label: string): string | null {
    this.store.flush()
    return this.store.copyAside(label)
  }

  updateMeta(change: (meta: Meta) => void): void {
    change(this.meta)
    this.store.save(this.data, this.meta)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  flush(): void {
    this.store.flush()
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  /** Schedule the moment a running countdown reaches zero. */
  private arm(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const { status, endsAt } = this.data.focus
    if (status !== 'running' || endsAt === null) return
    const wait = Math.max(0, endsAt - Date.now()) + 10
    this.timer = setTimeout(() => this.dispatch({ type: 'focus/tick' }), wait)
  }
}
