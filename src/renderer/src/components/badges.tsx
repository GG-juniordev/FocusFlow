import { CalendarDays, Clock } from 'lucide-react'
import { formatDuration } from '@shared/time'
import type { Category, Priority, Task } from '@shared/types'
import { dueLabel, useData, useT } from '@/lib/hooks'
import { cn } from './ui'

export const PRIORITY_COLOR: Record<Priority, string> = {
  high: '#e5534b',
  medium: '#d99a2b',
  low: '#6c8fb8'
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const t = useT()
  const color = PRIORITY_COLOR[priority]
  return (
    <span
      className="inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs font-semibold"
      style={{
        color: `color-mix(in oklab, ${color} 68%, var(--ink))`,
        background: `color-mix(in oklab, ${color} 17%, transparent)`
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {t(`priority.${priority}`)}
    </span>
  )
}

export function CategoryChip({ category }: { category: Category }) {
  return (
    <span className="inline-flex max-w-36 items-center gap-1.5 text-xs font-medium text-muted">
      <span className="size-2 shrink-0 rounded-full" style={{ background: category.color }} />
      <span className="truncate">{category.name}</span>
    </span>
  )
}

/** Category, priority, estimate and date for a task, in one quiet row. */
export function TaskMeta({ task, className }: { task: Task; className?: string }) {
  const data = useData()
  const t = useT()
  const category = data.categories.find((c) => c.id === task.categoryId)
  const due = task.dueDate ? dueLabel(task.dueDate, t, data.settings.language) : null
  const late = due?.overdue && task.status === 'todo'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {category && <CategoryChip category={category} />}
      <PriorityBadge priority={task.priority} />
      <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted">
        <Clock size={13} />
        {formatDuration(task.estimateMin)}
      </span>
      {due && (
        <span
          className={cn('inline-flex items-center gap-1 text-xs', late ? 'font-semibold text-danger' : 'text-muted')}
          title={late ? t('tasks.overdue') : undefined}
        >
          <CalendarDays size={13} />
          {due.text}
        </span>
      )}
    </div>
  )
}
