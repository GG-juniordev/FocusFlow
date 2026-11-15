import { Menu, Tray, app } from 'electron'
import iconPath from '../../resources/icon.ico?asset&asarUnpack'
import { translator } from '@shared/i18n'
import { focusedTask } from '@shared/model'
import { formatClock, remainingMs } from '@shared/time'
import type { AppData } from '@shared/types'
import type { Controller } from './controller'
import { isZen, markQuitting, setZenListener, showMain, toggleZen } from './windows'

let tray: Tray | null = null
let ticker: NodeJS.Timeout | null = null

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** One line describing what is in focus, for the tooltip and the menu header. */
function focusLine(data: AppData): string {
  const t = translator(data.settings.language)
  const { focus } = data
  const left = formatClock(remainingMs(focus, Date.now()))
  if (focus.phase === 'break') {
    if (focus.status === 'running') return `${t('focus.break')} · ${t('tray.left', { time: left })}`
    if (focus.status === 'finished') return t('focus.breakOver')
    return t('tray.noFocus')
  }
  const task = focusedTask(data)
  if (!task) return t('tray.noFocus')
  const title = clip(task.title, 60)
  if (focus.status === 'finished') return `${title} · ${t('focus.timeUp')}`
  if (focus.status === 'paused') return `${title} · ${t('focus.paused')} · ${left}`
  return `${title} · ${t('tray.left', { time: left })}`
}

function refreshTooltip(controller: Controller): void {
  // Windows limits tray tooltips to 127 characters.
  tray?.setToolTip(clip(`FocusFlow\n${focusLine(controller.data)}`, 127))
}

function refreshMenu(controller: Controller): void {
  if (!tray) return
  const data = controller.data
  const t = translator(data.settings.language)
  const { focus } = data
  const hasTask = focus.phase === 'focus' && focus.taskId !== null
  const running = focus.status === 'running'

  const items: Electron.MenuItemConstructorOptions[] = [
    { label: clip(focusLine(data), 80), enabled: false },
    { type: 'separator' },
    { label: t('tray.show'), click: () => showMain() }
  ]
  if (hasTask && focus.status !== 'finished') {
    items.push({
      label: running ? t('focus.pause') : focus.status === 'paused' ? t('focus.resume') : t('focus.start'),
      click: () => controller.dispatch({ type: running ? 'focus/pause' : 'focus/start' })
    })
  }
  if (hasTask) {
    items.push({ label: t('focus.complete'), click: () => controller.dispatch({ type: 'focus/complete' }) })
  }
  items.push(
    { label: t('nav.zen'), type: 'checkbox', checked: isZen(), click: () => toggleZen(controller) },
    { type: 'separator' },
    {
      label: t('tray.quit'),
      click: () => {
        markQuitting()
        app.quit()
      }
    }
  )
  tray.setContextMenu(Menu.buildFromTemplate(items))
}

export function createTray(controller: Controller): void {
  tray = new Tray(iconPath)
  tray.on('click', () => showMain())

  const refresh = (): void => {
    refreshTooltip(controller)
    refreshMenu(controller)
    // The countdown in the tooltip only needs updating while a timer is running.
    const running = controller.data.focus.status === 'running'
    if (running && !ticker) ticker = setInterval(() => refreshTooltip(controller), 1000)
    if (!running && ticker) {
      clearInterval(ticker)
      ticker = null
    }
  }

  controller.subscribe(refresh)
  // Zen mode is window state, not app data, so it reports changes separately.
  setZenListener(() => refreshMenu(controller))
  refresh()
}

export function destroyTray(): void {
  if (ticker) clearInterval(ticker)
  ticker = null
  tray?.destroy()
  tray = null
}
