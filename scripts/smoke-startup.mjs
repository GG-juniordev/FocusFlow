// Startup resilience test: the dashboard must render with any Supabase
// configuration, and the window must never stay blank. Run: npm run smoke:startup
import { mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const base = resolve(root, '.smoke/startup')
const electronPath = createRequire(import.meta.url)('electron')

const problems = []
const check = (condition, message) => {
  console.log(`${condition ? '  ok  ' : ' FAIL '} ${message}`)
  if (!condition) problems.push(message)
}

let n = 0
async function launch(env) {
  const clean = { ...process.env, FOCUSFLOW_DATA_DIR: resolve(base, `run-${++n}`) }
  delete clean.FOCUSFLOW_SUPABASE_URL
  delete clean.FOCUSFLOW_SUPABASE_KEY
  const app = await electron.launch({ executablePath: electronPath, args: [root], env: { ...clean, ...env } })
  const mainErrors = []
  app.process().stderr.on('data', (d) => /Uncaught|TypeError|ReferenceError|Cannot read/.test(String(d)) && mainErrors.push(String(d).slice(0, 200)))
  const page = await app.firstWindow()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  const quit = async () => {
    await app.evaluate(({ app }) => app.quit()).catch(() => {})
    await app.waitForEvent('close').catch(() => {})
  }
  return { app, page, mainErrors, pageErrors, quit }
}

const rendered = (page, timeout = 15000) => page.waitForSelector('nav', { timeout }).then(() => true, () => false)

await rm(base, { recursive: true, force: true })
await mkdir(base, { recursive: true })

/* ---------- every kind of configuration ---------- */
console.log('Dashboard renders with any Supabase configuration')
const configs = [
  ['the .env that is on disk right now', {}, null],
  ['no credentials at all', { FOCUSFLOW_SUPABASE_URL: '', FOCUSFLOW_SUPABASE_KEY: '' }, false],
  ['only a URL, no key', { FOCUSFLOW_SUPABASE_URL: 'https://abc.supabase.co', FOCUSFLOW_SUPABASE_KEY: '' }, false],
  ['the placeholder text from .env.example', { FOCUSFLOW_SUPABASE_URL: 'https://your-project-ref.supabase.co', FOCUSFLOW_SUPABASE_KEY: 'your-anon-or-publishable-key' }, false],
  ['a value that is not a URL', { FOCUSFLOW_SUPABASE_URL: 'not a url', FOCUSFLOW_SUPABASE_KEY: 'abc' }, false],
  ['the literal text "undefined"', { FOCUSFLOW_SUPABASE_URL: 'undefined', FOCUSFLOW_SUPABASE_KEY: 'undefined' }, false],
  ['a secret key by mistake', { FOCUSFLOW_SUPABASE_URL: 'https://abc.supabase.co', FOCUSFLOW_SUPABASE_KEY: 'sb_secret_abc123' }, false],
  ['valid-looking settings for a server that is unreachable', { FOCUSFLOW_SUPABASE_URL: 'http://127.0.0.1:9', FOCUSFLOW_SUPABASE_KEY: 'test-anon-key' }, true]
]
for (const [label, env, expectConfigured] of configs) {
  const t0 = Date.now()
  const pc = await launch(env)
  const ok = await rendered(pc.page)
  const ms = Date.now() - t0
  const cloud = ok ? await pc.page.evaluate(() => window.api.getCloud()) : null
  const pill = ok ? await pc.page.getByTestId('cloud-pill').getAttribute('data-phase') : null
  const fine =
    ok && pill === 'local' && pc.pageErrors.length === 0 && pc.mainErrors.length === 0 && (expectConfigured === null || cloud.configured === expectConfigured)
  check(fine, `${label}: dashboard in ${ms} ms, Local mode, cloud sync ${cloud?.configured ? 'available' : 'off'}${fine ? '' : ` [errors: ${[...pc.pageErrors, ...pc.mainErrors].join(' | ') || 'none'}; pill=${pill}]`}`)
  await pc.quit()
}

/* ---------- recovery ---------- */
console.log('A blank page recovers by itself')
let pc = await launch({ FOCUSFLOW_SUPABASE_URL: 'off' })
await rendered(pc.page)
// Put the window on an empty page, as if the interface had failed to start.
await pc.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.loadURL('data:text/html,<body style="background:%23161a24"></body>'))
await pc.page.waitForTimeout(500)
check((await pc.page.locator('nav').count()) === 0, 'window is blank (simulated failure)')
const t1 = Date.now()
check(await rendered(pc.page, 20000), `the dashboard is back without any user action (${Math.round((Date.now() - t1) / 1000)} s)`)

console.log('A failed load recovers by itself')
await pc.app.evaluate(({ BrowserWindow }) => {
  BrowserWindow.getAllWindows()[0].webContents.loadURL('http://127.0.0.1:9/nothing-here').catch(() => {})
})
await pc.page.waitForTimeout(300)
check(await rendered(pc.page, 20000), 'after a page that cannot be reached, the dashboard is reloaded')

console.log('A render error shows a message, not a blank window')
// Push state the UI cannot draw (tasks missing), which makes React throw while rendering.
await pc.app.evaluate(({ BrowserWindow }) => {
  BrowserWindow.getAllWindows()[0].webContents.send('ff:state', { settings: { language: 'en', theme: 'dark', accent: '#F0A63A' }, focus: {}, tasks: null })
})
const errorScreen = pc.page.getByTestId('app-error')
check(await errorScreen.waitFor({ timeout: 5000 }).then(() => true, () => false), 'the error screen appears')
check(await errorScreen.getByText('FocusFlow hit a problem').isVisible(), 'it says what happened')
check((await errorScreen.locator('pre').innerText()).length > 10, 'it shows the technical error')
await pc.page.screenshot({ path: resolve(base, 'error-screen.png') })
await errorScreen.getByRole('button', { name: 'Reload' }).click()
check(await rendered(pc.page), 'Reload brings the dashboard back')
await pc.quit()

console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nStartup smoke test passed.')
process.exit(problems.length ? 1 : 0)
