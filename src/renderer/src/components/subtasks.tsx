import { useState, type KeyboardEvent } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronRight, GripVertical, X } from 'lucide-react'
import { MAX_SUBTASKS, subtaskProgress } from '@shared/subtasks'
import type { Subtask, Task } from '@shared/types'
import { useT } from '@/lib/hooks'
import { newId, useApp } from '@/state/useApp'
import { cn, inputBase } from './ui'

/** "2/5 steps" with a small bar. */
export function SubtaskProgress({ subtasks, className }: { subtasks: Subtask[]; className?: string }) {
  const t = useT()
  const { done, total } = subtaskProgress(subtasks)
  if (total === 0) return null
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-2 text-xs tabular-nums', className)}>
      <span className={done === total ? 'font-semibold text-accent-text' : 'text-muted'}>
        {t('subtasks.progress', { done, total })}
      </span>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </span>
    </span>
  )
}

/** Progress that doubles as a show/hide switch for the checklist on a task card. */
export function SubtaskToggle({ subtasks, open, onToggle }: { subtasks: Subtask[]; open: boolean; onToggle(): void }) {
  const t = useT()
  if (subtasks.length === 0) return null
  return (
    <button
      type="button"
      aria-expanded={open}
      title={open ? t('subtasks.hide') : t('subtasks.show')}
      aria-label={`${open ? t('subtasks.hide') : t('subtasks.show')} (${t('subtasks.progress', subtaskProgress(subtasks))})`}
      onClick={onToggle}
      className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full border border-line pl-1 pr-2 transition-colors duration-150 hover:border-faint"
    >
      <ChevronRight size={13} className={cn('text-faint transition-transform duration-200', open && 'rotate-90')} />
      <SubtaskProgress subtasks={subtasks} />
    </button>
  )
}

const box = (done: boolean): string =>
  cn(
    'grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-[background-color,border-color,transform] duration-150 active:scale-90',
    done ? 'border-accent bg-accent text-accent-ink' : 'border-faint text-transparent hover:border-accent'
  )

/** The steps of a task, tickable in place. Each tick is saved straight away. */
export function SubtaskChecklist({ task, className }: { task: Task; className?: string }) {
  const dispatch = useApp((s) => s.dispatch)
  if (task.subtasks.length === 0) return null
  return (
    <ul className={cn('space-y-0.5', className)} data-testid="subtask-list">
      {task.subtasks.map((s) => (
        <li key={s.id}>
          <label className="flex min-h-7 cursor-pointer items-start gap-2.5 rounded-md py-1 pr-2 hover:bg-raised/60">
            <input
              type="checkbox"
              checked={s.isCompleted}
              onChange={() => dispatch({ type: 'task/toggleSubtask', taskId: task.id, subtaskId: s.id })}
              className="peer sr-only"
            />
            <span className={cn(box(s.isCompleted), 'mt-px peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent')}>
              <Check size={12} strokeWidth={3.2} />
            </span>
            <span className={cn('min-w-0 break-words text-[13.5px] leading-snug transition-colors duration-200', s.isCompleted && 'text-muted line-through')}>
              {s.title}
            </span>
          </label>
        </li>
      ))}
    </ul>
  )
}

function EditableStep({ step, onChange, onRemove }: { step: Subtask; onChange(next: Subtask): void; onRemove(): void }) {
  const t = useT()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('flex items-center gap-1.5 rounded-lg', isDragging && 'relative z-10 bg-raised shadow-lg')}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={t('subtasks.reorder')}
        title={t('subtasks.reorder')}
        className="grid h-8 w-5 shrink-0 cursor-grab place-items-center rounded text-faint hover:text-ink active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} />
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={step.isCompleted}
        aria-label={step.title}
        onClick={() => onChange({ ...step, isCompleted: !step.isCompleted })}
        className={box(step.isCompleted)}
      >
        <Check size={12} strokeWidth={3.2} />
      </button>
      <input
        value={step.title}
        aria-label={t('subtasks.title')}
        onChange={(e) => onChange({ ...step, title: e.target.value })}
        // Enter here must not submit the task form.
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
        className={cn(inputBase, 'h-8 min-w-0 flex-1 border-transparent bg-transparent px-2 hover:border-line', step.isCompleted && 'text-muted line-through')}
      />
      <button
        type="button"
        aria-label={`${t('subtasks.remove')}: ${step.title}`}
        title={t('subtasks.remove')}
        onClick={onRemove}
        className="grid size-7 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <X size={14} />
      </button>
    </li>
  )
}

/** Checklist editor for the task form: add, rename, tick, reorder (drag) and remove steps. */
export function SubtasksEditor({ value, onChange }: { value: Subtask[]; onChange(next: Subtask[]): void }) {
  const t = useT()
  const [text, setText] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const renumber = (list: Subtask[]): Subtask[] => list.map((s, position) => ({ ...s, position }))

  const add = (): void => {
    const title = text.trim()
    if (!title || value.length >= MAX_SUBTASKS) return
    onChange(renumber([...value, { id: newId(), title, isCompleted: false, position: value.length }]))
    setText('')
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    add()
  }

  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    if (!over || active.id === over.id) return
    const from = value.findIndex((s) => s.id === active.id)
    const to = value.findIndex((s) => s.id === over.id)
    if (from >= 0 && to >= 0) onChange(renumber(arrayMove(value, from, to)))
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-1.5 flex justify-end">
          <SubtaskProgress subtasks={value} />
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={value.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-0.5" data-testid="subtask-editor">
            {value.map((step) => (
              <EditableStep
                key={step.id}
                step={step}
                onChange={(next) => onChange(value.map((s) => (s.id === step.id ? next : s)))}
                onRemove={() => onChange(renumber(value.filter((s) => s.id !== step.id)))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        disabled={value.length >= MAX_SUBTASKS}
        placeholder={t('subtasks.add')}
        aria-label={t('subtasks.add')}
        className={cn(inputBase, 'mt-1.5 w-full')}
      />
    </div>
  )
}
