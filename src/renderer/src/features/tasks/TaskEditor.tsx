import { useState, type FormEvent } from 'react'
import type { Priority, Subtask, Task, ToolRef } from '@shared/types'
import { SubtasksEditor } from '@/components/subtasks'
import { DurationPicker } from '@/components/DurationPicker'
import { ToolsPicker } from '@/components/tools'
import { Button, Chip, Field, Group, Modal, Segmented, inputBase, inputClass } from '@/components/ui'
import { useData, useT } from '@/lib/hooks'
import { newId, useApp } from '@/state/useApp'

/** Create a task (`task` omitted) or edit an existing one. */
export function TaskEditor({ task, onClose }: { task?: Task; onClose(): void }) {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)

  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [estimateMin, setEstimateMin] = useState(task?.estimateMin ?? data.settings.focusMin)
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [categoryId, setCategoryId] = useState<string | null>(task?.categoryId ?? null)
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [tools, setTools] = useState<ToolRef[]>(task?.tools ?? [])
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? [])

  const save = (e: FormEvent): void => {
    e.preventDefault()
    if (!title.trim()) return
    dispatch({
      type: 'task/upsert',
      task: { id: task?.id ?? newId(), title, notes, tools, subtasks, estimateMin, priority, categoryId, dueDate: dueDate || null }
    })
    onClose()
  }

  return (
    <Modal
      title={task ? t('tasks.edit') : t('tasks.new')}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        <>
          {task && (
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: 'task/remove', id: task.id })
                onClose()
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="task-form" disabled={!title.trim()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={save} className="space-y-4">
        <Field label={t('field.title')}>
          <input
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputClass} h-10 text-[15px]`}
          />
        </Field>
        <Field label={t('field.notes')}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={t('field.notesPlaceholder')}
            className={`${inputClass} h-auto resize-none py-2`}
          />
        </Field>
        <Group label={t('field.subtasks')}>
          <SubtasksEditor value={subtasks} onChange={setSubtasks} />
        </Group>
        <Group label={t('field.tools')}>
          <ToolsPicker value={tools} onChange={setTools} />
        </Group>
        <Group label={t('field.duration')}>
          <DurationPicker value={estimateMin} onChange={setEstimateMin} />
        </Group>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Group label={t('field.priority')}>
            <Segmented<Priority>
              label={t('field.priority')}
              value={priority}
              onChange={setPriority}
              options={[
                { id: 'high', label: t('priority.high') },
                { id: 'medium', label: t('priority.medium') },
                { id: 'low', label: t('priority.low') }
              ]}
            />
          </Group>
          <Field label={t('field.due')}>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`${inputBase} w-44`}
            />
          </Field>
        </div>
        <Group label={t('field.category')}>
          <div className="flex flex-wrap gap-2">
            <Chip selected={categoryId === null} onClick={() => setCategoryId(null)}>
              {t('tasks.none')}
            </Chip>
            {data.categories.map((c) => (
              <Chip key={c.id} selected={categoryId === c.id} color={c.color} onClick={() => setCategoryId(c.id)}>
                {c.name || t('set.newCategory')}
              </Chip>
            ))}
          </div>
        </Group>
      </form>
    </Modal>
  )
}
