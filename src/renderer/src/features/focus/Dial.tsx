import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { formatClock } from '@shared/time'
import { cn } from '@/components/ui'

const TICKS = 60

export type DialTone = 'running' | 'resting' | 'break' | 'spent'

const LIT: Record<DialTone, string> = {
  running: 'var(--accent)',
  resting: 'color-mix(in oklab, var(--accent) 50%, var(--line))',
  break: 'var(--muted)',
  spent: 'var(--line)'
}

/**
 * A watch-bezel countdown: sixty ticks, one going dark for each sixtieth of the
 * session that has passed, clockwise from twelve.
 */
export function Dial({
  fraction,
  tone,
  size = 300,
  children
}: {
  /** Share of the session still remaining, 0..1. */
  fraction: number
  tone: DialTone
  size?: number
  children?: ReactNode
}) {
  const c = 150
  const spent = Math.min(TICKS, Math.max(0, Math.floor((1 - fraction) * TICKS + 1e-6)))

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 300 300" width={size} height={size} aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => {
          const major = i % 5 === 0
          const angle = (i * 2 * Math.PI) / TICKS
          const sin = Math.sin(angle)
          const cos = Math.cos(angle)
          const inner = major ? 118 : 126
          const lit = i >= spent && tone !== 'spent'
          return (
            <line
              key={i}
              x1={c + inner * sin}
              y1={c - inner * cos}
              x2={c + 141 * sin}
              y2={c - 141 * cos}
              stroke={lit ? LIT[tone] : 'var(--line)'}
              strokeWidth={major ? 4 : 3}
              strokeLinecap="round"
              style={{ transition: 'stroke 300ms ease' }}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/**
 * Countdown digits in fixed-width cells so the text never shifts. Each digit
 * rolls down as it changes, like a flip clock.
 */
export function Clock({ ms, className }: { ms: number; className?: string }) {
  const text = formatClock(ms)
  // Index from the right so the seconds keep their cells when the hour digit appears.
  const chars = text.split('')
  return (
    <span className={cn('inline-flex font-display font-semibold leading-none', className)} role="timer" aria-label={text}>
      {chars.map((ch, i) => (
        <span
          key={chars.length - i}
          aria-hidden="true"
          className="relative inline-block overflow-hidden text-center"
          style={{ width: ch === ':' ? '0.32em' : '0.6em', height: '1.1em', lineHeight: '1.1em' }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={ch}
              className="block"
              initial={{ y: '-55%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '55%', opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}
