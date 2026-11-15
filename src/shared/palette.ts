import type { Settings } from './types'

/**
 * Colour maths shared by the renderer (CSS variables) and the main process
 * (native title bar). Custom backgrounds derive every other surface and text
 * colour from the chosen background so text stays readable on any choice.
 */

export type Tone = 'dark' | 'light'

export interface Palette {
  tone: Tone
  bg: string
  rail: string
  surface: string
  raised: string
  line: string
  ink: string
  muted: string
  faint: string
}

export interface BackgroundPreset {
  id: string
  name: string
  bg: string
  surface: string
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'oled', name: 'Pure Black', bg: '#000000', surface: '#111216' },
  { id: 'slate', name: 'Deep Slate', bg: '#1b1f27', surface: '#252a35' },
  { id: 'midnight', name: 'Midnight Blue', bg: '#0d1430', surface: '#172045' },
  { id: 'forest', name: 'Night Forest', bg: '#101a17', surface: '#1a2723' },
  { id: 'paper', name: 'Warm Paper', bg: '#f3ede1', surface: '#fffaf0' },
  { id: 'gray', name: 'Soft Gray', bg: '#e4e6ea', surface: '#f6f7f9' },
  { id: 'white', name: 'Clean White', bg: '#ffffff', surface: '#f4f6f9' }
]

/** The built-in themes; keep in step with the :root blocks in the renderer stylesheet. */
export const THEME_DEFAULTS: Record<Tone, Palette> = {
  dark: {
    tone: 'dark',
    bg: '#161a24',
    rail: '#11141c',
    surface: '#1d2230',
    raised: '#262c3c',
    line: '#2e3547',
    ink: '#e9ecf3',
    muted: '#98a1b5',
    faint: '#6b748a'
  },
  light: {
    tone: 'light',
    bg: '#eef1f6',
    rail: '#e3e7ef',
    surface: '#ffffff',
    raised: '#f1f4f8',
    line: '#d6dce7',
    ink: '#1a1f2b',
    muted: '#5a6478',
    faint: '#8a93a6'
  }
}

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function toHex([r, g, b]: number[]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`
}

/** Blend `a` toward `b` by `t` (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const ca = rgb(a)
  const cb = rgb(b)
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t))
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1..21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const INK = { dark: '#eceff5', light: '#161a23' }

/** Mix `ink` toward `bg` as far as possible while keeping at least `min` contrast. */
function softened(ink: string, bg: string, wanted: number, min: number): string {
  for (let t = wanted; t > 0; t -= 0.05) {
    const c = mix(ink, bg, t)
    if (contrast(c, bg) >= min) return c
  }
  return ink
}

/** A full palette for a custom background (and optional custom surface). */
export function customPalette(bg: string, surfaceChoice: string | null): Palette {
  const tone: Tone = contrast(bg, '#ffffff') >= contrast(bg, '#000000') ? 'dark' : 'light'
  const surface = surfaceChoice ?? (tone === 'dark' ? mix(bg, '#ffffff', 0.06) : mix(bg, '#ffffff', 0.65))

  // Text colour that reads best on both the page and the cards.
  const score = (ink: string): number => Math.min(contrast(ink, bg), contrast(ink, surface))
  const ink = score(INK.dark) >= score(INK.light) ? INK.dark : INK.light
  // Secondary text is judged against whichever of the two backgrounds is harder.
  const harder = contrast(ink, bg) < contrast(ink, surface) ? bg : surface

  return {
    tone: ink === INK.dark ? 'dark' : 'light',
    bg,
    rail: tone === 'dark' ? mix(bg, '#000000', 0.25) : mix(bg, '#000000', 0.04),
    surface,
    raised: mix(surface, ink, 0.07),
    line: mix(surface, ink, 0.15),
    ink,
    muted: softened(ink, harder, 0.4, 4.5),
    faint: softened(ink, harder, 0.6, 3)
  }
}

/** The palette in effect, or null when the plain built-in theme applies. */
export function resolvePalette(settings: Settings, systemDark: boolean): Palette | null {
  if (!settings.bgColor && !settings.surfaceColor) return null
  const themeTone: Tone = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme
  const bg = settings.bgColor ?? THEME_DEFAULTS[themeTone].bg
  return customPalette(bg, settings.surfaceColor)
}

/** Colours for the native window title bar (caption buttons). */
export function windowChrome(settings: Settings, systemDark: boolean): { bg: string; symbol: string } {
  const custom = resolvePalette(settings, systemDark)
  if (custom) return { bg: custom.bg, symbol: custom.muted }
  const tone: Tone = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme
  return { bg: THEME_DEFAULTS[tone].bg, symbol: THEME_DEFAULTS[tone].muted }
}

export type Readability = 'excellent' | 'good' | 'low'

export function readability(p: Palette): { ratio: number; level: Readability } {
  const ratio = Math.min(contrast(p.ink, p.bg), contrast(p.ink, p.surface))
  return { ratio, level: ratio >= 7 ? 'excellent' : ratio >= 4.5 ? 'good' : 'low' }
}
