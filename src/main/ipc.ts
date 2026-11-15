import { app, ipcMain, shell } from 'electron'
import { isSafeUrl } from '@shared/tools'
import { IPC, type Action, type AppEnv, type WindowCommand } from '@shared/types'
import type { Controller } from './controller'
import { markQuitting, showMain, toggleZen } from './windows'

export function registerIpc(controller: Controller): void {
  ipcMain.handle(IPC.getState, () => controller.data)

  ipcMain.handle(
    IPC.getEnv,
    (): AppEnv => ({
      packaged: app.isPackaged,
      dataPath: app.getPath('userData'),
      version: app.getVersion()
    })
  )

  ipcMain.handle(IPC.dispatch, (_event, action: Action) => {
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') return
    controller.dispatch(action)
  })

  // Tool links come from user data: only open web and known app links, never files or scripts.
  ipcMain.on(IPC.openExternal, (_event, url: unknown) => {
    if (typeof url === 'string' && isSafeUrl(url)) void shell.openExternal(url)
  })

  ipcMain.on(IPC.window, (_event, command: WindowCommand) => {
    switch (command) {
      case 'toggle-zen':
        toggleZen(controller)
        break
      case 'show-main':
        showMain()
        break
      case 'open-data-folder':
        void shell.openPath(app.getPath('userData'))
        break
      case 'quit':
        markQuitting()
        app.quit()
        break
    }
  })
}
