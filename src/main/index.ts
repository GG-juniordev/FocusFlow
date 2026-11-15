import { join } from 'node:path'
import { app, nativeTheme, powerMonitor } from 'electron'
import { translator } from '@shared/i18n'
import { applyAutostart, launchedAtLogin } from './autostart'
import { Controller } from './controller'
import { registerIpc } from './ipc'
import { notify, startNotifications } from './notify'
import { JsonStore } from './store'
import { startCloud } from './sync/cloud'
import { createTray, destroyTray } from './tray'
import {
  applyWindowSettings,
  broadcast,
  createMainWindow,
  markQuitting,
  setHideToTrayHandler,
  showMain
} from './windows'

const APP_ID = 'com.focusflow.app'

app.setName('FocusFlow')
// Data lives in %APPDATA%\FocusFlow. Tests point this elsewhere so they never touch real data.
app.setPath('userData', process.env['FOCUSFLOW_DATA_DIR'] || join(app.getPath('appData'), 'FocusFlow'))

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showMain())

  void app.whenReady().then(() => {
    // Windows needs an AppUserModelID to attribute toast notifications to the app.
    app.setAppUserModelId(app.isPackaged ? APP_ID : process.execPath)

    const controller = new Controller(new JsonStore(app.getPath('userData')))
    nativeTheme.themeSource = controller.data.settings.theme

    registerIpc(controller)
    // Optional cloud sync. Without Supabase settings this stays in local mode and does nothing.
    const cloud = startCloud(controller)
    // Background work must never take the app down with it.
    process.on('unhandledRejection', (reason) => console.error('FocusFlow: unhandled rejection', reason))

    controller.subscribe((next, prev) => {
      broadcast(next)
      if (next.settings !== prev.settings) {
        applyWindowSettings(next)
        if (next.settings.launchAtStartup !== prev.settings.launchAtStartup) {
          applyAutostart(next.settings.launchAtStartup)
        }
      }
    })
    nativeTheme.on('updated', () => applyWindowSettings(controller.data))

    setHideToTrayHandler(() => {
      if (controller.meta.trayHintShown) return
      controller.updateMeta((meta) => {
        meta.trayHintShown = true
      })
      const t = translator(controller.data.settings.language)
      notify(controller.data, t('tray.hintTitle'), t('tray.hintBody'))
    })

    const startHidden = launchedAtLogin() && controller.data.settings.startMinimized
    createMainWindow(controller, !startHidden)
    createTray(controller)
    const stopNotifications = startNotifications(controller)
    applyAutostart(controller.data.settings.launchAtStartup)

    // A sleeping PC does not fire timers: catch up on a countdown that ended meanwhile.
    powerMonitor.on('resume', () => controller.dispatch({ type: 'focus/tick' }))

    app.on('before-quit', () => {
      markQuitting()
      stopNotifications()
      // Credit the time worked so far and leave the timer paused for next launch.
      controller.dispatch({ type: 'focus/pause' })
      cloud.dispose()
      controller.dispose()
      controller.flush()
      destroyTray()
    })
  })

  // Closing every window must not end the app: it lives in the tray.
  app.on('window-all-closed', () => {})
}
