import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

const shared = resolve('src/shared')

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:"

// In development Vite injects inline scripts and talks to its server over a
// websocket for hot reload, so those two things are allowed there and only there.
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws:"

/** Lock the app down to its own files: strictly in the built app, with hot-reload allowances in dev. */
const contentSecurityPolicy = (): Plugin => {
  let dev = false
  return {
    name: 'focusflow-csp',
    configResolved: (config) => {
      dev = config.command === 'serve'
    },
    transformIndexHtml: (html) =>
      html.replace('<!--csp-->', `<meta http-equiv="Content-Security-Policy" content="${dev ? DEV_CSP : CSP}" />`)
  }
}

export default defineConfig(({ mode }) => {
  // Optional Supabase settings from .env. Both the VITE_ names and the plain
  // names from the Supabase dashboard are accepted. Missing = local-only app.
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
  const supabaseKey =
    env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || ''

  return {
  main: {
    resolve: { alias: { '@shared': shared } },
    define: {
      __SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __SUPABASE_KEY__: JSON.stringify(supabaseKey)
    }
  },
  preload: {
    resolve: { alias: { '@shared': shared } }
  },
  renderer: {
    resolve: {
      alias: { '@shared': shared, '@': resolve('src/renderer/src') }
    },
    plugins: [react(), tailwindcss(), contentSecurityPolicy()]
  }
}
})
