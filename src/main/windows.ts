import { join } from 'node:path'
import { BrowserWindow, app, ipcMain, nativeTheme, screen, shell } from 'electron'
import iconPath from '../../resources/icon.ico?asset&asarUnpack'
import { windowChrome } from '@shared/palette'
import { IPC, type AppData, type Settings } from '@shared/types'
import type { Controller } from './controller'

const MINI = { width: 520, height: 76 }

let currentSettings: Settings | null = null

let mainWindow: BrowserWindow | null = null
let miniWindow: BrowserWindow | null = null
let quitting = false
let zen = false
let onHideToTray: () => void = () => {}
let onZenChange: () => void = () => {}

/** Title bar colours: follow the custom background when one is set. */
const chrome = (): { bg: string; symbol: string } =>
  currentSettings
    ? windowChrome(currentSettings, nativeTheme.shouldUseDarkColors)
    : nativeTheme.shouldUseDarkColors
      ? { bg: '#161a24', symbol: '#98a1b5' }
      : { bg: '#eef1f6', symbol: '#5a6478' }
const alive = (win: BrowserWindow | null): win is BrowserWindow => win !== null && !win.isDestroyed()

export function markQuitting(): void {
  quitting = true
}

export function setHideToTrayHandler(handler: () => void): void {
  onHideToTray = handler
}

function webPreferences(): Electron.WebPreferences {
  return {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
}

const READY_WAIT_MS = 6_000
const MAX_RELOADS = 3
const FALLBACK_RETRY_MS = 15_000

const fallbackPage = (reason: string): string =>
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(`<!doctype html><meta charset="utf-8"><title>FocusFlow</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#161a24;color:#e9ecf3;font-family:Segoe UI,system-ui,sans-serif;-webkit-app-region:drag">
<div style="max-width:520px;padding:32px"><h1 style="font-size:22px;margin:0 0 8px">FocusFlow could not show its window</h1>
<p style="color:#98a1b5;font-size:15px;line-height:1.5;margin:0">The interface failed to load, so this page is shown instead of a blank window. Your tasks and settings are safe on this PC. FocusFlow retries automatically every few seconds. If this stays, quit from the tray icon and start it again.</p>
<pre style="margin-top:16px;padding:12px;border-radius:8px;background:#11141c;color:#98a1b5;font-size:12px;white-space:pre-wrap">${reason.replace(/[<&]/g, ' ')}</pre></div></body>`)

/**
 * Load the UI into a window and make sure it actually appears.
 *
 * The page reports back once React has drawn something. If that does not happen
 * in time (a failed load, or in development the dev server restarting mid-load),
 * the page is reloaded a few times; after that a plain explanatory page is shown
 * and loading is retried in the background. A window is never left blank.
 */
function load(win: BrowserWindow, hash?: string): void {
  const wc = win.webContents
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  let reloads = 0
  let showingFallback = false
  let timer: NodeJS.Timeout | null = null

  const loadApp = (): void => {
    showingFallback = false
    const done =
      !app.isPackaged && devUrl
        ? win.loadURL(hash ? `${devUrl}#${hash}` : devUrl)
        : win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
    // Failures are handled by did-fail-load below.
    done.catch(() => {})
  }

  const later = (ms: number, run: () => void): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (!win.isDestroyed()) run()
    }, ms)
  }

  const recover = (reason: string): void => {
    if (reloads < MAX_RELOADS) {
      reloads++
      console.warn(`FocusFlow: window did not come up (${reason}); reloading, attempt ${reloads}`)
      later(reloads * 700, loadApp)
      return
    }
    console.error(`FocusFlow: window still not up after ${MAX_RELOADS} reloads (${reason})`)
    showingFallback = true
    void wc.loadURL(fallbackPage(reason)).catch(() => {})
    later(FALLBACK_RETRY_MS, loadApp)
  }

  const onReady = (event: Electron.IpcMainEvent): void => {
    if (event.sender !== wc) return
    reloads = 0
    if (timer) clearTimeout(timer)
    timer = null
  }
  ipcMain.on(IPC.ready, onReady)

  wc.on('did-finish-load', () => {
    if (showingFallback) return
    later(READY_WAIT_MS, () => recover('the interface did not start'))
  })
  wc.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    // -3 is "aborted", which is what a deliberate reload looks like.
    if (!isMainFrame || code === -3 || showingFallback) return
    recover(`${description} (${code})`)
  })
  wc.on('render-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit') recover(`the window process stopped: ${details.reason}`)
  })
  win.on('closed', () => {
    if (timer) clearTimeout(timer)
    ipcMain.removeListener(IPC.ready, onReady)
  })

  loadApp()
}

function onScreen(x: number, y: number, width: number, height: number): boolean {
  return screen.getAllDisplays().some(({ workArea: a }) => {
    const overlapX = Math.min(x + width, a.x + a.width) - Math.max(x, a.x)
    const overlapY = Math.min(y + height, a.y + a.height) - Math.max(y, a.y)
    return overlapX >= 120 && overlapY >= 40
  })
}

function lockNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // Allow reloading the app's own page (dev hot reload); block navigating anywhere else.
  win.webContents.on('will-navigate', (event, url) => {
    const page = (u: string): string => u.split('#')[0]
    if (page(url) !== page(win.webContents.getURL())) event.preventDefault()
  })
}

export function createMainWindow(controller: Controller, show: boolean): BrowserWindow {
  currentSettings = controller.data.settings
  const saved = controller.meta.window.main
  const usable = saved && onScreen(saved.x, saved.y, saved.width, saved.height) ? saved : undefined

  const win = new BrowserWindow({
    width: usable?.width ?? 1180,
    height: usable?.height ?? 760,
    x: usable?.x,
    y: usable?.y,
    minWidth: 940,
    minHeight: 620,
    show: false,
    title: 'FocusFlow',
    icon: iconPath,
    backgroundColor: chrome().bg,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: chrome().bg, symbolColor: chrome().symbol, height: 40 },
    alwaysOnTop: controller.data.settings.alwaysOnTop,
    webPreferences: webPreferences()
  })
  mainWindow = win
  lockNavigation(win)

  win.once('ready-to-show', () => {
    if (!show) return
    if (usable?.maximized) win.maximize()
    win.show()
  })

  // The close button sends the app to the tray; only an explicit Quit ends it.
  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    win.hide()
    onHideToTray()
  })

  let saveTimer: NodeJS.Timeout | null = null
  const rememberBounds = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!alive(win) || win.isMinimized()) return
      const b = win.getNormalBounds()
      controller.updateMeta((meta) => {
        meta.window.main = { ...b, maximized: win.isMaximized() }
      })
    }, 400)
  }
  win.on('resize', rememberBounds)
  win.on('move', rememberBounds)
  win.on('closed', () => {
    if (saveTimer) clearTimeout(saveTimer)
    mainWindow = null
  })

  load(win)
  return win
}

function createMiniWindow(controller: Controller): BrowserWindow {
  const saved = controller.meta.window.mini
  const area = screen.getPrimaryDisplay().workArea
  const position =
    saved && onScreen(saved.x, saved.y, MINI.width, MINI.height)
      ? saved
      : { x: Math.round(area.x + (area.width - MINI.width) / 2), y: area.y + 28 }

  const win = new BrowserWindow({
    ...MINI,
    ...position,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    title: 'FocusFlow',
    icon: iconPath,
    webPreferences: webPreferences()
  })
  miniWindow = win
  lockNavigation(win)
  // Stay above full-screen and other always-on-top windows.
  win.setAlwaysOnTop(true, 'screen-saver')

  win.once('ready-to-show', () => win.show())
  win.on('moved', () => {
    const [x, y] = win.getPosition()
    controller.updateMeta((meta) => {
      meta.window.mini = { x, y }
    })
  })
  // Closing the floating bar (Alt+F4) brings the dashboard back rather than stranding the app.
  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    showMain()
  })
  win.on('closed', () => {
    miniWindow = null
  })

  load(win, 'mini')
  return win
}

export function isZen(): boolean {
  return zen
}

export function setZenListener(listener: () => void): void {
  onZenChange = listener
}

function setZen(value: boolean): void {
  if (zen === value) return
  zen = value
  onZenChange()
}

export function showMain(): void {
  if (alive(miniWindow)) miniWindow.hide()
  setZen(false)
  if (!alive(mainWindow)) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

export function toggleZen(controller: Controller): void {
  if (zen) {
    showMain()
    return
  }
  if (alive(miniWindow)) miniWindow.show()
  else createMiniWindow(controller)
  if (alive(mainWindow)) mainWindow.hide()
  setZen(true)
}

/** Send any message to every open window. */
export function broadcastTo(channel: string, payload: unknown): void {
  for (const win of [mainWindow, miniWindow]) {
    if (alive(win)) win.webContents.send(channel, payload)
  }
}

export function broadcast(data: AppData): void {
  for (const win of [mainWindow, miniWindow]) {
    if (alive(win)) win.webContents.send(IPC.state, data)
  }
}

/** Push theme and always-on-top settings onto the native window. */
export function applyWindowSettings(data: AppData): void {
  currentSettings = data.settings
  nativeTheme.themeSource = data.settings.theme
  if (!alive(mainWindow)) return
  mainWindow.setAlwaysOnTop(data.settings.alwaysOnTop)
  const { bg, symbol } = chrome()
  mainWindow.setBackgroundColor(bg)
  try {
    mainWindow.setTitleBarOverlay({ color: bg, symbolColor: symbol, height: 40 })
  } catch {
    // Title bar overlay is unavailable on some window configurations.
  }
}
