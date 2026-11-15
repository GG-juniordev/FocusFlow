export type Priority = 'high' | 'medium' | 'low'
export type ThemeMode = 'dark' | 'light' | 'system'
export type Language = 'en' | 'it'
export type TaskStatus = 'todo' | 'done'

/** A custom tool icon: an emoji, or a small square PNG stored inline as a data URL. */
export type ToolIconSpec = { type: 'emoji'; value: string } | { type: 'image'; src: string }

/**
 * An app, site or link needed for a task.
 * On a task, `id` links it to the tool library so edits made in Settings show up
 * everywhere; the other fields are a snapshot used if that library tool is deleted.
 */
export interface ToolRef {
  id: string | null
  label: string
  /** http(s) link, or an app protocol such as vscode://. */
  url: string | null
  /** Id of a built-in preset (sets the default icon), or null for custom tools and links. */
  preset: string | null
  /** Custom icon; overrides the preset icon. */
  icon: ToolIconSpec | null
}

/** A tool in the user's library (Settings → Tools & resources). */
export type LibraryTool = ToolRef & { id: string }

export interface Task {
  id: string
  title: string
  notes: string
  tools: ToolRef[]
  /** Estimated duration in minutes. */
  estimateMin: number
  priority: Priority
  categoryId: string | null
  /** Local calendar day, YYYY-MM-DD. */
  dueDate: string | null
  status: TaskStatus
  order: number
  /** Time actually spent in focus sessions. */
  spentMs: number
  createdAt: number
  completedAt: number | null
}

export interface CalendarEvent {
  id: string
  title: string
  notes: string
  /** ISO timestamps. Duration is always derived from start/end. */
  start: string
  end: string
  categoryId: string | null
  /** Set when the block was created from (or converted into) a task. */
  taskId: string | null
}

export interface Category {
  id: string
  name: string
  color: string
}

export interface Settings {
  launchAtStartup: boolean
  startMinimized: boolean
  alwaysOnTop: boolean
  notificationSounds: boolean
  theme: ThemeMode
  accent: string
  /** Custom app background; null uses the theme's own. */
  bgColor: string | null
  /** Custom card/surface colour; null derives one from the background. */
  surfaceColor: string | null
  language: Language
  focusMin: number
  breakMin: number
}

export type FocusPhase = 'focus' | 'break'
export type FocusStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface FocusState {
  taskId: string | null
  phase: FocusPhase
  status: FocusStatus
  durationMs: number
  /** Authoritative while not running. */
  remainingMs: number
  /** Epoch ms the countdown hits zero; set only while running. */
  endsAt: number | null
  /** Epoch ms the current run began; used to credit time spent. */
  runStartedAt: number | null
}

/** Everything the UI needs. Owned by the main process, mirrored in every window. */
export interface AppData {
  tasks: Task[]
  events: CalendarEvent[]
  categories: Category[]
  /** Tool library offered as quick picks in the task editor. */
  tools: LibraryTool[]
  settings: Settings
  focus: FocusState
}

export type TaskDraft = Partial<Omit<Task, 'id'>> & { id: string }
export type EventDraft = Partial<Omit<CalendarEvent, 'id'>> & { id: string }

export type Action =
  | { type: 'task/upsert'; task: TaskDraft }
  | { type: 'task/remove'; id: string }
  | { type: 'task/reorder'; ids: string[] }
  | { type: 'task/setStatus'; id: string; status: TaskStatus }
  | { type: 'event/upsert'; event: EventDraft }
  | { type: 'event/remove'; id: string }
  | { type: 'event/toTask'; id: string; taskId: string }
  | { type: 'category/upsert'; category: Category }
  | { type: 'category/remove'; id: string }
  | { type: 'tool/upsert'; tool: LibraryTool }
  | { type: 'tool/remove'; id: string }
  | { type: 'tool/restoreDefaults' }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'focus/set'; taskId: string | null }
  | { type: 'focus/start' }
  | { type: 'focus/pause' }
  | { type: 'focus/reset' }
  | { type: 'focus/complete' }
  | { type: 'focus/extend'; minutes: number }
  | { type: 'focus/startBreak' }
  | { type: 'focus/endBreak' }
  | { type: 'focus/tick' }

export type WindowCommand = 'toggle-zen' | 'show-main' | 'open-data-folder' | 'quit'

export interface AppEnv {
  packaged: boolean
  dataPath: string
  version: string
}

export interface Api {
  getState(): Promise<AppData>
  getEnv(): Promise<AppEnv>
  dispatch(action: Action): Promise<void>
  onState(listener: (data: AppData) => void): () => void
  windowCommand(command: WindowCommand): void
  /** Open a tool link in the default browser or app. */
  openExternal(url: string): void
}

export const IPC = {
  getState: 'ff:get-state',
  getEnv: 'ff:get-env',
  dispatch: 'ff:dispatch',
  state: 'ff:state',
  window: 'ff:window',
  openExternal: 'ff:open-external'
} as const
