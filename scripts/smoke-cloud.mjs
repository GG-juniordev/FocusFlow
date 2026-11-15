// End-to-end test of optional cloud sync: two copies of the built app ("PC A"
// and "PC B") sign in to the same account on a local stand-in for Supabase.
// Nothing here contacts a real Supabase project. Run with: npm run smoke:cloud
import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'
import { startFakeSupabase } from './fake-supabase.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const base = resolve(root, '.smoke/cloud')
const shots = resolve(base, 'shots')
const electronPath = createRequire(import.meta.url)('electron')

const problems = []
const check = (condition, message) => {
  console.log(`${condition ? '  ok  ' : ' FAIL '} ${message}`)
  if (!condition) problems.push(message)
}

async function launch(name, env) {
  const dataDir = resolve(base, name)
  const app = await electron.launch({
    executablePath: electronPath,
    args: [root],
    env: { ...process.env, FOCUSFLOW_DATA_DIR: dataDir, ...env }
  })
  const page = await app.firstWindow()
  page.on('console', (m) => {
    // A dropped connection logs a network error in the page; that is the scenario under test.
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) problems.push(`[${name}] console error: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`[${name}] page error: ${e.message}`))
  await page.waitForSelector('nav')

  const pc = {
    name,
    app,
    page,
    dataDir,
    stored: async () => JSON.parse(await readFile(resolve(dataDir, 'data.json'), 'utf8')),
    nav: async (label) => {
      await page.locator('nav').getByRole('button', { name: label, exact: true }).click()
      await page.waitForTimeout(400)
    },
    pill: () => page.getByTestId('cloud-pill'),
    phase: () => page.getByTestId('cloud-pill').getAttribute('data-phase'),
    waitPhase: (phase, timeout = 15000) =>
      page.locator(`[data-testid=cloud-pill][data-phase=${phase}]`).waitFor({ timeout }).then(() => true, () => false),
    addTask: async (title) => {
      await pc.nav('Tasks')
      const quick = page.getByPlaceholder('Add a task and press Enter')
      await quick.fill(title)
      await quick.press('Enter')
    },
    titles: async () => (await pc.stored()).data.tasks.map((t) => t.title).sort(),
    openAccount: async () => {
      await pc.pill().click()
      await page.waitForTimeout(700)
    },
    signIn: async (email, password, create = false) => {
      await pc.openAccount()
      if (create) await page.getByRole('button', { name: 'New here? Create an account' }).click()
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: create ? 'Create account' : 'Sign in', exact: true }).click()
    },
    syncNow: async () => {
      await pc.openAccount()
      await page.getByRole('button', { name: 'Sync now' }).click()
      await page.waitForTimeout(900)
    },
    quit: async () => {
      await app.evaluate(({ app }) => app.quit())
      await app.waitForEvent('close').catch(() => {})
    },
    shot: (file) => page.screenshot({ path: resolve(shots, `${file}.png`) })
  }
  return pc
}

await rm(base, { recursive: true, force: true })
await mkdir(shots, { recursive: true })
const server = await startFakeSupabase()
const cloudEnv = { FOCUSFLOW_SUPABASE_URL: server.url, FOCUSFLOW_SUPABASE_KEY: 'test-anon-key' }
const EMAIL = 'ada@example.com'
const PASSWORD = 'correct horse'

/* ---------- no Supabase settings: pure local app ---------- */
console.log('Without Supabase settings')
let solo = await launch('solo', { FOCUSFLOW_SUPABASE_URL: 'off' })
check((await solo.phase()) === 'local' && (await solo.pill().innerText()).includes('Local mode'), 'the app opens straight into the dashboard in Local mode')
await solo.addTask('Works with no account')
await solo.page.waitForTimeout(600) // saves are batched for a moment
check((await solo.titles()).includes('Works with no account'), 'tasks save locally with no login')
await solo.openAccount()
check(await solo.page.getByText('Cloud sync is not set up in this copy of FocusFlow').isVisible(), 'Settings explains that cloud sync is not set up')
check((await solo.page.getByLabel('Password').count()) === 0, 'no sign-in form is offered without settings')
await solo.shot('01-not-configured')
await solo.quit()
check(server.state.requests === 0, 'no network requests were made')

/* ---------- guest first, then create an account ---------- */
console.log('Guest mode, then sign-up')
let a = await launch('pc-a', cloudEnv)
check((await a.phase()) === 'local', 'configured but signed out: still Local mode, no login wall')
await a.addTask('Draft the report')
await a.addTask('Call the dentist')
await a.page.waitForTimeout(500)
check(server.state.requests === 0, 'guest work sends nothing to the server')

await a.signIn(EMAIL, 'wrong-password')
const rejected = await a.page.getByRole('alert').filter({ hasText: 'Invalid login credentials' }).waitFor({ timeout: 5000 }).then(() => true, () => false)
check(rejected && (await a.phase()) === 'local', 'a wrong password shows the error and stays in Local mode')
await a.shot('02-sign-in-form')

await a.page.getByRole('button', { name: 'New here? Create an account' }).click()
await a.page.getByLabel('Password').fill(PASSWORD)
await a.page.getByRole('button', { name: 'Create account', exact: true }).click()
const dialog = a.page.getByRole('dialog')
await dialog.waitFor({ timeout: 8000 })
check(await dialog.getByText('We found 2 tasks and 0 calendar blocks on this PC').isVisible(), 'the transfer prompt appears with the local counts')
check(server.tables.tasks.length === 0, 'nothing is uploaded before the choice is made')
await a.page.waitForTimeout(300)
await a.shot('03-transfer-prompt')
await a.page.getByTestId('migrate-merge').click()
check(await a.waitPhase('synced'), 'after "Transfer & merge" the pill shows Synced')
check(server.live('tasks').length === 2 && server.live('categories').length === 3, 'local tasks and categories are uploaded')
check(server.live('custom_tools').length === 8 && server.tables.user_settings.length === 1, 'tools and settings are uploaded')
check(new Set(server.tables.tasks.map((r) => r.user_id)).size === 1, 'rows are stored under the signed-in user id')
await a.openAccount()
check(await a.page.getByText(`Signed in as ${EMAIL}`).isVisible(), 'Settings shows the signed-in account')
await a.shot('04-signed-in')

/* ---------- second PC ---------- */
console.log('Second PC')
let b = await launch('pc-b', cloudEnv)
await b.signIn(EMAIL, PASSWORD)
check(await b.waitPhase('synced'), 'an empty PC signs in with no prompt')
check((await b.page.getByRole('dialog').count()) === 0, 'no transfer prompt when there is nothing local')
await b.page.waitForTimeout(400)
check(JSON.stringify(await b.titles()) === JSON.stringify(['Call the dentist', 'Draft the report']), 'the account data arrives on the second PC')

await b.addTask('Added on PC B')
await b.page.waitForTimeout(3000) // background upload after a short pause
check(server.live('tasks').length === 3, 'a change uploads by itself in the background')
await a.syncNow()
check((await a.titles()).includes('Added on PC B'), 'PC A receives it')

// An emoji tool icon and a setting made on A reach B; a completion made on B reaches A.
await a.page.getByRole('button', { name: 'Change icon for Terminal' }).click()
await a.page.getByRole('radio', { name: 'Emoji' }).click()
await a.page.getByRole('button', { name: '🚀', exact: true }).click()
await a.page.getByRole('radio', { name: '#23B5A6' }).click()
await a.page.waitForTimeout(3000)
await b.nav('Tasks')
await b.page.locator('main li').filter({ hasText: 'Call the dentist' }).getByRole('button', { name: 'Mark as done' }).click()
await b.page.waitForTimeout(1200)
await b.syncNow()
const bData = (await b.stored()).data
check(bData.tools.find((t) => t.label === 'Terminal')?.icon?.value === '🚀', 'a tool icon syncs to the other PC')
check(bData.settings.accent === '#23B5A6', 'the accent colour syncs to the other PC')
await a.syncNow()
check((await a.stored()).data.tasks.find((t) => t.title === 'Call the dentist').status === 'done', 'a completed task syncs back')
check(server.tables.tasks.length === 3, 'no duplicate rows were created along the way')

/* ---------- offline ---------- */
console.log('Offline')
server.set({ offline: true })
await a.addTask('Written while offline')
await a.nav('Tasks')
await a.page.locator('main li').filter({ hasText: 'Draft the report' }).getByRole('button', { name: 'Delete task' }).click()
check(await a.waitPhase('offline'), 'the pill switches to Offline')
check((await a.titles()).includes('Written while offline'), 'the app keeps working and saving locally')
check((await a.stored()).meta.sync.dirty.tasks.length === 1 && Object.keys((await a.stored()).meta.sync.deleted.tasks).length === 1, 'the changes are queued on disk')
await a.openAccount()
check(await a.page.getByTestId('cloud-status').getByText('Offline.').isVisible(), 'Settings explains the offline state')
await a.shot('05-offline')

// Quit and reopen while still offline: still signed in, queue intact.
await a.quit()
a = await launch('pc-a', cloudEnv)
check(await a.waitPhase('offline'), 'after a restart offline, the session and the queue are still there')
server.set({ offline: false })
await a.syncNow()
check(await a.waitPhase('synced'), 'back online, the queue uploads')
check(server.live('tasks').some((r) => r.title === 'Written while offline'), 'the offline task reached the cloud')
check(!server.live('tasks').some((r) => r.title === 'Draft the report'), 'the offline deletion reached the cloud')
await b.syncNow()
check(JSON.stringify(await b.titles()) === JSON.stringify(['Added on PC B', 'Call the dentist', 'Written while offline']), 'PC B matches after syncing')

/* ---------- database not set up ---------- */
console.log('Missing schema')
server.set({ schema: false })
await a.syncNow()
check(await a.waitPhase('error'), 'missing tables are reported as a sync problem')
check(await a.page.getByTestId('cloud-status').getByText('supabase/schema.sql').isVisible(), 'the message says to run supabase/schema.sql')
await a.shot('06-schema-missing')
server.set({ schema: true })
await a.syncNow()
check(await a.waitPhase('synced'), 'sync recovers once the tables exist')

/* ---------- sign out ---------- */
console.log('Sign out')
await a.openAccount()
await a.page.getByRole('button', { name: 'Sign out' }).click()
await a.page.getByRole('dialog').waitFor()
await a.page.waitForTimeout(300)
await a.shot('07-sign-out')
await a.page.getByTestId('signout-clear').click()
check(await a.waitPhase('local'), '"Clear this PC" returns to Local mode')
await a.page.waitForTimeout(500)
const cleared = (await a.stored()).data
check(cleared.tasks.length === 0 && cleared.categories.length === 3 && cleared.tools.length === 8, 'account data is removed and defaults restored')
check(server.live('tasks').length === 3, 'the cloud copy is untouched')
await a.addTask('Guest again on A')
await a.page.waitForTimeout(2500)
check(!server.tables.tasks.some((r) => r.title === 'Guest again on A'), 'after signing out, new work stays local')

await b.openAccount()
await b.page.getByRole('button', { name: 'Sign out' }).click()
await b.page.getByTestId('signout-keep').click()
check(await b.waitPhase('local'), '"Keep a local copy" returns to Local mode')
check((await b.titles()).length === 3, 'the local copy is kept')

// Signing back in with local data: choose "Keep cloud only".
await b.addTask('Local-only on B')
await b.signIn(EMAIL, PASSWORD)
await b.page.getByRole('dialog').waitFor({ timeout: 8000 })
await b.page.getByTestId('migrate-cloud').click()
check(await b.waitPhase('synced'), '"Keep cloud only" finishes syncing')
await b.page.waitForTimeout(400)
check(JSON.stringify(await b.titles()) === JSON.stringify(['Added on PC B', 'Call the dentist', 'Written while offline']), 'local data is replaced by the cloud copy')
check(!server.tables.tasks.some((r) => r.title === 'Local-only on B'), 'the discarded local task was not uploaded')
const backup = readdirSync(b.dataDir).find((f) => f.startsWith('data.before-cloud-'))
check(!!backup && (await readFile(resolve(b.dataDir, backup), 'utf8')).includes('Local-only on B'), 'a backup of the replaced local data was saved')
check(existsSync(resolve(b.dataDir, 'session.bin')) && !(await readFile(resolve(b.dataDir, 'session.bin'), 'utf8')).includes('refresh_token'), 'the saved session is encrypted on disk')

await a.quit()
await b.quit()
await server.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nCloud smoke test passed.')
process.exit(problems.length ? 1 : 0)
