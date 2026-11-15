import { join } from 'node:path'
import { BrowserWindow, app, nativeTheme, screen, shell } from 'electron'
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

function load(win: BrowserWindow, hash?: string): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void win.loadURL(hash ? `${devUrl}#${hash}` : devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
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
