import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, useAnimate } from 'motion/react'
import type { DateSelectArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core'
import itLocale from '@fullcalendar/core/locales/it'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, {
  Draggable,
  type EventReceiveArg,
  type EventResizeDoneArg
} from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { ChevronLeft, ChevronRight, Circle, CircleCheck, Pencil, Plus, Target } from 'lucide-react'
import { sortedTasks } from '@shared/model'
import { MINUTE, formatDuration, toDateKey } from '@shared/time'
import type { AppData, CalendarEvent, Task } from '@shared/types'
import { TaskMeta } from '@/components/badges'
import { SubtaskChecklist, SubtaskProgress } from '@/components/subtasks'
import { Button, IconButton, Modal, Segmented } from '@/components/ui'
import { TaskEditor } from '@/features/tasks/TaskEditor'
import { useData, useT } from '@/lib/hooks'
import { newId, useApp } from '@/state/useApp'
import { EventEditor } from './EventEditor'

type CalView = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth'
type Editing = { event: CalendarEvent; isNew: boolean } | null

const FALLBACK_COLOR = 'var(--accent)'
/** Calendar ids of dated tasks that have no time yet ("flexible" entries). */
const TASK_PREFIX = 'task:'

const colorOf = (data: AppData, categoryId: string | null): string =>
  data.categories.find((c) => c.id === categoryId)?.color ?? FALLBACK_COLOR

/** A day picked without a time: start the block at 09:00. */
function atNine(day: Date): Date {
  const d = new Date(day)
  d.setHours(9, 0, 0, 0)
  return d
}

function renderEvent(arg: EventContentArg) {
  const { color, done, kind } = arg.event.extendedProps as { color?: string; done?: boolean; kind?: 'task' | 'block' }
  const style = { '--c': color ?? FALLBACK_COLOR } as CSSProperties
  if (kind === 'task') {
    // A task with a day but no time: outlined, with a tick circle, so it reads as "to do sometime today".
    const Mark = done ? CircleCheck : Circle
    return (
      <div className="ff-ev ff-ev-task" data-done={done ? 'true' : 'false'} style={style} title={arg.event.title}>
        <Mark size={12} className="ff-ev-mark" />
        <span className="ff-ev-title truncate">{arg.event.title}</span>
      </div>
    )
  }
  const month = arg.view.type === 'dayGridMonth'
  return (
    <div className="ff-ev" data-done={done ? 'true' : 'false'} style={style} title={arg.event.title}>
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
  const [peekId, setPeekId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  // The drag source is set up once; it reads the latest data through this ref.
  const latest = useRef(data)
  useEffect(() => {
    latest.current = data
  }, [data])

  const scheduled = useMemo(() => new Set(data.events.map((e) => e.taskId).filter(Boolean)), [data.events])
  // Backlog: to-do tasks that are not on the calendar at all (no time block and no day).
  const backlog = sortedTasks(data.tasks).filter((x) => x.status === 'todo' && !scheduled.has(x.id) && !x.dueDate)

  const events = useMemo<EventInput[]>(() => {
    const blocks: EventInput[] = data.events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      extendedProps: {
        kind: 'block',
        taskId: e.taskId,
        color: colorOf(data, e.categoryId),
        done: e.taskId ? data.tasks.find((x) => x.id === e.taskId)?.status === 'done' : false
      }
    }))
    // Every task with a day but no time block appears in the Flexible row of that day.
    const flexible: EventInput[] = data.tasks
      .filter((x) => x.dueDate && !scheduled.has(x.id))
      .map((x) => ({
        id: TASK_PREFIX + x.id,
        title: x.title,
        start: x.dueDate as string,
        allDay: true,
        durationEditable: false,
        extendedProps: { kind: 'task', taskId: x.id, color: colorOf(data, x.categoryId), done: x.status === 'done' }
      }))
    return [...blocks, ...flexible]
  }, [data, scheduled])

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
          extendedProps: { kind: 'block', taskId: task?.id, color: colorOf(latest.current, task?.categoryId ?? null) }
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

  const blockFor = (task: Task, start: Date): void => {
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
    // The task's day follows where its time block was put.
    dispatch({ type: 'task/upsert', task: { id: task.id, dueDate: toDateKey(start) } })
  }

  const onSelect = (arg: DateSelectArg): void => {
    const start = arg.allDay ? atNine(arg.start) : arg.start
    const end = arg.allDay ? new Date(start.getTime() + data.settings.focusMin * MINUTE) : arg.end
    arg.view.calendar.unselect()
    setEditing({
      isNew: true,
      event: { id: newId(), title: '', notes: '', start: start.toISOString(), end: end.toISOString(), categoryId: null, taskId: null }
    })
  }

  const onClick = (arg: EventClickArg): void => {
    const props = arg.event.extendedProps as { kind?: string; taskId?: string }
    if (props.kind === 'task' && props.taskId) {
      setPeekId(props.taskId)
      return
    }
    const event = data.events.find((e) => e.id === arg.event.id)
    if (event) setEditing({ event, isNew: false })
  }

  const onResized = (arg: EventResizeDoneArg): void => {
    const { id, start, end } = arg.event
    if (!start || !end) return arg.revert()
    dispatch({ type: 'event/upsert', event: { id, start: start.toISOString(), end: end.toISOString() } })
  }

  const onDropped = (arg: EventDropArg): void => {
    const { event } = arg
    const props = event.extendedProps as { kind?: string; taskId?: string | null }
    const start = event.start
    if (!start) return arg.revert()

    if (props.kind === 'task') {
      const task = data.tasks.find((x) => x.id === props.taskId)
      if (!task) return arg.revert()
      // Still in the Flexible row (or another day in month view): only the day changes.
      if (event.allDay) dispatch({ type: 'task/upsert', task: { id: task.id, dueDate: toDateKey(start) } })
      // Dropped onto an hour: it gets a time block of its estimated length.
      else blockFor(task, start)
      return
    }

    const block = data.events.find((e) => e.id === event.id)
    if (!block) return arg.revert()
    if (event.allDay) {
      // A block dragged up into the Flexible row: a task's block is dropped and the
      // task keeps the day; a plain block has no "flexible" form, so it goes back.
      if (!block.taskId) return arg.revert()
      dispatch({ type: 'event/remove', id: block.id })
      dispatch({ type: 'task/upsert', task: { id: block.taskId, dueDate: toDateKey(start) } })
      return
    }
    const length = Date.parse(block.end) - Date.parse(block.start)
    const end = event.end ?? new Date(start.getTime() + length)
    dispatch({ type: 'event/upsert', event: { id: block.id, start: start.toISOString(), end: end.toISOString() } })
  }

  // A backlog task was dropped on the calendar.
  const onReceive = (arg: EventReceiveArg): void => {
    const taskId = arg.event.extendedProps.taskId as string | undefined
    const dropped = arg.event.start
    const allDay = arg.event.allDay
    // The calendar is driven by app state, so discard its own copy of the dropped event.
    arg.event.remove()
    const task = data.tasks.find((x) => x.id === taskId)
    if (!task || !dropped) return
    // On the Flexible row or a month day it only gets that day; on an hour it gets a time block.
    if (allDay) dispatch({ type: 'task/upsert', task: { id: task.id, dueDate: toDateKey(dropped) } })
    else blockFor(task, dropped)
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
  const peek = peekId ? data.tasks.find((x) => x.id === peekId) : undefined
  const editingTask = editingTaskId ? data.tasks.find((x) => x.id === editingTaskId) : undefined

  return (
    <div className="flex h-full flex-col pb-4 pl-8 pr-4 pt-4">
      <header className="flex flex-wrap items-center gap-2 pr-4">
        <h1 className="mr-2 min-w-[200px] truncate font-display text-[24px] font-semibold tracking-[-0.01em] first-letter:uppercase">
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
            allDaySlot
            allDayText={t('cal.flexible')}
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
            eventDrop={onDropped}
            eventResize={onResized}
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
                title={x.title}
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
        {peek && !editingTask && (
          <FlexibleTask
            key="peek"
            task={peek}
            onClose={() => setPeekId(null)}
            onEdit={() => {
              setEditingTaskId(peek.id)
              setPeekId(null)
            }}
          />
        )}
        {editingTask && <TaskEditor key="task-editor" task={editingTask} onClose={() => setEditingTaskId(null)} />}
      </AnimatePresence>
    </div>
  )
}

/** A task that has a day but no time: start it now, tick its steps, or open it for editing. */
function FlexibleTask({ task, onClose, onEdit }: { task: Task; onClose(): void; onEdit(): void }) {
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const setView = useApp((s) => s.setView)

  return (
    <Modal
      title={task.title}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onEdit}>
            <Pencil size={15} />
            {t('cal.editTask')}
          </Button>
          <span className="flex-1" />
          <Button
            variant="primary"
            data-autofocus
            onClick={() => {
              dispatch({ type: 'focus/set', taskId: task.id })
              setView('focus')
              onClose()
            }}
          >
            <Target size={16} />
            {t('focus.now')}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TaskMeta task={task} />
        <SubtaskProgress subtasks={task.subtasks} />
      </div>
      {task.notes && <p className="mt-3 line-clamp-4 whitespace-pre-line text-[14px] text-muted">{task.notes}</p>}
      <SubtaskChecklist task={task} className="mt-3 max-h-48 overflow-y-auto" />
      <p className="mt-4 text-[13px] text-faint">{t('cal.flexibleHint')}</p>
    </Modal>
  )
}
