import { Notification } from 'electron'
import iconPath from '../../resources/icon.png?asset&asarUnpack'
import { translator } from '@shared/i18n'
import { dueReminders } from '@shared/model'
import { MINUTE } from '@shared/time'
import type { AppData } from '@shared/types'
import type { Controller } from './controller'
import { showMain } from './windows'

const REMINDER_LEAD_MS = 5 * MINUTE
const CHECK_EVERY_MS = 20_000

// Hold a reference until the toast closes, or it can be collected before a click is delivered.
const open = new Set<Notification>()
const reminded = new Set<string>()

export function notify(data: AppData, title: string, body: string): void {
  if (!Notification.isSupported()) return
  const toast = new Notification({
    title,
    body,
    icon: iconPath,
    silent: !data.settings.notificationSounds
  })
  open.add(toast)
  toast.on('click', () => showMain())
  toast.on('close', () => open.delete(toast))
  toast.on('failed', () => open.delete(toast))
  toast.show()
}

function checkReminders(controller: Controller): void {
  const data = controller.data
  const now = Date.now()
  const t = translator(data.settings.language)
  const locale = data.settings.language === 'it' ? 'it-IT' : 'en-US'
  for (const event of dueReminders(data.events, now, reminded, REMINDER_LEAD_MS)) {
    const start = new Date(event.start)
    const minutes = Math.max(1, Math.round((start.getTime() - now) / MINUTE))
    notify(
      data,
      t('notify.soonTitle', { n: minutes }),
      t('notify.soonBody', {
        title: event.title,
        time: start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      })
    )
  }
}

export function startNotifications(controller: Controller): () => void {
  const unsubscribe = controller.subscribe((next, prev) => {
    if (prev.focus.status !== 'running' || next.focus.status !== 'finished') return
    const t = translator(next.settings.language)
    if (next.focus.phase === 'break') {
      notify(next, t('notify.breakOverTitle'), t('notify.breakOverBody'))
    } else {
      const task = next.tasks.find((x) => x.id === next.focus.taskId)
      notify(next, t('notify.timeUpTitle'), t('notify.timeUpBody', { task: task?.title ?? '' }))
    }
  })

  const interval = setInterval(() => checkReminders(controller), CHECK_EVERY_MS)
  checkReminders(controller)

  return () => {
    unsubscribe()
    clearInterval(interval)
  }
}
