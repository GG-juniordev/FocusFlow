// End-to-end test of optional cloud sync: two copies of the built app ("PC A"
// and "PC B") sign in to the same account on a local stand-in for Supabase.
// Sync is manual: nothing may reach the server until "Sync now" is pressed.
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
      await page.waitForTimeout(500)
    },
    titles: async () => (await pc.stored()).data.tasks.map((t) => t.title).sort(),
    openAccount: async () => {
      await pc.nav('Settings')
      await page.locator('#cloud-account').scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)
    },
    signIn: async (email, password, create = false) => {
      await pc.openAccount()
      if (create) await page.getByRole('button', { name: 'New here? Create an account' }).click()
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: create ? 'Create account' : 'Sign in', exact: true }).click()
    },
    /** Press "Sync now" in the title bar and report the toast that follows: 'success' or 'error'. */
    sync: async () => {
      // Clear any message left from an earlier sync, so the one read below is this sync's.
      while ((await page.getByTestId('toast').count()) > 0) {
        await page.getByTestId('toast').first().getByRole('button').click().catch(() => {})
        await page.waitForTimeout(350)
      }
      await page.locator('[data-testid=cloud-pill]:not([disabled])').click()
      const toast = page.getByTestId('toast').last()
      await toast.waitFor({ timeout: 15000 })
      await page.locator('[data-testid=cloud-pill]:not([disabled])').waitFor({ timeout: 15000 })
      const result = { kind: await toast.getAttribute('data-kind'), text: await toast.innerText() }
      await page.waitForTimeout(700)
      return result
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
const solo = await launch('solo', { FOCUSFLOW_SUPABASE_URL: 'off' })
check((await solo.phase()) === 'local' && (await solo.pill().innerText()).includes('Local mode'), 'the app opens straight into the dashboard in Local mode')
await solo.addTask('Works with no account')
check((await solo.titles()).includes('Works with no account'), 'tasks save locally with no login')
await solo.openAccount()
check(await solo.page.getByText('Cloud sync is not set up in this copy of FocusFlow').isVisible(), 'Settings explains that cloud sync is not set up')
check((await solo.page.getByLabel('Password').count()) === 0, 'no sign-in form is offered without settings')
await solo.quit()
check(server.state.requests === 0, 'no network requests were made')

/* ---------- guest first, then create an account ---------- */
console.log('Guest mode, then sign-up')
let a = await launch('pc-a', cloudEnv)
check((await a.phase()) === 'local', 'configured but signed out: still Local mode, no login wall')
await a.addTask('Draft the report')
await a.addTask('Call the dentist')
check(server.state.requests === 0, 'guest work sends nothing to the server')

await a.signIn(EMAIL, 'wrong-password')
const rejected = await a.page.getByRole('alert').filter({ hasText: 'Invalid login credentials' }).waitFor({ timeout: 5000 }).then(() => true, () => false)
check(rejected && (await a.phase()) === 'local', 'a wrong password shows the error and stays in Local mode')

await a.page.getByRole('button', { name: 'New here? Create an account' }).click()
await a.page.getByLabel('Password').fill(PASSWORD)
await a.page.getByRole('button', { name: 'Create account', exact: true }).click()
const dialog = a.page.getByRole('dialog')
await dialog.waitFor({ timeout: 8000 })
check(await dialog.getByText('We found 2 tasks and 0 calendar blocks on this PC').isVisible(), 'the transfer prompt appears with the local counts')
check(server.tables.tasks.length === 0, 'nothing is uploaded before the choice is made')
await a.page.waitForTimeout(300)
await a.page.getByTestId('migrate-merge').click()
check(await a.waitPhase('synced'), 'after "Transfer & merge" the first sync runs and the pill shows Sync now, up to date')
check(server.live('tasks').length === 2 && server.live('categories').length === 3, 'local tasks and categories are uploaded')
check(server.live('custom_tools').length === 8 && server.tables.user_settings.length === 1, 'tools and settings are uploaded')
await a.openAccount()
check(await a.page.getByText(`Signed in as ${EMAIL}`).isVisible(), 'Settings shows the signed-in account')
check(await a.page.getByText(/^Last synced /).isVisible(), 'Settings shows when it last synced')

/* ---------- manual sync only ---------- */
console.log('Sync happens only on request')
const b = await launch('pc-b', cloudEnv)
await b.signIn(EMAIL, PASSWORD)
check(await b.waitPhase('synced'), 'an empty PC signs in with no prompt and pulls the account')
await b.page.waitForTimeout(400)
check(JSON.stringify(await b.titles()) === JSON.stringify(['Call the dentist', 'Draft the report']), 'the account data arrives on the second PC')

let requests = server.state.requests
await b.addTask('Added on PC B')
await b.nav('Tasks')
await b.page.locator('main li').filter({ hasText: 'Added on PC B' }).getByRole('button', { name: 'Edit task' }).click()
const ed = b.page.getByRole('dialog')
await ed.getByPlaceholder('Add a step and press Enter').fill('First step')
await ed.getByPlaceholder('Add a step and press Enter').press('Enter')
await ed.getByRole('button', { name: 'Save', exact: true }).click()
await b.page.waitForTimeout(4000)
check(server.state.requests === requests, 'editing sends nothing to the server, even after waiting')
check(server.live('tasks').length === 2, 'the new task is not in the cloud yet')
check((await b.titles()).includes('Added on PC B'), 'but it is saved on this PC at once')
check((await b.phase()) === 'pending' && (await b.page.getByTestId('unsynced-badge').isVisible()), 'the title bar shows an "unsynced" badge on the Sync now button')
await b.openAccount()
check(await b.page.getByTestId('unsynced-note').getByText('Unsynced local changes').isVisible(), 'Settings shows "Unsynced local changes"')
await b.shot('01-unsynced')

let result = await b.sync()
check(result.kind === 'success' && result.text.includes('Synced'), `Sync now confirms with a toast ("${result.text.trim()}")`)
check(server.live('tasks').length === 3, 'the change is uploaded when Sync now is pressed')
check(server.live('tasks').find((r) => r.title === 'Added on PC B')?.subtasks?.[0]?.title === 'First step', 'the task\'s steps are stored in the subtasks column')
check((await b.phase()) === 'synced' && (await b.page.getByTestId('unsynced-badge').count()) === 0, 'the badge clears after syncing')

requests = server.state.requests
await a.page.waitForTimeout(1500)
check(!(await a.titles()).includes('Added on PC B') && server.state.requests === requests, 'PC A does not fetch by itself either')
result = await a.sync()
check(result.kind === 'success' && (await a.titles()).includes('Added on PC B'), 'PC A receives it when it syncs')
check((await a.stored()).data.tasks.find((t) => t.title === 'Added on PC B').subtasks.length === 1, 'steps arrive with the task')

// A tool icon and a setting made on A reach B; a completion and a ticked step made on B reach A.
await a.openAccount()
await a.page.getByRole('button', { name: 'Change icon for Terminal' }).click()
await a.page.getByRole('radio', { name: 'Emoji' }).click()
await a.page.getByRole('button', { name: '🚀', exact: true }).click()
await a.page.getByRole('radio', { name: '#23B5A6' }).click()
await a.page.waitForTimeout(400)
await a.sync()
await b.nav('Tasks')
await b.page.locator('main li').filter({ hasText: 'Call the dentist' }).getByRole('button', { name: 'Mark as done' }).click()
await b.page.locator('main li').filter({ hasText: 'Added on PC B' }).getByRole('button', { name: /^Show steps/ }).click()
await b.page.getByTestId('subtask-list').getByText('First step').click()
await b.page.waitForTimeout(1200)
await b.sync()
const bData = (await b.stored()).data
check(bData.tools.find((t) => t.label === 'Terminal')?.icon?.value === '🚀', 'a tool icon syncs to the other PC')
check(bData.settings.accent === '#23B5A6', 'the accent colour syncs to the other PC')
await a.sync()
const aData = (await a.stored()).data
check(aData.tasks.find((t) => t.title === 'Call the dentist').status === 'done', 'a completed task syncs back')
check(aData.tasks.find((t) => t.title === 'Added on PC B').subtasks[0].isCompleted === true, 'a ticked step syncs back')
check(server.tables.tasks.length === 3, 'no duplicate rows were created along the way')

/* ---------- offline ---------- */
console.log('Server unreachable')
server.set({ offline: true })
await a.addTask('Written while offline')
await a.nav('Tasks')
await a.page.locator('main li').filter({ hasText: 'Draft the report' }).getByRole('button', { name: 'Delete task' }).click()
await a.page.waitForTimeout(600)
check((await a.phase()) === 'pending', 'working offline just marks the changes as unsynced')
result = await a.sync()
check(result.kind === 'error' && result.text.includes('could not be reached'), `a failed sync reports the network error in a toast ("${result.text.trim().slice(0, 70)}…")`)
check((await a.phase()) === 'offline', 'the button shows the failed state')
check((await a.titles()).includes('Written while offline'), 'the app keeps working and saving locally')
check((await a.stored()).meta.sync.dirty.tasks.length === 1 && Object.keys((await a.stored()).meta.sync.deleted.tasks).length === 1, 'the unsynced changes are remembered on disk')
await a.shot('02-sync-failed')

// Quit and reopen while still offline: still signed in, changes still listed, and no sync attempt.
await a.quit()
requests = server.state.requests
a = await launch('pc-a', cloudEnv)
await a.page.waitForTimeout(1500)
check((await a.phase()) === 'pending', 'after a restart the session and the unsynced changes are still there')
check(server.state.requests === requests, 'starting the app does not sync by itself')
server.set({ offline: false })
result = await a.sync()
check(result.kind === 'success' && (await a.phase()) === 'synced', 'back online, Sync now uploads everything')
check(server.live('tasks').some((r) => r.title === 'Written while offline'), 'the offline task reached the cloud')
check(!server.live('tasks').some((r) => r.title === 'Draft the report'), 'the offline deletion reached the cloud')
await b.sync()
check(JSON.stringify(await b.titles()) === JSON.stringify(['Added on PC B', 'Call the dentist', 'Written while offline']), 'PC B matches after syncing')

/* ---------- database not set up ---------- */
console.log('Missing schema')
server.set({ schema: false })
result = await a.sync()
check(result.kind === 'error' && result.text.includes('supabase/schema.sql'), 'missing tables or columns are reported, pointing at supabase/schema.sql')
check((await a.phase()) === 'error', 'the button shows the problem')
server.set({ schema: true })
result = await a.sync()
check(result.kind === 'success', 'sync recovers once the schema is in place')

/* ---------- sign out ---------- */
console.log('Sign out')
await a.openAccount()
await a.page.getByRole('button', { name: 'Sign out' }).click()
await a.page.getByRole('dialog').waitFor()
await a.page.waitForTimeout(300)
await a.page.getByTestId('signout-clear').click()
check(await a.waitPhase('local'), '"Clear this PC" returns to Local mode')
await a.page.waitForTimeout(500)
const cleared = (await a.stored()).data
check(cleared.tasks.length === 0 && cleared.categories.length === 3 && cleared.tools.length === 8, 'account data is removed and defaults restored')
check(server.live('tasks').length === 3, 'the cloud copy is untouched')

await b.addTask('Changed just before signing out')
await b.openAccount()
await b.page.getByRole('button', { name: 'Sign out' }).click()
await b.page.getByTestId('signout-keep').click()
check(await b.waitPhase('local'), '"Keep a local copy" returns to Local mode')
check((await b.titles()).length === 4, 'the local copy is kept')
check(server.live('tasks').some((r) => r.title === 'Changed just before signing out'), 'unsynced changes are uploaded as part of signing out')

// Signing back in with local data: choose "Keep cloud only".
await b.addTask('Local-only on B')
await b.signIn(EMAIL, PASSWORD)
await b.page.getByRole('dialog').waitFor({ timeout: 8000 })
await b.page.getByTestId('migrate-cloud').click()
check(await b.waitPhase('synced'), '"Keep cloud only" finishes syncing')
await b.page.waitForTimeout(400)
check(!(await b.titles()).includes('Local-only on B') && (await b.titles()).length === 4, 'local data is replaced by the cloud copy')
check(!server.tables.tasks.some((r) => r.title === 'Local-only on B'), 'the discarded local task was not uploaded')
const backup = readdirSync(b.dataDir).find((f) => f.startsWith('data.before-cloud-'))
check(!!backup && (await readFile(resolve(b.dataDir, backup), 'utf8')).includes('Local-only on B'), 'a backup of the replaced local data was saved')
check(existsSync(resolve(b.dataDir, 'session.bin')) && !(await readFile(resolve(b.dataDir, 'session.bin'), 'utf8')).includes('refresh_token'), 'the saved session is encrypted on disk')

await a.quit()
await b.quit()
await server.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nCloud smoke test passed.')
process.exit(problems.length ? 1 : 0)
