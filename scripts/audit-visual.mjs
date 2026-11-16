// Visual audit: seeds awkward data (long titles, many tools and steps, long
// category names, overdue dates) and screenshots every screen at the smallest
// and a normal window size, in several themes. It also measures overflow, so
// clipped or overlapping elements fail the run. Run: npm run audit:visual
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const base = resolve(root, '.smoke/audit')
const shots = resolve(base, 'shots')
const electronPath = createRequire(import.meta.url)('electron')

const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const at = (offset, hour, minute = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
const tool = (id, label, url, preset, icon = null) => ({ id, label, url, preset, icon })
const steps = (titles, done = 0) => titles.map((title, position) => ({ id: `s${position}`, title, isCompleted: position < done, position }))
const LONG = 'Prepare the end-of-term presentation on distributed systems, including the consensus section and the live demo'

const tasks = [
  {
    id: 'a', title: LONG, notes: 'Slides are in the shared drive. Ask Marta about the projector adapter and book room B204 before Thursday afternoon.',
    estimateMin: 120, priority: 'high', categoryId: 'cat-long', dueDate: day(0), order: 0,
    tools: [tool('builtin-vscode', 'VS Code', 'vscode://', 'vscode'), tool('builtin-youtube', 'YouTube', 'https://www.youtube.com', 'youtube'), tool('builtin-docs', 'Google Docs', 'https://docs.google.com', 'docs'), tool('x1', 'A very long custom tool name indeed', null, null, { type: 'emoji', value: '🧠' }), tool('builtin-github', 'GitHub', 'https://github.com', 'github')],
    subtasks: steps(['Collect the benchmark numbers from last week', 'Write the outline', 'Draft slides 1 to 12, including the architecture diagram that still needs redrawing from scratch', 'Rehearse with a timer', 'Send to the group for comments', 'Fix comments', 'Export to PDF'], 2)
  },
  { id: 'b', title: 'Short one', notes: '', estimateMin: 15, priority: 'low', categoryId: 'cat-work', dueDate: day(-3), order: 1, tools: [], subtasks: steps(['Only step'], 1) },
  { id: 'c', title: 'Supercalifragilisticexpialidocious_unbroken_token_without_any_spaces_to_wrap_on_at_all_1234567890', notes: 'https://example.com/a/very/long/url/that/does/not/break/naturally/and/keeps/going/and/going', estimateMin: 600, priority: 'medium', categoryId: null, dueDate: day(1), order: 2, tools: [tool('builtin-google', 'Google', 'https://www.google.com', 'google')], subtasks: [] },
  { id: 'd', title: 'Flexible today, no time set', notes: '', estimateMin: 30, priority: 'medium', categoryId: 'cat-study', dueDate: day(0), order: 3, tools: [], subtasks: steps(['One', 'Two', 'Three']) },
  { id: 'e', title: 'Another flexible task for today with a fairly long name', notes: '', estimateMin: 45, priority: 'high', categoryId: 'cat-personal', dueDate: day(0), order: 4, tools: [], subtasks: [] },
  { id: 'f', title: 'Third flexible', notes: '', estimateMin: 25, priority: 'low', categoryId: null, dueDate: day(0), order: 5, tools: [], subtasks: [] },
  { id: 'g', title: 'Fourth flexible (overflows the row)', notes: '', estimateMin: 25, priority: 'low', categoryId: 'cat-work', dueDate: day(0), order: 6, tools: [], subtasks: [] },
  { id: 'h', title: 'No date at all: stays in the backlog with a long title too', notes: '', estimateMin: 50, priority: 'medium', categoryId: 'cat-long', dueDate: null, order: 7, tools: [], subtasks: [] },
  { id: 'i', title: 'Time-blocked task', notes: '', estimateMin: 60, priority: 'medium', categoryId: 'cat-study', dueDate: day(0), order: 8, tools: [], subtasks: [] },
  { id: 'j', title: 'Finished earlier with a long title that should truncate nicely in the done list', notes: '', estimateMin: 30, priority: 'medium', categoryId: null, dueDate: day(-1), order: 9, status: 'done', completedAt: Date.now() - 3600_000, tools: [], subtasks: steps(['A', 'B'], 2) }
].map((t) => ({ status: 'todo', spentMs: 0, createdAt: Date.now() - 86_400_000, completedAt: null, ...t }))

const hour = Math.min(20, Math.max(8, new Date().getHours()))
const events = [
  { id: 'e1', title: 'Time-blocked task', notes: '', start: at(0, hour, 0), end: at(0, hour + 1, 0), categoryId: 'cat-study', taskId: 'i' },
  { id: 'e2', title: 'Quarter-hour check-in with a long name', notes: '', start: at(0, hour + 1, 0), end: at(0, hour + 1, 15), categoryId: 'cat-work', taskId: null },
  { id: 'e3', title: 'Overlapping block A', notes: '', start: at(0, hour + 1, 30), end: at(0, hour + 3, 0), categoryId: 'cat-personal', taskId: null },
  { id: 'e4', title: 'Overlapping block B with a much longer title', notes: '', start: at(0, hour + 2, 0), end: at(0, hour + 3, 0), categoryId: 'cat-long', taskId: null },
  { id: 'e5', title: 'Tomorrow', notes: '', start: at(1, hour, 0), end: at(1, hour, 45), categoryId: null, taskId: null }
]
const categories = [
  { id: 'cat-work', name: 'Work', color: '#4C8DF6' },
  { id: 'cat-study', name: 'Study', color: '#8B6CF0' },
  { id: 'cat-personal', name: 'Personal', color: '#23B5A6' },
  { id: 'cat-long', name: 'University coursework and group projects', color: '#EF6F5E' }
]

const THEMES = {
  dark: { theme: 'dark', accent: '#F0A63A', bgColor: null, surfaceColor: null },
  'dark-accent': { theme: 'dark', accent: '#0044b3', bgColor: '#161a24', surfaceColor: null },
  paper: { theme: 'light', accent: '#8B6CF0', bgColor: '#f3ede1', surfaceColor: '#fffaf0' },
  oled: { theme: 'dark', accent: '#5DBB63', bgColor: '#000000', surfaceColor: '#111216' }
}

const problems = []
const note = (ok, message) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${message}`)
  if (!ok) problems.push(message)
}

/** Elements whose content is cut off or spills outside the window, ignoring intended truncation. */
const measure = (page) =>
  page.evaluate(() => {
    const out = []
    const vw = window.innerWidth
    const intended = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n)
        if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none' || /auto|scroll/.test(cs.overflowY + cs.overflowX)) return true
      }
      return false
    }
    for (const el of document.querySelectorAll('main *, header *, [role=dialog] *')) {
      if (el.closest('.fc-scroller, svg, .fc-timegrid-axis, [aria-hidden=true]')) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const label = `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} "${(el.textContent ?? '').trim().slice(0, 30)}"`
      // Spilling past the right edge of the window.
      if (r.right > vw + 1 && !intended(el)) out.push(`outside window: ${label}`)
      // A leaf with clipped text and no ellipsis.
      if (el.childElementCount === 0 && el.scrollWidth > el.clientWidth + 1 && !intended(el) && getComputedStyle(el).overflowX !== 'visible') out.push(`clipped: ${label}`)
    }
    // Sibling buttons/badges in a task row that overlap each other.
    for (const row of document.querySelectorAll('main li')) {
      const items = [...row.querySelectorAll('button, [class*=rounded-full]')].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('[data-testid=subtask-list]'))
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          if (items[i].contains(items[j]) || items[j].contains(items[i])) continue
          const a = items[i].getBoundingClientRect(), b = items[j].getBoundingClientRect()
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (w > 2 && h > 2) out.push(`overlap: "${(items[i].textContent ?? '').trim().slice(0, 20)}" x "${(items[j].textContent ?? '').trim().slice(0, 20)}"`)
        }
    }
    for (const d of document.querySelectorAll('[role=dialog]')) {
      const r = d.getBoundingClientRect()
      if (r.bottom > window.innerHeight + 1 || r.top < 0) out.push('dialog does not fit in the window')
    }
    return [...new Set(out)].slice(0, 12)
  })

await rm(base, { recursive: true, force: true })
await mkdir(shots, { recursive: true })
const only = process.argv[2] ? process.argv[2].split(',') : Object.keys(THEMES)

for (const name of only) {
  const dataDir = resolve(base, name)
  await mkdir(dataDir, { recursive: true })
  const settings = { launchAtStartup: false, startMinimized: false, alwaysOnTop: false, notificationSounds: false, language: 'en', focusMin: 25, breakMin: 5, ...THEMES[name] }
  await writeFile(resolve(dataDir, 'data.json'), JSON.stringify({ schemaVersion: 1, savedAt: Date.now(), data: { tasks, events, categories, settings, focus: { taskId: 'a', phase: 'focus', status: 'paused', durationMs: 7200000, remainingMs: 5400000 } }, meta: {} }))

  const app = await electron.launch({ executablePath: electronPath, args: [root], env: { ...process.env, FOCUSFLOW_DATA_DIR: dataDir, FOCUSFLOW_SUPABASE_URL: 'off' } })
  const page = await app.firstWindow()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.waitForSelector('nav')
  const nav = async (label) => {
    await page.locator('nav').getByRole('button', { name: label, exact: true }).click()
    await page.waitForTimeout(450)
  }
  const size = (w, h) => app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), [w, h])
  const capture = async (label) => {
    await page.waitForTimeout(350)
    await page.screenshot({ path: resolve(shots, `${name}-${label}.png`) })
    const found = await measure(page)
    note(found.length === 0, `${name} / ${label}${found.length ? ': ' + found.join(' | ') : ''}`)
  }

  for (const [w, h, tag] of [[940, 620, 'min'], [1280, 800, 'wide']]) {
    await size(w, h)
    await page.waitForTimeout(300)
    await nav('Focus')
    await capture(`${tag}-focus`)
    await nav('Tasks')
    await page.getByRole('button', { name: /^Show steps/ }).first().click()
    await capture(`${tag}-tasks`)
    await page.getByRole('button', { name: /^Hide steps/ }).first().click()
    await page.getByRole('button', { name: 'Edit task' }).first().click()
    await page.getByRole('dialog').waitFor()
    await capture(`${tag}-editor`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await nav('Calendar')
    await page.waitForSelector('.fc-timegrid-slot-lane')
    await capture(`${tag}-week`)
    if (tag === 'min') {
      await page.locator('.ff-ev-task').first().click()
      await page.getByRole('dialog').waitFor()
      await capture(`${tag}-flexible`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await page.getByRole('radio', { name: 'Month' }).click()
      await page.waitForSelector('.fc-daygrid-day')
      await capture(`${tag}-month`)
      await page.getByRole('radio', { name: 'Day' }).click()
      await page.waitForSelector('.fc-timeGridDay-view')
      await capture(`${tag}-day`)
      await page.getByRole('radio', { name: 'Week' }).click()
    }
  }
  note(errors.length === 0, `${name}: no console errors${errors.length ? ' -> ' + errors.slice(0, 3).join(' | ').slice(0, 300) : ''}`)
  await app.evaluate(({ app }) => app.quit())
  await app.waitForEvent('close').catch(() => {})
}

console.log(problems.length ? `\n${problems.length} problem(s)` : '\nVisual audit passed.')
process.exit(problems.length ? 1 : 0)
