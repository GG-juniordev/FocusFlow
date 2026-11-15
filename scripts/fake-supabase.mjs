// A small local stand-in for Supabase (Auth + the REST API over the tables in
// supabase/schema.sql), used only by scripts/smoke-cloud.mjs. It lets the real
// app and the real supabase-js client be tested end to end without touching a
// real project. It mimics: email/password auth, per-user row access, upserts on
// (user_id, id), the "older write is ignored" rule, and server-set synced_at.
import { randomUUID } from 'node:crypto'
import http from 'node:http'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

export async function startFakeSupabase() {
  const users = new Map() // email -> { id, email, password }
  const tokens = new Map() // access or refresh token -> user
  const tables = { tasks: [], calendar_events: [], categories: [], custom_tools: [], user_settings: [] }
  const state = { offline: false, schema: true, requests: 0 }
  let micro = 0

  // Postgres-style timestamp with microseconds, strictly increasing.
  const syncedAt = () => {
    micro += 1
    const base = new Date(Date.UTC(2030, 0, 1) + Math.floor(micro / 1000)).toISOString().slice(0, 23)
    return `${base.replace('Z', '')}${String(micro % 1000).padStart(3, '0')}+00:00`
  }

  const session = (user) => {
    const now = Math.floor(Date.now() / 1000)
    const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      aud: 'authenticated',
      iat: now,
      exp: now + 3600
    })}.${randomUUID().replaceAll('-', '')}`
    const refresh = randomUUID()
    tokens.set(access, user)
    tokens.set(refresh, user)
    return {
      access_token: access,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: refresh,
      user: {
        id: user.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: user.email,
        email_confirmed_at: new Date().toISOString(),
        app_metadata: { provider: 'email' },
        user_metadata: {},
        created_at: new Date().toISOString()
      }
    }
  }

  const send = (res, status, body) => {
    const text = body === undefined ? '' : JSON.stringify(body)
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(text)
  }

  const readBody = (req) =>
    new Promise((resolve) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        try {
          resolve(raw ? JSON.parse(raw) : {})
        } catch {
          resolve({})
        }
      })
    })

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    if (url.pathname === '/__control') {
      for (const [k, v] of url.searchParams) state[k] = v === '1'
      return send(res, 200, state)
    }
    state.requests += 1
    if (state.offline) return req.socket.destroy() // looks like a dropped connection

    const body = req.method === 'GET' ? {} : await readBody(req)
    const bearer = (req.headers.authorization ?? '').replace(/^Bearer /, '')

    /* ---------- auth ---------- */
    if (url.pathname === '/auth/v1/signup') {
      if (users.has(body.email)) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' })
      const user = { id: randomUUID(), email: body.email, password: body.password }
      users.set(user.email, user)
      return send(res, 200, session(user))
    }
    if (url.pathname === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type')
      if (grant === 'password') {
        const user = users.get(body.email)
        if (!user || user.password !== body.password) {
          return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
        }
        return send(res, 200, session(user))
      }
      if (grant === 'refresh_token') {
        const user = tokens.get(body.refresh_token)
        return user ? send(res, 200, session(user)) : send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' })
      }
      return send(res, 400, { msg: 'unsupported grant' })
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204)
    if (url.pathname === '/auth/v1/user') {
      const user = tokens.get(bearer)
      return user ? send(res, 200, session(user).user) : send(res, 401, { msg: 'invalid JWT' })
    }

    /* ---------- rest ---------- */
    const match = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)
    if (!match) return send(res, 404, { message: 'not found' })
    const name = match[1]
    if (!state.schema || !tables[name]) {
      return send(res, 404, { code: 'PGRST205', message: `Could not find the table 'public.${name}' in the schema cache` })
    }
    const user = tokens.get(bearer)
    if (!user) return send(res, 401, { code: 'PGRST301', message: 'JWT expired' })
    const rows = tables[name]

    // Row level security: a user only ever sees or touches their own rows.
    const filters = [...url.searchParams].filter(([k]) => !['select', 'order', 'offset', 'limit', 'on_conflict', 'columns'].includes(k))
    const visible = (row) =>
      row.user_id === user.id &&
      filters.every(([column, expr]) => {
        const [op, ...rest] = expr.split('.')
        const value = rest.join('.')
        if (op === 'eq') return String(row[column]) === value
        if (op === 'gt') return String(row[column]) > value
        return false
      })

    if (req.method === 'GET') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? 1000)
      const found = rows.filter(visible).sort((a, b) => a.synced_at.localeCompare(b.synced_at))
      return send(res, 200, found.slice(offset, offset + limit))
    }

    if (req.method === 'POST') {
      const keyOf = (r) => (name === 'user_settings' ? r.user_id : `${r.user_id}/${r.id}`)
      for (const incoming of Array.isArray(body) ? body : [body]) {
        if (incoming.user_id !== user.id) return send(res, 403, { code: '42501', message: 'new row violates row-level security policy' })
        const existing = rows.find((r) => keyOf(r) === keyOf(incoming))
        if (existing) {
          if (Date.parse(incoming.updated_at) < Date.parse(existing.updated_at)) continue // stale write ignored
          Object.assign(existing, incoming, { synced_at: syncedAt() })
        } else {
          rows.push({ ...incoming, synced_at: syncedAt() })
        }
      }
      return send(res, 201)
    }

    if (req.method === 'PATCH') {
      for (const row of rows.filter(visible)) {
        if (Date.parse(body.updated_at) < Date.parse(row.updated_at)) continue
        Object.assign(row, body, { synced_at: syncedAt() })
      }
      return send(res, 204)
    }

    return send(res, 405, { message: 'method not allowed' })
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  return {
    url,
    tables,
    state,
    set: (patch) => Object.assign(state, patch),
    live: (name) => tables[name].filter((r) => !r.deleted_at),
    close: () => new Promise((resolve) => server.close(resolve))
  }
}
