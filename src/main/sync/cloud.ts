import http from 'node:http'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { app, ipcMain, shell } from 'electron'
import { IPC, type CloudCommand, type CloudResult } from '@shared/types'
import type { Controller } from '../controller'
import { broadcastTo, showMain } from '../windows'
import { SyncEngine } from './engine'
import { SupabaseRemote, createCloudClient, readConfig, toSyncError } from './supabase'

/**
 * OAuth and email links finish in the browser, which then redirects to this
 * address on the PC so the app can pick up the one-time code.
 * It must be listed under Authentication -> URL Configuration -> Redirect URLs.
 */
export const AUTH_PORT = 47813
export const AUTH_REDIRECT = `http://127.0.0.1:${AUTH_PORT}/auth/callback`
const CALLBACK_WINDOW_MS = 10 * 60_000

const page = (title: string, body: string): string =>
  `<!doctype html><meta charset="utf-8"><title>FocusFlow</title>
<body style="font-family:Segoe UI,system-ui,sans-serif;background:#161a24;color:#e9ecf3;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center;max-width:420px;padding:24px"><h1 style="font-size:22px;margin:0 0 8px">${title}</h1>
<p style="color:#98a1b5;margin:0">${body}</p></div></body>`

export interface Cloud {
  engine: SyncEngine
  dispose(): void
}

/** Wire up optional cloud sync. With no Supabase settings this is a no-op shell in local mode. */
export function startCloud(controller: Controller): Cloud {
  // Any problem with the Supabase settings or client means local mode, never a failed start.
  let client: SupabaseClient | null = null
  try {
    const config = readConfig()
    if (config) client = createCloudClient(config, app.getPath('userData'))
  } catch (error) {
    console.error('FocusFlow: cloud sync could not start; continuing in local mode.', error)
    client = null
  }
  const engine = new SyncEngine(controller, { configured: client !== null })

  // Set while the user is in the middle of signing in. Only then does a new
  // session trigger a first sync; a session restored at startup never does.
  let signingInUntil = 0

  const applySession = (session: Session | null, event?: string): void => {
    if (!client || !session?.user) {
      engine.setUser(null, null)
      return
    }
    const interactive = event === 'SIGNED_IN' && Date.now() < signingInUntil
    if (interactive) signingInUntil = 0
    engine.setUser(
      { id: session.user.id, email: session.user.email ?? null },
      new SupabaseRemote(client, session.user.id),
      interactive
    )
  }

  // Fires with the stored session at startup, and on every sign-in, refresh and sign-out.
  // Deferred: the auth library must not be called back into from inside its own callback.
  let subscription: ReturnType<SupabaseClient['auth']['onAuthStateChange']> | undefined
  try {
    subscription = client?.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        try {
          applySession(session, event)
        } catch (error) {
          console.error('FocusFlow: could not apply the sign-in session.', error)
        }
      }, 0)
    })
  } catch (error) {
    console.error('FocusFlow: could not watch the sign-in session.', error)
  }

  /* ---------- browser round-trip for OAuth, magic links and email confirmation ---------- */

  let server: http.Server | null = null
  let serverTimer: NodeJS.Timeout | null = null

  const stopServer = (): void => {
    if (serverTimer) clearTimeout(serverTimer)
    serverTimer = null
    server?.close()
    server = null
  }

  const listenForCallback = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if (serverTimer) clearTimeout(serverTimer)
      serverTimer = setTimeout(stopServer, CALLBACK_WINDOW_MS)
      if (server) return resolve()
      const s = http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', AUTH_REDIRECT)
        if (url.pathname !== '/auth/callback') {
          res.writeHead(404).end()
          return
        }
        const code = url.searchParams.get('code')
        const failure = url.searchParams.get('error_description') ?? url.searchParams.get('error')
        const finish = (ok: boolean, detail: string): void => {
          res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' })
          res.end(page(ok ? 'You are signed in' : 'Sign-in did not complete', detail))
          if (ok) {
            stopServer()
            showMain()
          }
        }
        if (!client || !code) {
          finish(false, failure ?? 'No sign-in code was received. Please try again from FocusFlow.')
          return
        }
        client.auth
          .exchangeCodeForSession(code)
          .then(({ error }) =>
            error
              ? finish(false, error.message)
              : finish(true, 'You can close this tab and return to FocusFlow.')
          )
          .catch((e: unknown) => finish(false, e instanceof Error ? e.message : String(e)))
      })
      s.once('error', (e) => reject(e))
      s.listen(AUTH_PORT, '127.0.0.1', () => {
        server = s
        resolve()
      })
    })

  /* ---------- commands from the UI ---------- */

  const fail = (error: unknown): CloudResult => {
    const e = toSyncError(error)
    return { ok: false, error: e.kind === 'network' ? 'network' : e.message }
  }

  const run = async (command: CloudCommand): Promise<CloudResult> => {
    if (!client) return { ok: false, error: 'not-configured' }
    if (command.type === 'sign-in' || command.type === 'sign-up') signingInUntil = Date.now() + 60_000
    if (command.type === 'magic-link' || command.type === 'oauth') signingInUntil = Date.now() + CALLBACK_WINDOW_MS
    switch (command.type) {
      case 'sign-in': {
        const { error } = await client.auth.signInWithPassword({ email: command.email, password: command.password })
        return error ? fail(error) : { ok: true }
      }
      case 'sign-up': {
        // If the project requires email confirmation, the link in the email comes back to the app.
        await listenForCallback().catch(() => {})
        const { data, error } = await client.auth.signUp({
          email: command.email,
          password: command.password,
          options: { emailRedirectTo: AUTH_REDIRECT }
        })
        if (error) return fail(error)
        return data.session ? { ok: true } : { ok: true, info: 'confirm-email' }
      }
      case 'magic-link': {
        await listenForCallback()
        const { error } = await client.auth.signInWithOtp({
          email: command.email,
          options: { emailRedirectTo: AUTH_REDIRECT }
        })
        return error ? fail(error) : { ok: true, info: 'link-sent' }
      }
      case 'oauth': {
        await listenForCallback()
        const { data, error } = await client.auth.signInWithOAuth({
          provider: command.provider,
          options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true }
        })
        if (error || !data.url) return fail(error ?? new Error('No sign-in address was returned.'))
        await shell.openExternal(data.url)
        return { ok: true, info: 'browser-opened' }
      }
      case 'choose':
        await engine.choose(command.mode)
        return { ok: true }
      case 'sign-out': {
        await engine.detach(command.keepLocal)
        // 'local' ends the session on this PC only, and works offline.
        await client.auth.signOut({ scope: 'local' }).catch(() => {})
        return { ok: true }
      }
      case 'sync-now': {
        await engine.syncNow()
        // Report how it went, so the UI can confirm or explain.
        const { phase, error } = engine.state
        if (phase === 'offline') return { ok: false, error: 'network' }
        if (phase === 'error') return { ok: false, error: error ?? 'error' }
        return { ok: true }
      }
    }
  }

  ipcMain.handle(IPC.getCloud, () => engine.state)
  ipcMain.handle(IPC.cloudCommand, async (_event, command: CloudCommand): Promise<CloudResult> => {
    if (!command || typeof command.type !== 'string') return { ok: false, error: 'bad-command' }
    try {
      return await run(command)
    } catch (error) {
      return fail(error)
    }
  })

  const stopBroadcast = engine.onState((state) => broadcastTo(IPC.cloud, state))

  return {
    engine,
    dispose: () => {
      stopBroadcast()
      subscription?.data.subscription.unsubscribe()
      stopServer()
      engine.dispose()
    }
  }
}
