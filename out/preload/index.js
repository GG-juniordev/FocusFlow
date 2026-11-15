let electron = require("electron");
// src/shared/types.ts
var IPC = {
	getState: "ff:get-state",
	getEnv: "ff:get-env",
	dispatch: "ff:dispatch",
	state: "ff:state",
	window: "ff:window",
	openExternal: "ff:open-external",
	getCloud: "ff:get-cloud",
	cloud: "ff:cloud",
	cloudCommand: "ff:cloud-command",
	ready: "ff:ready"
};
// src/preload/index.ts
electron.contextBridge.exposeInMainWorld("api", {
	getState: () => electron.ipcRenderer.invoke(IPC.getState),
	getEnv: () => electron.ipcRenderer.invoke(IPC.getEnv),
	dispatch: (action) => electron.ipcRenderer.invoke(IPC.dispatch, action),
	onState: (listener) => {
		const handler = (_event, data) => listener(data);
		electron.ipcRenderer.on(IPC.state, handler);
		return () => {
			electron.ipcRenderer.removeListener(IPC.state, handler);
		};
	},
	windowCommand: (command) => electron.ipcRenderer.send(IPC.window, command),
	openExternal: (url) => electron.ipcRenderer.send(IPC.openExternal, url),
	getCloud: () => electron.ipcRenderer.invoke(IPC.getCloud),
	onCloud: (listener) => {
		const handler = (_event, state) => listener(state);
		electron.ipcRenderer.on(IPC.cloud, handler);
		return () => {
			electron.ipcRenderer.removeListener(IPC.cloud, handler);
		};
	},
	cloudCommand: (command) => electron.ipcRenderer.invoke(IPC.cloudCommand, command),
	ready: () => electron.ipcRenderer.send(IPC.ready)
});
