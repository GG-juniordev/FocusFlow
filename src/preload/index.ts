import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type Action, type Api, type AppData, type CloudCommand, type CloudState, type WindowCommand } from '@shared/types'

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
  openExternal: (url: string) => ipcRenderer.send(IPC.openExternal, url),
  getCloud: () => ipcRenderer.invoke(IPC.getCloud),
  onCloud: (listener) => {
    const handler = (_event: IpcRendererEvent, state: CloudState): void => listener(state)
    ipcRenderer.on(IPC.cloud, handler)
    return () => {
      ipcRenderer.removeListener(IPC.cloud, handler)
    }
  },
  cloudCommand: (command: CloudCommand) => ipcRenderer.invoke(IPC.cloudCommand, command),
  ready: () => ipcRenderer.send(IPC.ready)
}

contextBridge.exposeInMainWorld('api', api)
