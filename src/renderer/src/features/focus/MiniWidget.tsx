import { Check, Maximize2, Pause, Play } from 'lucide-react'
import { focusedTask } from '@shared/model'
import { useData, useRemaining, useRevealOnShow, useT } from '@/lib/hooks'
import { useApp } from '@/state/useApp'
import { Clock } from './Dial'

/** Zen mode: a floating always-on-top bar with only the task, the time left and Complete. */
export function MiniWidget() {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const remaining = useRemaining()
  const { focus } = data
  const task = focusedTask(data)
  const onBreak = focus.phase === 'break'
  const running = focus.status === 'running'
  const finished = focus.status === 'finished'
  const fraction = focus.durationMs > 0 ? remaining / focus.durationMs : 0
  // The bar pops in from slightly smaller each time Zen mode opens.
  const scope = useRevealOnShow<HTMLDivElement>({ opacity: 0, scale: 0.9, y: -6 }, 0.26)

  const title = onBreak
    ? finished
      ? t('focus.breakOver')
      : t('focus.break')
    : (task?.title ?? t('focus.none'))

  const round =
    'no-drag inline-grid size-9 shrink-0 place-items-center rounded-full text-muted transition-[color,background-color,transform] duration-150 hover:bg-raised hover:text-ink active:scale-90'

  return (
    <div className="h-full p-2">
      <div
        ref={scope}
        className="drag relative flex h-full items-center gap-3 overflow-hidden rounded-full border border-line bg-surface pl-5 pr-2"
        style={{ boxShadow: '0 4px 14px rgb(0 0 0 / 0.28)' }}
      >
        {/* Time left as a hairline along the bottom edge. */}
        <span
          className="absolute bottom-0 left-0 h-[3px] bg-accent transition-[width] duration-500"
          style={{ width: `${Math.round(fraction * 1000) / 10}%`, opacity: running ? 1 : 0.45 }}
        />

        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold" title={title}>
          {title}
        </span>

        {(task || onBreak) && (
          <Clock ms={remaining} className={`text-[22px] ${finished ? 'text-accent-text' : 'text-ink'}`} />
        )}

        {task && !onBreak && !finished && (
          <button
            type="button"
            className={round}
            title={running ? t('focus.pause') : t('focus.start')}
            aria-label={running ? t('focus.pause') : t('focus.start')}
            onClick={() => dispatch({ type: running ? 'focus/pause' : 'focus/start' })}
          >
            {running ? <Pause size={17} /> : <Play size={17} />}
          </button>
        )}

        {task && !onBreak && (
          <button
            type="button"
            className="no-drag inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-accent-ink transition-[filter,transform] duration-150 hover:brightness-110 active:scale-95"
            onClick={() => dispatch({ type: 'focus/complete' })}
          >
            <Check size={16} />
            {t('focus.complete')}
          </button>
        )}

        <button
          type="button"
          className={round}
          title={t('focus.expand')}
          aria-label={t('focus.expand')}
          onClick={() => window.api.windowCommand('show-main')}
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  )
}
