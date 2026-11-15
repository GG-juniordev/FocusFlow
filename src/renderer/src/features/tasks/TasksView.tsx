import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronDown, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { sortedTasks } from '@shared/model'
import type { Task } from '@shared/types'
import { TaskMeta } from '@/components/badges'
import { ToolPills } from '@/components/tools'
import { Button, Chip, IconButton, cn } from '@/components/ui'
import { useData, useT } from '@/lib/hooks'
import { newId, useApp } from '@/state/useApp'
import { TaskEditor } from './TaskEditor'

type Editing = { task?: Task } | null

export function TasksView() {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const [filter, setFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [showDone, setShowDone] = useState(false)
  const [quick, setQuick] = useState('')

  const all = sortedTasks(data.tasks)
  const todoAll = all.filter((x) => x.status === 'todo')
  const activeFilter = filter && data.categories.some((c) => c.id === filter) ? filter : null
  const matches = (x: Task): boolean => activeFilter === null || x.categoryId === activeFilter
  const todo = todoAll.filter(matches)
  const done = all
    .filter((x) => x.status === 'done' && matches(x))
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    if (!over || active.id === over.id) return
    const visible = todo.map((x) => x.id)
    const from = visible.indexOf(String(active.id))
    const to = visible.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const moved = arrayMove(visible, from, to)
    // With a filter on, only the visible tasks swap places; hidden ones keep their slots.
    const shown = new Set(visible)
    let next = 0
    const ids = todoAll.map((x) => (shown.has(x.id) ? moved[next++] : x.id))
    dispatch({ type: 'task/reorder', ids })
  }

  const addQuick = (e: FormEvent): void => {
    e.preventDefault()
    if (!quick.trim()) return
    dispatch({ type: 'task/upsert', task: { id: newId(), title: quick, categoryId: activeFilter } })
    setQuick('')
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1040px] flex-col px-12 pb-6 pt-4">
      <header className="flex items-end justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.01em]">{t('tasks.title')}</h1>
          <span className="text-sm text-muted">{t('tasks.count', { n: todoAll.length })}</span>
        </div>
        <Button variant="primary" onClick={() => setEditing({})}>
          <Plus size={17} />
          {t('tasks.new')}
        </Button>
      </header>

      <form onSubmit={addQuick} className="mt-5">
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder={t('tasks.quickAdd')}
          aria-label={t('tasks.new')}
          className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-[15px] outline-none transition-colors focus:border-accent"
        />
      </form>

      {data.categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip selected={activeFilter === null} onClick={() => setFilter(null)}>
            {t('tasks.all')}
          </Chip>
          {data.categories.map((c) => (
            <Chip key={c.id} selected={activeFilter === c.id} color={c.color} onClick={() => setFilter(c.id)}>
              {c.name || t('set.newCategory')}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {todo.length === 0 && done.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display text-xl font-semibold">
              {activeFilter ? t('tasks.emptyFilter') : t('tasks.empty')}
            </p>
            <p className="mt-1.5 text-muted">{t('tasks.emptyHint')}</p>
          </div>
        ) : (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={todo.map((x) => x.id)} strategy={verticalListSortingStrategy}>
                <ul className={cn(todo.length > 0 && 'border-t border-line')}>
                  <AnimatePresence initial={false}>
                    {todo.map((x) => (
                      <TaskRow key={x.id} task={x} onEdit={() => setEditing({ task: x })} />
                    ))}
                  </AnimatePresence>
                </ul>
              </SortableContext>
            </DndContext>

            {done.length > 0 && (
              <section className="mt-6">
                <button
                  type="button"
                  aria-expanded={showDone}
                  onClick={() => setShowDone((v) => !v)}
                  className="flex items-center gap-1.5 rounded-md py-1 pr-2 text-[13px] font-semibold text-muted hover:text-ink"
                >
                  <ChevronDown
                    size={16}
                    className={cn('transition-transform duration-200', !showDone && '-rotate-90')}
                  />
                  {t('tasks.done')}
                  <span className="font-normal tabular-nums text-faint">{done.length}</span>
                </button>
                <AnimatePresence initial={false}>
                  {showDone && (
                    <motion.ul
                      key="done"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: EASE }}
                      className="mt-2 overflow-hidden border-t border-line"
                    >
                      <AnimatePresence initial={false}>
                        {done.map((x) => (
                          <DoneRow key={x.id} task={x} />
                        ))}
                      </AnimatePresence>
                    </motion.ul>
                  )}
                </AnimatePresence>
              </section>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {editing && <TaskEditor key="editor" task={editing.task} onClose={() => setEditing(null)} />}
      </AnimatePresence>
    </div>
  )
}

const EASE = [0.2, 0.8, 0.2, 1] as const
/** How long the tick and strike-through play before a completed task leaves the list. */
const COMPLETE_DELAY_MS = 420

/** Rows grow in when added and fold away when completed or deleted. */
const rowMotion = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0, x: -16 },
  transition: { duration: 0.22, ease: EASE }
}

function TaskRow({ task, onEdit }: { task: Task; onEdit(): void }) {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const setView = useApp((s) => s.setView)
  const [completing, setCompleting] = useState(false)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  })
  const inFocus = data.focus.taskId === task.id && data.focus.phase === 'focus'

  useEffect(() => {
    if (!completing) return
    const id = setTimeout(() => dispatch({ type: 'task/setStatus', id: task.id, status: 'done' }), COMPLETE_DELAY_MS)
    return () => clearTimeout(id)
  }, [completing, dispatch, task.id])

  return (
    // The outer item animates its height; the inner row carries the drag transform.
    // Clipping is lifted while dragging so the lifted row is not cut off.
    <motion.li {...rowMotion} style={{ overflow: isDragging ? 'visible' : 'hidden' }} className="relative">
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        className={cn(
          'group relative flex min-h-[56px] items-center gap-2 border-b border-line py-2 pr-1 transition-[background-color,box-shadow] duration-150',
          isDragging && 'z-10 rounded-lg border-transparent bg-raised shadow-lg'
        )}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={t('tasks.reorder')}
          title={t('tasks.reorder')}
          className="grid h-8 w-5 shrink-0 cursor-grab place-items-center rounded text-faint opacity-0 transition-opacity duration-150 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>

        <button
          type="button"
          aria-label={t('tasks.markDone')}
          title={t('tasks.markDone')}
          disabled={completing}
          onClick={() => setCompleting(true)}
          className={cn(
            'relative grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition-[border-color,color,transform] duration-150 active:scale-90',
            completing
              ? 'border-accent text-accent-ink'
              : 'border-faint text-transparent hover:border-accent hover:text-accent-text'
          )}
        >
          <motion.span
            className="absolute inset-[-1.5px] rounded-full bg-accent"
            initial={false}
            animate={{ scale: completing ? 1 : 0, opacity: completing ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 28 }}
          />
          <motion.span
            className="relative"
            initial={false}
            animate={completing ? { scale: [0.4, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.3, delay: completing ? 0.05 : 0 }}
          >
            <Check size={13} strokeWidth={3} />
          </motion.span>
        </button>

        <button type="button" onClick={onEdit} className="ml-1.5 min-w-0 flex-1 rounded py-0.5 text-left">
          <span className="relative inline-block max-w-full truncate align-top text-[15px] font-medium">
            <span className={cn('transition-colors duration-300', completing && 'text-muted')}>{task.title}</span>
            {/* Strike-through drawn left to right as the task is ticked off. */}
            <motion.span
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-[1.5px] w-full origin-left bg-muted"
              initial={false}
              animate={{ scaleX: completing ? 1 : 0 }}
              transition={{ duration: 0.28, ease: EASE, delay: 0.08 }}
            />
          </span>
          {(task.tools.length > 0 || task.notes) && (
            <span className="mt-1 flex min-w-0 items-center gap-2">
              <ToolPills tools={task.tools} />
              {task.notes && <span className="min-w-0 truncate text-[13px] text-muted">{task.notes}</span>}
            </span>
          )}
        </button>

        <TaskMeta task={task} className="shrink-0" />

        <div className="ml-2 flex shrink-0 items-center gap-0.5">
          {inFocus ? (
            <button
              type="button"
              onClick={() => setView('focus')}
              className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-accent-text transition-colors duration-150 hover:bg-accent-soft"
            >
              <span className="relative flex size-1.5">
                {data.focus.status === 'running' && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
                )}
                <span className="relative size-1.5 rounded-full bg-accent" />
              </span>
              {t('focus.inFocus')}
            </button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-ink"
              onClick={() => {
                dispatch({ type: 'focus/set', taskId: task.id })
                setView('focus')
              }}
            >
              {t('focus.now')}
            </Button>
          )}
          <IconButton label={t('tasks.edit')} onClick={onEdit}>
            <Pencil size={15} />
          </IconButton>
          <IconButton
            label={t('tasks.delete')}
            tone="danger"
            onClick={() => dispatch({ type: 'task/remove', id: task.id })}
          >
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>
    </motion.li>
  )
}

function DoneRow({ task }: { task: Task }) {
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  return (
    <motion.li {...rowMotion} className="overflow-hidden">
      <div className="flex h-12 items-center gap-2 border-b border-line pl-7 pr-1">
        <button
          type="button"
          aria-label={t('tasks.markTodo')}
          title={t('tasks.markTodo')}
          onClick={() => dispatch({ type: 'task/setStatus', id: task.id, status: 'todo' })}
          className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text transition-transform duration-150 active:scale-90"
        >
          <Check size={13} strokeWidth={3} />
        </button>
        <span className="ml-1.5 min-w-0 flex-1 truncate text-[15px] text-muted line-through">{task.title}</span>
        <IconButton
          label={t('tasks.delete')}
          tone="danger"
          onClick={() => dispatch({ type: 'task/remove', id: task.id })}
        >
          <Trash2 size={15} />
        </IconButton>
      </div>
    </motion.li>
  )
}

