// End-to-end smoke test: launches the built app against a throwaway data folder,
// drives every view, saves screenshots to .smoke/shots and fails on any error.
// Run with: npm run smoke
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(root, '.smoke/data')
const shots = resolve(root, '.smoke/shots')
const electronPath = createRequire(import.meta.url)('electron')

const problems = []
const check = (condition, message) => {
  console.log(`${condition ? '  ok  ' : ' FAIL '} ${message}`)
  if (!condition) problems.push(message)
}

async function launch() {
  const app = await electron.launch({
    executablePath: electronPath,
    args: [root],
    env: { ...process.env, FOCUSFLOW_DATA_DIR: dataDir, FOCUSFLOW_SUPABASE_URL: 'off' }
  })
  const page = await app.firstWindow()
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console error: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
  await page.waitForSelector('nav')
  return { app, page }
}

const shot = (page, name) => page.screenshot({ path: resolve(shots, `${name}.png`) })
// Views cross-fade, so give the outgoing one time to leave before querying the new one.
const nav = async (page, name) => {
  await page.locator('nav').getByRole('button', { name, exact: true }).click()
  await page.waitForTimeout(400)
}
const center = async (locator) => {
  const b = await locator.boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 3 })
  await page.mouse.move(to.x, to.y, { steps: 14 })
  await page.waitForTimeout(120)
  await page.mouse.up()
  await page.waitForTimeout(250)
}
const stored = async () => JSON.parse(await readFile(resolve(dataDir, 'data.json'), 'utf8'))

await rm(resolve(root, '.smoke'), { recursive: true, force: true })
await mkdir(shots, { recursive: true })

/* ---------- first run ---------- */
let { app, page } = await launch()

console.log('Focus (empty)')
check(await page.getByText('Nothing in focus').isVisible(), 'empty state invites adding a task')
await shot(page, '01-focus-empty')

console.log('Tasks')
await nav(page, 'Tasks')
const quick = page.getByPlaceholder('Add a task and press Enter')
for (const title of ['Draft the quarterly report', 'Review pull requests', 'Plan next sprint']) {
  await quick.fill(title)
  await quick.press('Enter')
}
check((await page.locator('main li').count()) === 3, 'quick add creates three tasks')

await page.getByRole('button', { name: 'New task', exact: true }).click()
const dialog = page.getByRole('dialog')
await dialog.getByRole('textbox').first().fill('Study Italian verbs')
await dialog.getByPlaceholder('Details, links, the first step…').fill('Chapter 4, irregular verbs')
await dialog.getByRole('button', { name: '1h', exact: true }).click()
await dialog.getByRole('radio', { name: 'High' }).click()
await dialog.getByRole('button', { name: 'Study', exact: true }).click()
await dialog.locator('input[type=date]').fill('2026-11-20')
// Tools: one preset chip, one pasted link, one custom name.
await dialog.getByRole('button', { name: 'Google', exact: true }).click()
const toolInput = dialog.getByPlaceholder('Add a tool or paste a link, then press Enter')
await toolInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
await toolInput.press('Enter')
await toolInput.fill('Anki')
await toolInput.press('Enter')
check((await dialog.count()) === 1, 'Enter in the tools field does not submit the task')
await dialog.getByRole('button', { name: 'Save Anki to my tools' }).click()
await page.waitForTimeout(250)
await shot(page, '02-task-editor')
await dialog.getByRole('button', { name: 'Save', exact: true }).click()
check((await page.locator('main li').count()) === 4, 'task editor saves a fourth task')
check(await page.locator('main li').last().getByText('1h', { exact: true }).isVisible(), 'estimate badge shows 1h')

// Drag the last task to the top.
const rows = page.locator('main ul').first().locator('li')
await rows.last().hover()
await drag(
  page,
  await center(rows.last().getByRole('button', { name: 'Drag to reorder' })),
  await center(rows.first().getByRole('button', { name: 'Drag to reorder' }))
)
check((await rows.first().innerText()).includes('Study Italian verbs'), 'drag-and-drop moves a task to the top')
await shot(page, '03-tasks')

console.log('Focus (active)')
await rows.first().getByRole('button', { name: 'Focus now' }).click()
await page.waitForTimeout(300)
check(await page.getByRole('heading', { name: 'Study Italian verbs' }).isVisible(), 'Focus now loads the task into the hero')
check(await page.getByText('What you need').isVisible(), 'focus panel lists the tools')
check(
  (await page.locator('main').getByRole('button', { name: /^Open YouTube/ }).count()) === 1,
  'a pasted YouTube link becomes a clickable tool'
)
const clock = page.locator('main [role=timer]').first()
check((await clock.getAttribute('aria-label')) === '1:00:00', 'timer is seeded from the 1h estimate')
await page.getByRole('button', { name: 'Start', exact: true }).click()
await page.waitForTimeout(2300)
const ticking = await clock.getAttribute('aria-label')
check(ticking === '59:58' || ticking === '59:57', `timer counts down while running (${ticking})`)
await shot(page, '04-focus-running')
await page.getByRole('button', { name: 'Pause', exact: true }).click()
const frozen = await clock.getAttribute('aria-label')
await page.waitForTimeout(1300)
check((await clock.getAttribute('aria-label')) === frozen, 'pause freezes the timer')

console.log('Calendar')
await nav(page, 'Calendar')
await page.waitForSelector('.fc-timegrid-slot-lane')
check(await page.locator('header [role=timer]').isVisible(), 'current focus stays visible in the title bar')
const backlogItem = page.locator('[data-task-id]').filter({ hasText: 'Review pull requests' })
const slot = await page.evaluate(() => {
  const body = document.querySelector('.fc-timegrid-body').closest('.fc-scroller').getBoundingClientRect()
  const column = document.querySelectorAll('.fc-timegrid-col[data-date]')[2].getBoundingClientRect()
  return { x: column.x + column.width / 2, y: body.y + body.height / 2 }
})
await drag(page, await center(backlogItem), slot)
check((await page.locator('.ff-ev').count()) === 1, 'dragging a task onto the grid creates a time block')
check((await backlogItem.count()) === 0, 'scheduled task leaves the backlog')
let saved = await page.waitForTimeout(500).then(stored)
const block = saved.data.events[0]
check(block && block.taskId && block.title === 'Review pull requests', 'time block is linked to its task')
check(block && Date.parse(block.end) - Date.parse(block.start) === 25 * 60000, 'block length equals the task estimate')

// Resize: pull the bottom edge down by two slots (1 hour).
const ev = page.locator('.fc-timegrid-event').first()
const box = await ev.boundingBox()
await ev.hover()
await drag(page, { x: box.x + box.width / 2, y: box.y + box.height - 2 }, { x: box.x + box.width / 2, y: box.y + box.height + 52 })
saved = await page.waitForTimeout(500).then(stored)
check(
  Date.parse(saved.data.events[0].end) - Date.parse(saved.data.events[0].start) === 85 * 60000,
  `resizing lengthens the block (${(Date.parse(saved.data.events[0].end) - Date.parse(saved.data.events[0].start)) / 60000} min)`
)

// Move: drag the block one column to the right.
const moved = await page.locator('.fc-timegrid-event').first().boundingBox()
const before = saved.data.events[0].start
await drag(page, { x: moved.x + moved.width / 2, y: moved.y + 10 }, { x: moved.x + moved.width * 1.5, y: moved.y + 10 })
saved = await page.waitForTimeout(500).then(stored)
check(Date.parse(saved.data.events[0].start) - Date.parse(before) === 24 * 3600000, 'dragging a block moves it to the next day')
await shot(page, '05-calendar-week')

// New block via the editor, then convert it into a task.
await page.getByRole('button', { name: 'New time block' }).click()
await page.getByRole('dialog').getByPlaceholder('What is this time for?').fill('Dentist appointment')
await shot(page, '06-event-editor')
await page.getByRole('dialog').getByRole('button', { name: 'Convert to task' }).click()
saved = await page.waitForTimeout(500).then(stored)
check(
  saved.data.tasks.some((t) => t.title === 'Dentist appointment') &&
    saved.data.events.some((e) => e.title === 'Dentist appointment' && e.taskId),
  'converting a block creates a linked task'
)

await page.getByRole('radio', { name: 'Month' }).click()
await page.waitForSelector('.fc-daygrid-day')
await shot(page, '07-calendar-month')
await page.getByRole('radio', { name: 'Day' }).click()
await page.waitForSelector('.fc-timeGridDay-view')
await shot(page, '08-calendar-day')

console.log('Settings')
await nav(page, 'Settings')
await shot(page, '09-settings-dark')
await page.getByRole('radio', { name: 'Light', exact: true }).click()
check((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'light theme applies')
await page.getByRole('radio', { name: '#4C8DF6' }).click()
check(
  (await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))) === '#4C8DF6',
  'accent colour applies'
)
// Background presets: the palette and the readability report follow the choice.
await page.getByRole('radio', { name: 'Midnight Blue' }).click()
await page.waitForTimeout(200)
const rootVars = () =>
  page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    bg: document.documentElement.style.getPropertyValue('--bg')
  }))
let vars = await rootVars()
check(vars.bg === '#0d1430' && vars.theme === 'dark', 'Midnight Blue sets a dark palette (' + JSON.stringify(vars) + ')')
check(await page.getByText(/Text contrast .*easy to read/).isVisible(), 'contrast report is shown')
await page.getByText('Background', { exact: true }).first().scrollIntoViewIfNeeded()
await shot(page, '09b-settings-midnight')
await page.getByRole('radio', { name: 'Warm Paper' }).click()
await page.waitForTimeout(200)
vars = await rootVars()
check(vars.theme === 'light', 'Warm Paper switches text to the light-theme colours')
await shot(page, '09c-settings-paper')
await nav(page, 'Tasks')
await shot(page, '09d-tasks-paper')
await nav(page, 'Settings')
const savedNow = await stored()
check(savedNow.data.settings.bgColor === '#f3ede1', 'background colour is saved')
check(savedNow.data.tools.some((x) => x.label === 'Anki'), 'a custom tool can be saved to the library')
await page.getByRole('radio', { name: 'Theme default' }).click()
await page.waitForTimeout(200)
check((await rootVars()).bg === '', 'Theme default restores the built-in colours')

console.log('Tool library')
const toolRow = (name) =>
  page.locator('li').filter({ has: page.getByRole('button', { name: `Delete ${name}`, exact: true }) })
await page.getByRole('button', { name: 'Delete Figma', exact: true }).scrollIntoViewIfNeeded()
// The Delete and link controls must be really on screen, not pushed out of the row and clipped.
const hitTest = await page.evaluate(() =>
  [...document.querySelectorAll('button[aria-label^="Delete "], input[aria-label="Link (optional)"]')]
    .filter((el) => el.closest('li'))
    .map((el) => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return r.width > 0 && r.y > 0 && r.y < innerHeight ? !!hit && (hit === el || el.contains(hit)) : true
    })
)
check(hitTest.length > 0 && hitTest.every(Boolean), `every tool row shows a clickable Delete button and link field (${hitTest.filter(Boolean).length}/${hitTest.length})`)
const libBefore = (await stored()).data.tools.map((x) => x.label)
await page.getByRole('button', { name: 'Delete Figma', exact: true }).click()
await page.waitForTimeout(450)
const libAfter = (await stored()).data.tools.map((x) => x.label)
check(!libAfter.includes('Figma') && libAfter.length === libBefore.length - 1, 'deleting a built-in tool removes exactly that tool')
check((await toolRow('Figma').count()) === 0 && (await toolRow('GitHub').count()) === 1, 'the deleted row leaves and its neighbours stay')

// Google is attached to the Study task: deleting it must not break that task.
await page.getByRole('button', { name: 'Delete Google', exact: true }).click()
await page.waitForTimeout(450)
const studyTools = (await stored()).data.tasks.find((x) => x.title === 'Study Italian verbs').tools
check(
  studyTools.some((x) => x.label === 'Google' && x.id === null && x.url === 'https://www.google.com'),
  'a deleted tool stays on its tasks as a plain tool'
)

// Emoji icon on an existing tool.
await page.getByRole('button', { name: 'Change icon for Anki' }).click()
await page.getByRole('radio', { name: 'Emoji' }).click()
await page.getByRole('button', { name: '🧠', exact: true }).click()
await page.waitForTimeout(300)
check(
  JSON.stringify((await stored()).data.tools.find((x) => x.label === 'Anki').icon) === JSON.stringify({ type: 'emoji', value: '🧠' }),
  'an emoji can be set as a tool icon'
)
await shot(page, '09e-icon-emoji')
await page.getByRole('button', { name: 'Done', exact: true }).click()
await page.waitForTimeout(350)

// Image icons from files: an SVG and a large PNG both become 64px PNGs.
const svgPath = resolve(root, '.smoke/icon-test.svg')
await writeFile(
  svgPath,
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#e44d26"/><path d="M30 30h40v40H30z" fill="#fff"/></svg>'
)
await page.getByRole('button', { name: 'Change icon for GitHub' }).click()
await page.getByRole('radio', { name: 'Image' }).click()
await page.locator('[data-testid=icon-file]').setInputFiles(svgPath)
await page.waitForTimeout(600)
const ghIcon = (await stored()).data.tools.find((x) => x.label === 'GitHub').icon
check(ghIcon?.type === 'image' && ghIcon.src.startsWith('data:image/png;base64,'), 'an SVG file becomes a PNG icon')
const iconSize = await page.evaluate(
  (src) =>
    new Promise((ok) => {
      const i = new Image()
      i.onload = () => ok(i.naturalWidth + 'x' + i.naturalHeight)
      i.src = src
    }),
  ghIcon.src
)
check(iconSize === '64x64', `stored icon is 64x64 (${iconSize})`)
await shot(page, '09f-icon-image')

const pngPath = resolve(root, '.smoke/icon-test.png')
const bigPng = await page.evaluate(() => {
  const c = document.createElement('canvas')
  c.width = 900
  c.height = 600
  const x = c.getContext('2d')
  x.fillStyle = '#3b82f6'
  x.fillRect(0, 0, 900, 600)
  x.fillStyle = '#fff'
  x.fillRect(300, 150, 300, 300)
  return c.toDataURL('image/png').split(',')[1]
})
await writeFile(pngPath, Buffer.from(bigPng, 'base64'))
await page.locator('[data-testid=icon-file]').setInputFiles(pngPath)
await page.waitForTimeout(600)
const ghIcon2 = (await stored()).data.tools.find((x) => x.label === 'GitHub').icon
check(ghIcon2.src !== ghIcon.src && ghIcon2.src.length < 48000, `a large PNG replaces the icon, compressed (${ghIcon2.src.length} chars)`)

const brokenPath = resolve(root, '.smoke/not-an-image.png')
await writeFile(brokenPath, 'hello')
await page.locator('[data-testid=icon-file]').setInputFiles(brokenPath)
const errorShown = await page
  .getByRole('alert')
  .filter({ hasText: 'could not be used' })
  .waitFor({ timeout: 3000 })
  .then(() => true, () => false)
check(errorShown, 'a broken file shows an error instead of crashing')
check((await stored()).data.tools.find((x) => x.label === 'GitHub').icon.src === ghIcon2.src, 'a broken file leaves the previous icon in place')
await page.getByRole('button', { name: 'Done', exact: true }).click()
await page.waitForTimeout(350)

// A new tool with its icon chosen up front.
await page.getByRole('button', { name: 'Icon for the new tool' }).click()
await page.getByRole('radio', { name: 'Emoji' }).click()
await page.getByPlaceholder('Type or paste an emoji').fill('🎥')
await page.getByPlaceholder('Name or link of a new tool').fill('Khan Academy')
await page.getByRole('button', { name: 'Add', exact: true }).click()
await page.waitForTimeout(400)
const khan = (await stored()).data.tools.find((x) => x.label === 'Khan Academy')
check(khan?.icon?.value === '🎥', 'a new tool can be created with an emoji icon')
check(await page.getByRole('button', { name: 'Restore built-in tools' }).isVisible(), 'deleted built-ins can be restored')
await page.getByRole('button', { name: 'Change icon for Khan Academy' }).scrollIntoViewIfNeeded()
await shot(page, '09g-tool-library')

// The icons show up wherever the tool appears.
await nav(page, 'Tasks')
const studyRow = page.locator('main li').filter({ hasText: 'Study Italian verbs' })
check(await studyRow.getByText('🧠').isVisible(), 'the edited emoji shows on the task card')
check(await studyRow.getByText('Google').isVisible(), 'the deleted tool still shows on the task card')
await studyRow.getByRole('button', { name: 'Edit task' }).click()
const ed = page.getByRole('dialog')
await ed.waitFor()
check(await ed.getByRole('button', { name: 'Khan Academy' }).isVisible(), 'new library tools appear as quick picks in the task editor')
check((await ed.getByRole('button', { name: 'Figma', exact: true }).count()) === 0, 'deleted tools are gone from the quick picks')
check((await ed.locator('img[src^="data:image/png"]').count()) >= 1, 'image icons render in the task editor')
await ed.getByRole('button', { name: 'GitHub', exact: true }).click()
await shot(page, '09h-editor-icons')
await ed.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForTimeout(400)
await nav(page, 'Focus')
const panel = page.locator('main')
check(
  (await panel.getByText('🧠').first().isVisible()) && (await panel.locator('img[src^="data:image/png"]').count()) >= 1,
  'emoji and image icons render in the focus panel'
)
await shot(page, '09i-focus-icons')
await nav(page, 'Settings')
await page.getByRole('radio', { name: 'Italiano' }).click()
check(await page.locator('nav').getByRole('button', { name: 'Attività', exact: true }).isVisible(), 'Italian applies to the UI')
await shot(page, '10-settings-light-it')
await nav(page, 'Attività')
await shot(page, '11-tasks-light-it')
await nav(page, 'Focus')
await shot(page, '12-focus-light-it')

console.log('Zen mode')
const [mini] = await Promise.all([app.waitForEvent('window'), nav(page, 'Zen')])
await mini.waitForSelector('[role=timer]')
await mini.waitForTimeout(400)
check(await mini.getByText('Study Italian verbs').isVisible(), 'floating bar shows the active task')
const windows = () =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => ({
      visible: w.isVisible(),
      onTop: w.isAlwaysOnTop(),
      mini: w.webContents.getURL().endsWith("#mini")
    }))
  )
let state = await windows()
check(state.some((w) => w.mini && w.visible && w.onTop), 'floating bar is visible and always on top')
check(state.some((w) => !w.mini && !w.visible), 'dashboard is hidden in Zen mode')
await shot(mini, '13-zen-bar')
await mini.getByRole('button', { name: 'Avvia' }).click()
await mini.waitForTimeout(1200)
check((await stored()).data.focus.status === 'running', 'floating bar can start the timer')
await mini.getByRole('button', { name: 'Apri FocusFlow' }).click()
await page.waitForTimeout(400)
state = await windows()
check(state.some((w) => !w.mini && w.visible), 'expand restores the dashboard')

console.log('Tray and close behaviour')
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().endsWith("#mini")).close())
await page.waitForTimeout(400)
state = await windows()
check(state.length === 2 && state.every((w) => !w.visible), 'closing the window hides it to the tray instead of quitting')

await app.evaluate(({ app }) => app.quit())
await app.waitForEvent('close').catch(() => {})
saved = await stored()
check(saved.data.focus.status === 'paused', 'quitting pauses a running timer')
check(saved.data.settings.language === 'it' && saved.data.settings.theme === 'light', 'settings are saved')

/* ---------- second run: everything comes back ---------- */
console.log('Restart')
;({ app, page } = await launch())
check(await page.getByRole('heading', { name: 'Study Italian verbs' }).isVisible(), 'focus task is restored after restart')
check(await page.getByRole('button', { name: 'Riprendi' }).isVisible(), 'timer comes back paused, in Italian')
await nav(page, 'Attività')
check((await page.locator('main ul').first().locator('li').count()) === 5, 'all five tasks are restored')
await shot(page, '14-after-restart')
const afterRestart = await stored()
check(afterRestart.data.tasks.find((x) => x.title === 'Study Italian verbs').tools.length === 4, 'task tools survive a restart')
check(
  afterRestart.data.tools.find((x) => x.label === 'Anki')?.icon?.value === '🧠' &&
    afterRestart.data.tools.find((x) => x.label === 'GitHub')?.icon?.type === 'image' &&
    !afterRestart.data.tools.some((x) => x.label === 'Figma' || x.label === 'Google'),
  'icons and deletions survive a restart'
)
check(
  await page.locator('main li').filter({ hasText: 'Study Italian verbs' }).getByText('🧠').isVisible(),
  'the emoji icon still shows on the task after restart'
)

// Ticking a task off plays its animation, then moves it to Done.
const planRow = page.locator('main li').filter({ hasText: 'Plan next sprint' })
await planRow.getByRole('button', { name: 'Segna come completata' }).click()
await page.waitForTimeout(150)
await shot(page, '14b-completing')
await page.waitForTimeout(700)
check(
  (await stored()).data.tasks.find((x) => x.title === 'Plan next sprint').status === 'done',
  'completing from the list marks the task done after its animation'
)
check((await planRow.count()) === 0, 'the completed task leaves the to-do list')

// Let a real one-minute session run out. Skip with SMOKE_FAST=1.
if (!process.env.SMOKE_FAST) {
  console.log('Timer runs to zero (takes a minute)')
  await page.getByRole('button', { name: 'Nuova attività', exact: true }).click()
  const editor = page.getByRole('dialog')
  await editor.getByRole('textbox').first().fill('One minute task')
  await editor.getByRole('button', { name: 'Personalizzato', exact: true }).click()
  await editor.locator('input[type=number]').fill('1')
  await editor.getByRole('button', { name: 'Salva', exact: true }).click()
  await page.locator('main li').filter({ hasText: 'One minute task' }).getByRole('button', { name: 'Focus ora' }).click()
  // Wait for the focus panel to finish its entrance before pressing Start.
  await page.getByRole('heading', { name: 'One minute task' }).waitFor()
  await page.waitForTimeout(300)
  await page.locator('main').getByRole('button', { name: 'Avvia', exact: true }).click()
  await page.waitForTimeout(1500)
  await shot(page, '14c-one-minute-started')
  check((await stored()).data.focus.status === 'running', 'the one-minute session is running')
  await page.getByText('Tempo scaduto').first().waitFor({ timeout: 75_000 })
  saved = await page.waitForTimeout(500).then(stored)
  check(saved.data.focus.status === 'finished', 'a session that runs out ends as finished')
  const spent = saved.data.tasks.find((t) => t.title === 'One minute task').spentMs
  check(spent === 60_000, `the full minute is credited to the task (${spent} ms)`)
  await shot(page, '15-time-up')
  await page.getByRole('button', { name: 'Completa', exact: true }).click()
  const breakOffered = await page.getByRole('button', { name: 'Inizia la pausa' }).waitFor({ timeout: 3000 }).then(() => true, () => false)
  check(breakOffered, 'completing offers a break')
  await shot(page, '16-break-offer')
}

await app.evaluate(({ app }) => app.quit())
await app.waitForEvent('close').catch(() => {})

console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nSmoke test passed.')
process.exit(problems.length ? 1 : 0)
