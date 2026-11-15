import { useEffect, useMemo, useState } from 'react'
import { useAnimate } from 'motion/react'
import { translator, type Translate } from '@shared/i18n'
import { resolvePalette } from '@shared/palette'
import { remainingMs, toDateKey } from '@shared/time'
import type { AppData, Language, Settings } from '@shared/types'
import { connect, useApp } from '@/state/useApp'

/** The app state. Only call below the point where the app has loaded. */
export function useData(): AppData {
  const data = useApp((s) => s.data)
  if (!data) throw new Error('App state used before it loaded')
  return data
}

export function useT(): Translate {
  const language = useApp((s) => s.data?.settings.language ?? 'en')
  return useMemo(() => translator(language), [language])
}

export const localeOf = (language: Language): string => (language === 'it' ? 'it-IT' : 'en-US')

/** Current time, re-rendering on an interval while `active`. */
export function useNow(active: boolean, everyMs = 250): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [active, everyMs])
  return active ? now : Date.now()
}

/** Milliseconds left on the focus timer, ticking while it runs. */
export function useRemaining(): number {
  const focus = useData().focus
  const now = useNow(focus.status === 'running')
  return remainingMs(focus, now)
}

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

const PALETTE_VARS = ['bg', 'rail', 'surface', 'raised', 'line', 'ink', 'muted', 'faint'] as const

function applyTheme(settings: Settings, systemDark: boolean): void {
  const root = document.documentElement
  const custom = resolvePalette(settings, systemDark)
  root.dataset.theme = custom
    ? custom.tone
    : settings.theme === 'system'
      ? systemDark
        ? 'dark'
        : 'light'
      : settings.theme
  // A custom background replaces the theme's surface and text colours; the tone
  // (picked from the background's brightness) still supplies shadows and danger red.
  for (const name of PALETTE_VARS) {
    if (custom) root.style.setProperty(`--${name}`, custom[name])
    else root.style.removeProperty(`--${name}`)
  }
  root.lang = settings.language
  root.style.setProperty('--accent', settings.accent)
  // Text on an accent fill: dark on light accents, white on dark ones.
  root.style.setProperty('--accent-ink', luminance(settings.accent) > 0.36 ? '#15171d' : '#ffffff')
}

/** Connect to the main process and keep theme, accent and language applied. Returns whether state has loaded. */
export function useBoot(): boolean {
  const settings = useApp((s) => s.data?.settings)

  useEffect(() => connect(), [])

  useEffect(() => {
    if (!settings) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => applyTheme(settings, media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings])

  return settings !== undefined
}

/**
 * Play an entrance animation when the window is first shown and each time it
 * comes back from hiding (switching in and out of Zen mode, restoring from the tray).
 */
export function useRevealOnShow<T extends HTMLElement>(
  from: { opacity?: number; scale?: number; y?: number },
  duration = 0.24
) {
  const [scope, animate] = useAnimate<T>()
  useEffect(() => {
    const play = (): void => {
      if (!scope.current) return
      const keyframes: Record<string, number[]> = { opacity: [from.opacity ?? 0, 1] }
      if (from.scale !== undefined) keyframes.scale = [from.scale, 1]
      if (from.y !== undefined) keyframes.y = [from.y, 0]
      const el = scope.current
      const settle = (): void => {
        el.style.opacity = '1'
        el.style.transform = 'none'
      }
      try {
        void animate(el, keyframes, { duration, ease: [0.2, 0.8, 0.2, 1] })
      } catch {
        settle()
      }
      // If the animation is interrupted or never runs, show the content anyway.
      setTimeout(() => {
        if (el.isConnected && Number(getComputedStyle(el).opacity) < 1 && el.getAnimations().length === 0) settle()
      }, duration * 1000 + 400)
    }
    play()
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') play()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return scope
}

/** "Today", "Tomorrow" or a short date for a YYYY-MM-DD key. */
export function dueLabel(key: string, t: Translate, language: Language): { text: string; overdue: boolean } {
  const today = toDateKey(new Date())
  const tomorrow = toDateKey(new Date(Date.now() + 86_400_000))
  if (key === today) return { text: t('tasks.today'), overdue: false }
  if (key === tomorrow) return { text: t('tasks.tomorrow'), overdue: false }
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  const text = date.toLocaleDateString(localeOf(language), {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric'
  })
  return { text, overdue: key < today }
}
