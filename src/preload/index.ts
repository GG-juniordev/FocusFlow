import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type Action, type Api, type AppData, type WindowCommand } from '@shared/types'

const api: Api = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  getEnv: () => ipcRenderer.invoke(IPC.getEnv),
  dispatch: (action: Action) => ipcRenderer.invoke(IPC.dispatch, action),
  onState: (listener) => {
    const handler = (_event: IpcRendererEvent, data: AppData): void => listener(data)
    ipcRenderer.on(IPC.state, handler)
    return () => {
      ipcRenderer.removeListener(IPC.state, handler)
    }
  },
  windowCommand: (command: WindowCommand) => ipcRenderer.send(IPC.window, command),
  openExternal: (url: string) => ipcRenderer.send(IPC.openExternal, url)
}

contextBridge.exposeInMainWorld('api', api)
