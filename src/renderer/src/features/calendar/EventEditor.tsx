import { useState, type FormEvent } from 'react'
import { Link2 } from 'lucide-react'
import { eventMinutes, formatDuration } from '@shared/time'
import type { CalendarEvent } from '@shared/types'
import { Button, Chip, Field, Group, Modal, inputBase, inputClass } from '@/components/ui'
import { useData, useT } from '@/lib/hooks'
import { newId, useApp } from '@/state/useApp'

const pad = (n: number): string => String(n).padStart(2, '0')

/** ISO timestamp -> value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** Create or edit a time block. `isNew` blocks are only stored once saved. */
export function EventEditor({ event, isNew, onClose }: { event: CalendarEvent; isNew: boolean; onClose(): void }) {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const setView = useApp((s) => s.setView)

  const [title, setTitle] = useState(event.title)
  const [notes, setNotes] = useState(event.notes)
  const [start, setStart] = useState(toLocalInput(event.start))
  const [end, setEnd] = useState(toLocalInput(event.end))
  const [categoryId, setCategoryId] = useState(event.categoryId)

  const startIso = fromLocalInput(start)
  const endIso = fromLocalInput(end)
  const ordered = startIso !== null && endIso !== null && Date.parse(endIso) > Date.parse(startIso)
  const valid = title.trim() !== '' && ordered
  const linkedTask = event.taskId ? data.tasks.find((x) => x.id === event.taskId) : undefined

  const persist = (): boolean => {
    if (!valid || !startIso || !endIso) return false
    dispatch({
      type: 'event/upsert',
      event: { id: event.id, title, notes, start: startIso, end: endIso, categoryId, taskId: event.taskId }
    })
    return true
  }

  const save = (e: FormEvent): void => {
    e.preventDefault()
    if (persist()) onClose()
  }

  // Moving the start keeps the block the same length.
  const changeStart = (value: string): void => {
    const next = fromLocalInput(value)
    if (next && startIso && endIso && ordered) {
      const length = Date.parse(endIso) - Date.parse(startIso)
      setEnd(toLocalInput(new Date(Date.parse(next) + length).toISOString()))
    }
    setStart(value)
  }

  return (
    <Modal
      title={isNew ? t('cal.newBlock') : t('cal.editBlock')}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: 'event/remove', id: event.id })
                onClose()
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          {linkedTask ? (
            <Button
              disabled={!valid}
              onClick={() => {
                if (!persist()) return
                dispatch({ type: 'focus/set', taskId: linkedTask.id })
                setView('focus')
                onClose()
              }}
            >
              {t('focus.now')}
            </Button>
          ) : (
            <Button
              disabled={!valid}
              onClick={() => {
                if (!persist()) return
                dispatch({ type: 'event/toTask', id: event.id, taskId: newId() })
                onClose()
              }}
            >
              {t('cal.toTask')}
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="event-form" disabled={!valid}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={save} className="space-y-4">
        <Field label={t('field.title')}>
          <input
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('cal.blockTitle')}
            className={`${inputClass} h-10 text-[15px]`}
          />
        </Field>

        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('field.start')}>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => changeStart(e.target.value)}
              className={`${inputBase} w-[200px]`}
            />
          </Field>
          <Field label={t('field.end')}>
            <input
              type="datetime-local"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              className={`${inputBase} w-[200px]`}
            />
          </Field>
          {ordered && startIso && endIso && (
            <span className="pb-2 text-[13px] tabular-nums text-muted">
              {t('field.length')}: {formatDuration(eventMinutes(startIso, endIso))}
            </span>
          )}
        </div>
        {!ordered && (
          <p role="alert" className="text-[13px] text-danger">
            {t('cal.endBeforeStart')}
          </p>
        )}

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

        <Field label={t('field.notes')}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={t('field.notesPlaceholder')}
            className={`${inputClass} h-auto resize-none py-2`}
          />
        </Field>

        {linkedTask && (
          <p className="flex items-center gap-1.5 text-[13px] text-muted">
            <Link2 size={14} />
            {t('cal.linked')}: <span className="truncate font-medium text-ink">{linkedTask.title}</span>
          </p>
        )}
      </form>
    </Modal>
  )
}
