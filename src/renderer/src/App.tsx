import type { ComponentType } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, Check, ListTodo, Pause, PictureInPicture2, Play, Settings, Target } from 'lucide-react'
import { focusedTask } from '@shared/model'
import type { MessageKey } from '@shared/i18n'
import { BootScreen } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/toast'
import { cn } from '@/components/ui'
import { CalendarView } from '@/features/calendar/CalendarView'
import { MigrationModal } from '@/features/cloud/CloudModals'
import { CloudPill } from '@/features/cloud/CloudPill'
import { Clock } from '@/features/focus/Dial'
import { FocusView } from '@/features/focus/FocusView'
import { SettingsView } from '@/features/settings/SettingsView'
import { TasksView } from '@/features/tasks/TasksView'
import { useBoot, useData, useRemaining, useRevealOnShow, useT } from '@/lib/hooks'
import { useApp, type View } from '@/state/useApp'

const NAV: { id: View; label: MessageKey; icon: ComponentType<{ size?: number }> }[] = [
  { id: 'focus', label: 'nav.focus', icon: Target },
  { id: 'tasks', label: 'nav.tasks', icon: ListTodo },
  { id: 'calendar', label: 'nav.calendar', icon: CalendarDays }
]

const VIEWS: Record<View, ComponentType> = {
  focus: FocusView,
  tasks: TasksView,
  calendar: CalendarView,
  settings: SettingsView
}

export function App() {
  const ready = useBoot()
  if (!ready) return <BootScreen />
  return <Shell />
}

function Shell() {
  const view = useApp((s) => s.view)
  const choosing = useApp((s) => s.cloud?.phase === 'choose')
  const Current = VIEWS[view]
  // Returning from Zen mode or the tray eases the dashboard back in.
  const scope = useRevealOnShow<HTMLDivElement>({ opacity: 0, scale: 0.985 }, 0.22)

  return (
    <div ref={scope} className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Title bar: draggable, with room on the right for the native window buttons. */}
        <header className="drag flex h-10 shrink-0 items-center gap-3 pl-8 pr-[150px]">
          <AnimatePresence>{view !== 'focus' && <NowBar key="now" />}</AnimatePresence>
          <CloudPill />
        </header>
        <main className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              className="h-full"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <Current />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {/* First sign-in on a PC that already has data: ask before anything is transferred. */}
      <AnimatePresence>{choosing && <MigrationModal key="migrate" />}</AnimatePresence>
      <Toaster />
    </div>
  )
}

function Sidebar() {
  const t = useT()
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)

  const item = (active: boolean): string =>
    cn(
      'no-drag relative flex w-[68px] flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-[color,transform] duration-150 active:scale-95',
      active ? 'text-accent-text' : 'text-muted hover:bg-raised hover:text-ink'
    )

  // The highlight slides between items rather than jumping.
  const pill = (active: boolean) =>
    active && (
      <motion.span
        layoutId="nav-active"
        className="absolute inset-0 rounded-xl bg-accent-soft"
        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
      />
    )

  return (
    <nav className="drag flex w-[84px] shrink-0 flex-col items-center bg-rail pb-3" aria-label="FocusFlow">
      <div className="grid h-14 place-items-center">
        <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
          <circle cx="16" cy="16" r="11" fill="none" stroke="var(--line)" strokeWidth="3.5" />
          <path
            d="M16 5 A11 11 0 1 1 6.5 21.5"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="16" cy="16" r="3" fill="var(--accent)" />
        </svg>
      </div>

      <div className="flex flex-col gap-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={view === id ? 'page' : undefined}
            onClick={() => setView(id)}
            className={item(view === id)}
          >
            {pill(view === id)}
            <span className="relative flex flex-col items-center gap-1">
              <Icon size={20} />
              {t(label)}
            </span>
          </button>
        ))}
      </div>

      <span className="flex-1" />

      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => window.api.windowCommand('toggle-zen')} className={item(false)}>
          <span className="relative flex flex-col items-center gap-1">
            <PictureInPicture2 size={20} />
            Zen
          </span>
        </button>
        <button
          type="button"
          aria-current={view === 'settings' ? 'page' : undefined}
          onClick={() => setView('settings')}
          className={item(view === 'settings')}
        >
          {pill(view === 'settings')}
          <span className="relative flex flex-col items-center gap-1">
            <Settings size={20} />
            {t('nav.settings')}
          </span>
        </button>
      </div>
    </nav>
  )
}

/** The current focus, compact, so it stays in sight from every other view. */
function NowBar() {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const setView = useApp((s) => s.setView)
  const remaining = useRemaining()
  const { focus } = data
  const task = focusedTask(data)
  const onBreak = focus.phase === 'break' && focus.status !== 'idle'
  if (!task && !onBreak) return null

  const running = focus.status === 'running'
  const round =
    'grid size-6 place-items-center rounded-full text-muted transition-[color,background-color,transform] duration-150 hover:bg-raised hover:text-ink active:scale-90'

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="no-drag flex h-7 min-w-0 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-1 text-[13px]"
    >
      <span className="relative flex size-1.5 shrink-0">
        {running && <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />}
        <span className={cn('relative size-1.5 rounded-full', running ? 'bg-accent' : 'bg-faint')} />
      </span>
      <button
        type="button"
        onClick={() => setView('focus')}
        className="min-w-0 truncate font-medium transition-colors duration-150 hover:text-accent-text"
      >
        {task ? task.title : focus.status === 'finished' ? t('focus.breakOver') : t('focus.break')}
      </button>
      <Clock ms={remaining} className="shrink-0 text-[13px] text-muted" />
      {task && focus.status !== 'finished' && (
        <button
          type="button"
          className={round}
          title={running ? t('focus.pause') : t('focus.start')}
          aria-label={running ? t('focus.pause') : t('focus.start')}
          onClick={() => dispatch({ type: running ? 'focus/pause' : 'focus/start' })}
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
        </button>
      )}
      {task && (
        <button
          type="button"
          className={round}
          title={t('focus.complete')}
          aria-label={t('focus.complete')}
          onClick={() => dispatch({ type: 'focus/complete' })}
        >
          <Check size={14} />
        </button>
      )}
    </motion.div>
  )
}
