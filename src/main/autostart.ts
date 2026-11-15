import { app } from 'electron'

export const AUTOSTART_FLAG = '--autostart'

/**
 * Register or remove the Windows login item (HKCU ...\Run).
 * Skipped in development: it would register the bare electron.exe.
 */
export function applyAutostart(enabled: boolean): void {
  if (!app.isPackaged) return
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: [AUTOSTART_FLAG]
  })
}

export function launchedAtLogin(): boolean {
  return process.argv.includes(AUTOSTART_FLAG)
}
