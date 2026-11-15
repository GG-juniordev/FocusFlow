import { create } from 'zustand'
import { applyAction } from '@shared/model'
import type { Action, AppData, AppEnv } from '@shared/types'

export type View = 'focus' | 'tasks' | 'calendar' | 'settings'

interface AppStore {
  data: AppData | null
  env: AppEnv | null
  view: View
  setView(view: View): void
  dispatch(action: Action): void
}

// While our own actions are in flight, a broadcast from the main process describes
// a state older than what is on screen. Hold the latest one and apply it once
// everything we sent has been acknowledged.
let inFlight = 0
let held: AppData | null = null

export const useApp = create<AppStore>((set, get) => ({
  data: null,
  env: null,
  view: 'focus',
  setView: (view) => set({ view }),
  dispatch: (action) => {
    const current = get().data
    // Apply locally first so the UI responds at once; the main process stays the source of truth.
    if (current) set({ data: applyAction(current, action, Date.now()) })
    inFlight++
    window.api
      .dispatch(action)
      .catch((error: unknown) => console.error('FocusFlow: action failed', action.type, error))
      .finally(() => {
        inFlight--
        if (inFlight === 0 && held) {
          set({ data: held })
          held = null
        }
      })
  }
}))

/** Load the state and keep it in sync with the main process. Returns a disconnect function. */
export function connect(): () => void {
  void window.api.getState().then((data) => {
    if (!useApp.getState().data) useApp.setState({ data })
  })
  void window.api.getEnv().then((env) => useApp.setState({ env }))
  return window.api.onState((data) => {
    if (inFlight > 0) held = data
    else useApp.setState({ data })
  })
}

export const newId = (): string => crypto.randomUUID()
