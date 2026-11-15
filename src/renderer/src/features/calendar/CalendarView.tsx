import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, useAnimate } from 'motion/react'
import type { DateSelectArg, EventClickArg, EventContentArg, EventDropArg } from '@fullcalendar/core'
import itLocale from '@fullcalendar/core/locales/it'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, {
  Draggable,
  type EventReceiveArg,
  type EventResizeDoneArg
} from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { sortedTasks } from '@shared/model'
import { MINUTE, formatDuration } from '@shared/time'
import type { AppData, CalendarEvent } from '@shared/types'
import { Button, IconButton, Segmented } from '@/components/ui'
import { useData, useT } from '@/lib/hooks'
import { newId, useApp } from '@/state/useApp'
import { EventEditor } from './EventEditor'

type CalView = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth'
type Editing = { event: CalendarEvent; isNew: boolean } | null

const FALLBACK_COLOR = 'var(--accent)'

const colorOf = (data: AppData, categoryId: string | null): string =>
  data.categories.find((c) => c.id === categoryId)?.color ?? FALLBACK_COLOR

/** A day picked in month view has no time: start the block at 09:00. */
function atNine(day: Date): Date {
  const d = new Date(day)
  d.setHours(9, 0, 0, 0)
  return d
}

function renderEvent(arg: EventContentArg) {
  const { color, done } = arg.event.extendedProps as { color?: string; done?: boolean }
  const month = arg.view.type === 'dayGridMonth'
  return (
    <div className="ff-ev" data-done={done ? 'true' : 'false'} style={{ '--c': color ?? FALLBACK_COLOR } as CSSProperties}>
      {month ? (
        <div className="truncate">
          <span className="ff-ev-time">{arg.timeText}</span> <span className="ff-ev-title">{arg.event.title}</span>
        </div>
      ) : (
        <>
          <div className="ff-ev-title truncate">{arg.event.title}</div>
          <div className="ff-ev-time truncate">{arg.timeText}</div>
        </>
      )}
    </div>
  )
}

export function CalendarView() {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const calendar = useRef<FullCalendar>(null)
  const drawer = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<CalView>('timeGridWeek')
  const [title, setTitle] = useState('')
  const [editing, setEditing] = useState<Editing>(null)

  // The drag source is set up once; it reads the latest data through this ref.
  const latest = useRef(data)
  useEffect(() => {
    latest.current = data
  }, [data])

  const scheduled = useMemo(() => new Set(data.events.map((e) => e.taskId).filter(Boolean)), [data.events])
  const backlog = sortedTasks(data.tasks).filter((x) => x.status === 'todo' && !scheduled.has(x.id))

  const events = useMemo(
    () =>
      data.events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        extendedProps: {
          color: colorOf(data, e.categoryId),
          done: e.taskId ? data.tasks.find((x) => x.id === e.taskId)?.status === 'done' : false
        }
      })),
    [data]
  )

  // Make backlog items draggable onto the calendar grid.
  useEffect(() => {
    if (!drawer.current) return
    const draggable = new Draggable(drawer.current, {
      itemSelector: '[data-task-id]',
      eventData: (el) => {
        const task = latest.current.tasks.find((x) => x.id === el.dataset.taskId)
        return {
          title: task?.title ?? '',
          duration: { minutes: task?.estimateMin ?? 30 },
          extendedProps: { taskId: task?.id, color: colorOf(latest.current, task?.categoryId ?? null) }
        }
      }
    })
    return () => draggable.destroy()
  }, [])

  const api = () => calendar.current?.getApi()
  const [grid, animateGrid] = useAnimate<HTMLDivElement>()

  /** Navigate, then slide the new range in from the direction of travel. */
  const go = (direction: -1 | 0 | 1, move: () => void): void => {
    move()
    if (!grid.current) return
    void animateGrid(
      grid.current,
      { opacity: [0.35, 1], x: [direction * 18, 0] },
      { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }
    )
  }

  const onSelect = (arg: DateSelectArg): void => {
    const start = arg.allDay ? atNine(arg.start) : arg.start
    const end = arg.allDay ? new Date(start.getTime() + data.settings.focusMin * MINUTE) : arg.end
    arg.view.calendar.unselect()
    setEditing({
      isNew: true,
      event: {
        id: newId(),
        title: '',
        notes: '',
        start: start.toISOString(),
        end: end.toISOString(),
        categoryId: null,
        taskId: null
      }
    })
  }

  const onClick = (arg: EventClickArg): void => {
    const event = data.events.find((e) => e.id === arg.event.id)
    if (event) setEditing({ event, isNew: false })
  }

  const onMoved = (arg: EventDropArg | EventResizeDoneArg): void => {
    const { id, start, end } = arg.event
    if (!start) return
    dispatch({
      type: 'event/upsert',
      event: { id, start: start.toISOString(), end: (end ?? new Date(start.getTime() + 30 * MINUTE)).toISOString() }
    })
  }

  // A backlog task was dropped on the grid: block time for it.
  const onReceive = (arg: EventReceiveArg): void => {
    const taskId = arg.event.extendedProps.taskId as string | undefined
    const dropped = arg.event.start
    // The calendar is driven by app state, so discard its own copy of the dropped event.
    arg.event.remove()
    const task = data.tasks.find((x) => x.id === taskId)
    if (!task || !dropped) return
    const start = arg.event.allDay ? atNine(dropped) : dropped
    dispatch({
      type: 'event/upsert',
      event: {
        id: newId(),
        title: task.title,
        notes: task.notes,
        start: start.toISOString(),
        end: new Date(start.getTime() + task.estimateMin * MINUTE).toISOString(),
        categoryId: task.categoryId,
        taskId: task.id
      }
    })
  }

  const newBlock = (): void => {
    const start = new Date()
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0)
    setEditing({
      isNew: true,
      event: {
        id: newId(),
        title: '',
        notes: '',
        start: start.toISOString(),
        end: new Date(start.getTime() + data.settings.focusMin * MINUTE).toISOString(),
        categoryId: null,
        taskId: null
      }
    })
  }

  const scrollTime = `${String(Math.max(0, new Date().getHours() - 1)).padStart(2, '0')}:00:00`

  return (
    <div className="flex h-full flex-col pb-4 pl-8 pr-4 pt-4">
      <header className="flex items-center gap-2 pr-4">
        <h1 className="mr-2 min-w-[200px] font-display text-[24px] font-semibold tracking-[-0.01em] first-letter:uppercase">
          {title}
        </h1>
        <IconButton label={t('cal.prev')} onClick={() => go(-1, () => api()?.prev())}>
          <ChevronLeft size={18} />
        </IconButton>
        <IconButton label={t('cal.next')} onClick={() => go(1, () => api()?.next())}>
          <ChevronRight size={18} />
        </IconButton>
        <Button size="sm" onClick={() => go(0, () => api()?.today())}>
          {t('cal.today')}
        </Button>
        <span className="flex-1" />
        <Segmented
          label={t('cal.title')}
          value={view}
          onChange={(next) => {
            setView(next)
            go(0, () => api()?.changeView(next))
          }}
          options={[
            { id: 'timeGridDay', label: t('cal.day') },
            { id: 'timeGridWeek', label: t('cal.week') },
            { id: 'dayGridMonth', label: t('cal.month') }
          ]}
        />
        <Button variant="primary" onClick={newBlock}>
          <Plus size={17} />
          {t('cal.newBlock')}
        </Button>
      </header>

      <div className="mt-4 flex min-h-0 flex-1 gap-4">
        <div ref={grid} className="ff-cal min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface">
          <FullCalendar
            ref={calendar}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={view}
            headerToolbar={false}
            height="100%"
            locale={data.settings.language === 'it' ? itLocale : 'en'}
            firstDay={1}
            nowIndicator
            allDaySlot={false}
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            scrollTime={scrollTime}
            editable
            selectable
            selectMirror
            droppable
            dayMaxEvents={3}
            eventDisplay="block"
            events={events}
            eventContent={renderEvent}
            select={onSelect}
            eventClick={onClick}
            eventDrop={onMoved}
            eventResize={onMoved}
            eventReceive={onReceive}
            datesSet={(arg) => setTitle(arg.view.title)}
          />
        </div>

        <aside ref={drawer} className="flex w-[232px] shrink-0 flex-col pr-4">
          <h2 className="text-[13px] font-semibold text-muted">{t('cal.backlog')}</h2>
          <p className="mt-1 text-xs text-faint">{backlog.length > 0 ? t('cal.backlogHint') : t('cal.backlogEmpty')}</p>
          <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {backlog.map((x) => (
              <li
                key={x.id}
                data-task-id={x.id}
                className="flex cursor-grab items-center gap-2 rounded-lg border border-line bg-surface py-2 pl-2.5 pr-3 transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px hover:border-faint hover:shadow-md active:cursor-grabbing"
                style={{ borderLeft: `3px solid ${colorOf(data, x.categoryId)}` }}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{x.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted">{formatDuration(x.estimateMin)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <AnimatePresence>
        {editing && (
          <EventEditor key="editor" event={editing.event} isNew={editing.isNew} onClose={() => setEditing(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
