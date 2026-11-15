import type { FocusState } from './types'

export const MINUTE = 60_000

/** "45m", "1h", "1h 30m" */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest}m`
  if (rest === 0) return `${h}h`
  return `${h}h ${rest}m`
}

/** Countdown text: "24:59", or "1:05:00" past an hour. Rounds up so 0:00 only shows at zero. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`
  return `${String(m).padStart(2, '0')}:${ss}`
}

export function remainingMs(focus: FocusState, now: number): number {
  if (focus.status === 'running' && focus.endsAt !== null) return Math.max(0, focus.endsAt - now)
  return Math.max(0, focus.remainingMs)
}

/** Local calendar day as YYYY-MM-DD. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function eventMinutes(start: string, end: string): number {
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / MINUTE))
}
