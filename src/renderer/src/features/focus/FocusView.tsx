import { useState, type FormEvent } from 'react'
import { Check, Coffee, Pause, PictureInPicture2, Play, Plus, RotateCcw, X } from 'lucide-react'
import { focusedTask, sortedTasks } from '@shared/model'
import { formatDuration } from '@shared/time'
import type { Task } from '@shared/types'
import { AnimatePresence, motion } from 'motion/react'
import { TaskMeta } from '@/components/badges'
import { SubtaskChecklist, SubtaskProgress } from '@/components/subtasks'
import { ToolPill } from '@/components/tools'
import { Button, IconButton, inputClass } from '@/components/ui'
import { useData, useNow, useRemaining, useT, useWide } from '@/lib/hooks'
import { newId, useApp } from '@/state/useApp'
import { Clock, Dial, type DialTone } from './Dial'

export function FocusView() {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const { focus } = data
  const task = focusedTask(data)
  const remaining = useRemaining()
  const now = useNow(focus.status === 'running', 15_000)

  const fraction = focus.durationMs > 0 ? remaining / focus.durationMs : 0
  const onBreak = focus.phase === 'break'
  const tone: DialTone =
    focus.status === 'finished' ? 'spent' : onBreak ? 'break' : focus.status === 'running' ? 'running' : 'resting'

  const stateLabel = onBreak
    ? focus.status === 'finished'
      ? t('focus.breakOver')
      : t('focus.break')
    : focus.status === 'finished'
      ? t('focus.timeUp')
      : focus.status === 'running'
        ? t('focus.running')
        : focus.status === 'paused'
          ? t('focus.paused')
          : t('focus.ready')

  const upNext = sortedTasks(data.tasks).filter((x) => x.status === 'todo' && x.id !== focus.taskId)
  const wide = useWide()
  const choosing = !task && !(onBreak && focus.status !== 'finished')
  const heroKey = task && !onBreak ? `task-${task.id}` : onBreak && focus.status !== 'finished' ? 'break' : 'none'

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-12 pb-8 pt-6">
      <section className="flex shrink-0 items-center gap-10 py-6 xl:gap-14">
        <Dial fraction={fraction} tone={tone}>
          <div className="flex flex-col items-center gap-3">
            <Clock ms={remaining} className={`text-[64px] ${task || onBreak ? 'text-ink' : 'text-faint'}`} />
            <span
              className={`text-[13px] font-medium ${focus.status === 'finished' ? 'text-accent-text' : 'text-muted'}`}
            >
              {stateLabel}
            </span>
          </div>
        </Dial>

        <div className="min-w-0 flex-1">
          {/* The hero swaps with a short cross-fade when the task or phase changes. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={heroKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {task && !onBreak ? (
                <ActiveTask task={task} spentMs={task.spentMs + runningStretch(focus.runStartedAt, now)} />
              ) : onBreak && focus.status !== 'finished' ? (
                <BreakPanel />
              ) : (
                <div>
                  <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-[-0.01em]">
                    {onBreak ? t('focus.breakOver') : t('focus.none')}
                  </h1>
                  <p className="mt-3 max-w-[46ch] text-base text-muted">
                    {upNext.length > 0 ? t('focus.noneHint') : t('focus.noneEmpty')}
                  </p>
                  {upNext.length === 0 && <QuickAdd />}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {upNext.length > 0 && (
        <section className="mt-4 flex flex-col">
          <h2 className="mb-2 text-[13px] font-semibold text-muted">
            {choosing ? t('focus.pick') : t('focus.upNext')}
          </h2>
          <ul className="border-t border-line">
            <AnimatePresence initial={false}>
              {upNext.map((x) => (
                <motion.li
                  key={x.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 52 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  className="group flex items-center gap-4 overflow-hidden border-b border-line px-1"
                >
                  <span title={x.title} className="min-w-0 flex-1 truncate text-[15px] font-medium">
                    {x.title}
                  </span>
                  <SubtaskProgress subtasks={x.subtasks} />
                  {wide ? (
                    <TaskMeta task={x} className="shrink-0" />
                  ) : (
                    <span className="shrink-0 text-xs tabular-nums text-muted">{formatDuration(x.estimateMin)}</span>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'focus/set', taskId: x.id })}>
                    {t('focus.now')}
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}
    </div>
    </div>
  )
}

const runningStretch = (startedAt: number | null, now: number): number =>
  startedAt === null ? 0 : Math.max(0, now - startedAt)

function ActiveTask({ task, spentMs }: { task: Task; spentMs: number }) {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const { status, remainingMs, durationMs } = data.focus
  const spentMin = Math.floor(spentMs / 60_000)
  const untouched = status === 'idle' && remainingMs === durationMs

  return (
    <div>
      <h1
        title={task.title}
        className="line-clamp-3 break-words font-display text-[32px] font-semibold leading-[1.12] tracking-[-0.01em] xl:text-[40px]"
      >
        {task.title}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <TaskMeta task={task} />
        {spentMin >= 1 && (
          <span className="text-xs text-muted">{t('focus.spent', { time: formatDuration(spentMin) })}</span>
        )}
      </div>
      {task.tools.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold text-muted">{t('tools.needed')}</h2>
          <ul className="flex flex-wrap gap-2">
            {task.tools.map((tool, i) => (
              <motion.li
                key={`${tool.label}|${tool.url}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.08 + i * 0.04 }}
              >
                <ToolPill tool={tool} size="lg" />
              </motion.li>
            ))}
          </ul>
        </div>
      )}
      {task.subtasks.length > 0 && (
        <div className="mt-5 max-w-[520px]">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <h2 className="text-[13px] font-semibold text-muted">{t('field.subtasks')}</h2>
            <SubtaskProgress subtasks={task.subtasks} />
          </div>
          <SubtaskChecklist task={task} className="max-h-[188px] overflow-y-auto pr-1" />
        </div>
      )}
      {task.notes && (
        <p className="mt-4 line-clamp-3 max-w-[60ch] whitespace-pre-line break-words text-[15px] text-muted">{task.notes}</p>
      )}
      {status === 'finished' && <p className="mt-4 text-[15px] text-accent-text">{t('focus.timeUpHint')}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {status === 'finished' ? (
          <>
            <Button size="lg" variant="primary" onClick={() => dispatch({ type: 'focus/complete' })}>
              <Check size={18} />
              {t('focus.complete')}
            </Button>
            <Button size="lg" onClick={() => dispatch({ type: 'focus/extend', minutes: 5 })}>
              <Plus size={18} />
              {t('focus.addFive')}
            </Button>
          </>
        ) : (
          <>
            {status === 'running' ? (
              <Button size="lg" variant="primary" onClick={() => dispatch({ type: 'focus/pause' })}>
                <Pause size={18} />
                {t('focus.pause')}
              </Button>
            ) : (
              <Button size="lg" variant="primary" onClick={() => dispatch({ type: 'focus/start' })}>
                <Play size={18} />
                {status === 'paused' ? t('focus.resume') : t('focus.start')}
              </Button>
            )}
            <Button size="lg" disabled={untouched} onClick={() => dispatch({ type: 'focus/reset' })}>
              <RotateCcw size={17} />
              {t('focus.reset')}
            </Button>
            <Button size="lg" onClick={() => dispatch({ type: 'focus/complete' })}>
              <Check size={18} />
              {t('focus.complete')}
            </Button>
          </>
        )}

        <span className="mx-1 h-6 w-px bg-line" />
        {status !== 'finished' && (
          <IconButton label={t('focus.addFive')} onClick={() => dispatch({ type: 'focus/extend', minutes: 5 })}>
            <span className="text-[13px] font-semibold tabular-nums">+5</span>
          </IconButton>
        )}
        <IconButton label={t('focus.zen')} onClick={() => window.api.windowCommand('toggle-zen')}>
          <PictureInPicture2 size={18} />
        </IconButton>
        <IconButton label={t('focus.clear')} onClick={() => dispatch({ type: 'focus/set', taskId: null })}>
          <X size={18} />
        </IconButton>
      </div>
    </div>
  )
}

function BreakPanel() {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const running = data.focus.status === 'running'

  return (
    <div>
      <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-[-0.01em]">
        {running ? t('focus.break') : t('focus.breakOffer')}
      </h1>
      <p className="mt-3 max-w-[46ch] text-base text-muted">
        {t('focus.breakOfferHint', { time: formatDuration(data.settings.breakMin) })}
      </p>
      <div className="mt-8 flex items-center gap-2">
        {running ? (
          <Button size="lg" onClick={() => dispatch({ type: 'focus/endBreak' })}>
            {t('focus.endBreak')}
          </Button>
        ) : (
          <>
            <Button size="lg" variant="primary" onClick={() => dispatch({ type: 'focus/startBreak' })}>
              <Coffee size={18} />
              {t('focus.startBreak')}
            </Button>
            <Button size="lg" onClick={() => dispatch({ type: 'focus/endBreak' })}>
              {t('focus.skipBreak')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/** Shown when there are no tasks at all: add the first one and focus on it straight away. */
function QuickAdd() {
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const [title, setTitle] = useState('')

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!title.trim()) return
    const id = newId()
    dispatch({ type: 'task/upsert', task: { id, title } })
    dispatch({ type: 'focus/set', taskId: id })
    setTitle('')
  }

  return (
    <form onSubmit={submit} className="mt-6 flex max-w-[460px] gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('tasks.quickAdd')}
        aria-label={t('tasks.new')}
        className={`${inputClass} h-11 bg-surface text-[15px]`}
      />
      <Button type="submit" size="lg" variant="primary" disabled={!title.trim()}>
        {t('common.add')}
      </Button>
    </form>
  )
}
