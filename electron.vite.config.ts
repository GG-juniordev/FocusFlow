import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

const shared = resolve('src/shared')

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:"

/** Lock the built app down to its own files. Left out in dev, where hot reload needs inline scripts. */
const contentSecurityPolicy = (): Plugin => ({
  name: 'focusflow-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<!--csp-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
})

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': shared } }
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
})
