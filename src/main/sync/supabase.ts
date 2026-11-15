import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { safeStorage } from 'electron'
import type { PushBatch, Remote, RemoteRow, Table } from './core'
import { SyncError } from './engine'
import { TABLE_NAMES, fromRow, toRow, type Row } from './rows'

declare const __SUPABASE_URL__: string
declare const __SUPABASE_KEY__: string

export interface CloudConfig {
  url: string
  key: string
}

/** A key that must never ship inside a desktop app: it bypasses row level security. */
function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString('utf8')) as { role?: string }
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

/**
 * Supabase settings, or null for pure local mode. Values come from .env at build
 * time; FOCUSFLOW_SUPABASE_URL / _KEY override them at run time (used by tests;
 * set the URL to "off" to force local mode).
 */
export function readConfig(): CloudConfig | null {
  const baked = (name: 'url' | 'key'): string => {
    try {
      return name === 'url' ? __SUPABASE_URL__ : __SUPABASE_KEY__
    } catch {
      return ''
    }
  }
  const url = (process.env['FOCUSFLOW_SUPABASE_URL'] ?? baked('url')).trim()
  const key = (process.env['FOCUSFLOW_SUPABASE_KEY'] ?? baked('key')).trim()
  if (!url || !key || url === 'off') return null
  // Anything that is not a real http(s) address, or is still the example text
  // from .env.example, means "not configured": the app stays in local mode.
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (/your-project|your_project|example\.supabase|<|>|\s/i.test(url) || /^your[-_]|<|>|\s|^undefined$|^null$/i.test(key)) return null
  if (isSecretKey(key)) {
    console.error('FocusFlow: the Supabase key in .env is a secret/service key. Use the anon (publishable) key. Cloud sync is disabled.')
    return null
  }
  return { url, key }
}

/** Keeps the sign-in session on disk, encrypted with Windows DPAPI when available. */
class SessionFile {
  private cache: Record<string, string> | null = null

  constructor(private readonly file: string) {}

  private load(): Record<string, string> {
    if (this.cache) return this.cache
    let parsed: Record<string, string> = {}
    try {
      const raw = fs.readFileSync(this.file)
      const text =
        raw.subarray(0, 4).toString() === 'enc:' && safeStorage.isEncryptionAvailable()
          ? safeStorage.decryptString(raw.subarray(4))
          : raw.toString('utf8')
      const value: unknown = JSON.parse(text)
      if (value && typeof value === 'object') parsed = value as Record<string, string>
    } catch {
      // Missing or unreadable: start signed out.
    }
    this.cache = parsed
    return parsed
  }

  private save(): void {
    const text = JSON.stringify(this.cache ?? {})
    try {
      const body = safeStorage.isEncryptionAvailable()
        ? Buffer.concat([Buffer.from('enc:'), safeStorage.encryptString(text)])
        : Buffer.from(text, 'utf8')
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(this.file, body)
    } catch {
      // Not being able to persist the session only means signing in again next launch.
    }
  }

  getItem = (key: string): string | null => this.load()[key] ?? null
  setItem = (key: string, value: string): void => {
    this.load()[key] = value
    this.save()
  }
  removeItem = (key: string): void => {
    delete this.load()[key]
    this.save()
  }
}

export function createCloudClient(config: CloudConfig, dataDir: string): SupabaseClient {
  return createClient(config.url, config.key, {
    auth: {
      storage: new SessionFile(path.join(dataDir, 'session.bin')),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // PKCE lets the browser hand a one-time code back to the app for OAuth and email links.
      flowType: 'pkce'
    }
  })
}

const NETWORK = /fetch failed|failed to fetch|network|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket/i

/** Classify an error from supabase-js so the UI can explain it. */
export function toSyncError(error: unknown): SyncError {
  const e = (error ?? {}) as { message?: string; code?: string; status?: number; name?: string }
  const message = e.message ?? String(error)
  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || NETWORK.test(message)) return new SyncError('network', message)
  // Table or column missing: schema.sql has not been run (or is out of date).
  if (['PGRST205', 'PGRST204', '42P01', '42703'].includes(e.code ?? '')) return new SyncError('schema', message)
  if (e.code === 'PGRST301' || e.status === 401) return new SyncError('auth', message)
  return new SyncError('server', message)
}

const PAGE = 500
const CHUNK = 50

/** The Remote the sync engine talks to, backed by the tables in supabase/schema.sql. */
export class SupabaseRemote implements Remote {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string
  ) {}

  async pull(table: Table, since: string | null): Promise<RemoteRow[]> {
    const out: RemoteRow[] = []
    for (let from = 0; ; from += PAGE) {
      let query = this.client.from(TABLE_NAMES[table]).select('*').eq('user_id', this.userId)
      if (since) query = query.gt('synced_at', since)
      const { data, error } = await query.order('synced_at', { ascending: true }).range(from, from + PAGE - 1)
      if (error) throw toSyncError(error)
      const rows = (data ?? []) as Row[]
      for (const row of rows) {
        const parsed = fromRow(table, row)
        if (parsed) out.push(parsed)
      }
      if (rows.length < PAGE) return out
    }
  }

  async upsert(table: Table, rows: PushBatch['upserts']): Promise<void> {
    const onConflict = table === 'settings' ? 'user_id' : 'user_id,id'
    for (let i = 0; i < rows.length; i += CHUNK) {
      const payload = rows.slice(i, i + CHUNK).map((r) => toRow(table, this.userId, r.id, r.updatedAt, r.record))
      const { error } = await this.client.from(TABLE_NAMES[table]).upsert(payload, { onConflict })
      if (error) throw toSyncError(error)
    }
  }

  /** Deletions are marked, not erased, so other devices learn about them. */
  async remove(table: Table, rows: PushBatch['removes']): Promise<void> {
    if (table === 'settings') return
    for (const { id, deletedAt } of rows) {
      const { error } = await this.client
        .from(TABLE_NAMES[table])
        .update({ deleted_at: deletedAt, updated_at: deletedAt })
        .eq('user_id', this.userId)
        .eq('id', id)
      if (error) throw toSyncError(error)
    }
  }
}
