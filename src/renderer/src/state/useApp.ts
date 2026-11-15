import { create } from 'zustand'
import { applyAction } from '@shared/model'
import type { Action, AppData, AppEnv, CloudState } from '@shared/types'

export type View = 'focus' | 'tasks' | 'calendar' | 'settings'

interface AppStore {
  data: AppData | null
  env: AppEnv | null
  /** Cloud sync status; null until loaded. */
  cloud: CloudState | null
  /** Why the saved data has not loaded yet, if loading failed. */
  bootError: string | null
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
  cloud: null,
  bootError: null,
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
  let stopped = false
  // The dashboard only needs the saved data. Keep trying until it arrives, and
  // say why if it does not; nothing here may leave the window blank.
  const loadData = (): void => {
    if (stopped || useApp.getState().data) return
    Promise.resolve()
      .then(() => window.api.getState())
      .then((data) => {
        if (!useApp.getState().data) useApp.setState({ data, bootError: null })
      })
      .catch((error: unknown) => {
        useApp.setState({ bootError: error instanceof Error ? error.message : String(error) })
        setTimeout(loadData, 1500)
      })
  }
  loadData()
  // Extras: the app works without them, so a failure is only logged.
  window.api.getEnv().then((env) => useApp.setState({ env })).catch((e: unknown) => console.error('FocusFlow: getEnv failed', e))
  // Cloud status never gates the UI: until it arrives the app is simply in local mode.
  window.api.getCloud().then((cloud) => useApp.setState({ cloud })).catch((e: unknown) => console.error('FocusFlow: getCloud failed', e))
  const offCloud = window.api.onCloud((cloud) => useApp.setState({ cloud }))
  const offState = window.api.onState((data) => {
    if (inFlight > 0) held = data
    else useApp.setState({ data })
  })
  return () => {
    stopped = true
    offCloud()
    offState()
  }
}

export const newId = (): string => crypto.randomUUID()
