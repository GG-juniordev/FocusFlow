import { defaultToolLibrary } from './tools'
import type { AppData, Category, FocusState, Settings } from './types'

export const ACCENTS = ['#F0A63A', '#EF6F5E', '#E0569B', '#8B6CF0', '#4C8DF6', '#23B5A6', '#5DBB63'] as const

export const CATEGORY_COLORS = [
  '#4C8DF6',
  '#8B6CF0',
  '#23B5A6',
  '#EF6F5E',
  '#F0A63A',
  '#E0569B',
  '#5DBB63',
  '#8A93A6'
] as const

export const DURATION_PRESETS = [15, 30, 60, 120] as const

export const DEFAULT_SETTINGS: Settings = {
  launchAtStartup: true,
  startMinimized: false,
  alwaysOnTop: false,
  notificationSounds: true,
  theme: 'dark',
  accent: ACCENTS[0],
  bgColor: null,
  surfaceColor: null,
  language: 'en',
  focusMin: 25,
  breakMin: 5
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-work', name: 'Work', color: '#4C8DF6' },
  { id: 'cat-study', name: 'Study', color: '#8B6CF0' },
  { id: 'cat-personal', name: 'Personal', color: '#23B5A6' }
]

export function idleFocus(minutes: number): FocusState {
  const ms = Math.round(minutes * 60_000)
  return {
    taskId: null,
    phase: 'focus',
    status: 'idle',
    durationMs: ms,
    remainingMs: ms,
    endsAt: null,
    runStartedAt: null
  }
}

export function defaultData(): AppData {
  return {
    tasks: [],
    events: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    tools: defaultToolLibrary(),
    settings: { ...DEFAULT_SETTINGS },
    focus: idleFocus(DEFAULT_SETTINGS.focusMin)
  }
}
