import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultData } from '@shared/defaults'
import { applyAction } from '@shared/model'
import {
  defaultToolLibrary,
  isSafeUrl,
  presetLibraryId,
  resolveTool,
  sanitizeIcon,
  sanitizeTools,
  toolFromInput
} from '@shared/tools'
import type { AppData, LibraryTool } from '@shared/types'
import { JsonStore, normalize } from '../src/main/store'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const anki: LibraryTool = { id: 'anki', label: 'Anki', url: null, preset: null, icon: { type: 'emoji', value: '📚' } }

const withTask = (data: AppData, toolIds: string[]): AppData =>
  applyAction(
    data,
    {
      type: 'task/upsert',
      task: {
        id: 'task',
        title: 'Revise',
        tools: toolIds.map((id) => ({ ...data.tools.find((t) => t.id === id)! }))
      }
    },
    0
  )

describe('parsing what the user types', () => {
  it('recognises pasted links and names them after the site', () => {
    expect(toolFromInput('https://www.youtube.com/watch?v=abc')).toEqual({
      id: null,
      label: 'YouTube',
      url: 'https://www.youtube.com/watch?v=abc',
      preset: 'youtube',
      icon: null
    })
    expect(toolFromInput('https://docs.google.com/document/d/1/edit')?.preset).toBe('docs')
    expect(toolFromInput('www.example.org/page')?.url).toBe('https://www.example.org/page')
  })

  it('reuses a library tool with the same name, keeping its icon', () => {
    expect(toolFromInput('anki', [anki])).toEqual(anki)
    expect(toolFromInput('Node.js', [anki])).toMatchObject({ id: null, label: 'Node.js', icon: null })
    expect(toolFromInput('   ')).toBeNull()
  })

  it('only allows web and app links, never files or scripts', () => {
    expect(isSafeUrl('vscode://file/c:/x')).toBe(true)
    expect(isSafeUrl('file:///C:/Windows/System32/cmd.exe')).toBe(false)
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(sanitizeTools([{ label: 'Bad', url: 'file:///c:/x' }])[0].url).toBeNull()
  })
})

describe('icons', () => {
  it('keeps one emoji, including multi-part ones', () => {
    expect(sanitizeIcon({ type: 'emoji', value: '🧑‍💻 extra' })).toEqual({ type: 'emoji', value: '🧑‍💻' })
    expect(sanitizeIcon({ type: 'emoji', value: '🇮🇹' })).toEqual({ type: 'emoji', value: '🇮🇹' })
    expect(sanitizeIcon({ type: 'emoji', value: '  ' })).toBeNull()
  })

  it('accepts small PNG/WebP data URLs only', () => {
    expect(sanitizeIcon({ type: 'image', src: PNG })).toEqual({ type: 'image', src: PNG })
    expect(sanitizeIcon({ type: 'image', src: 'https://evil.example/x.png' })).toBeNull()
    expect(sanitizeIcon({ type: 'image', src: 'data:image/svg+xml;base64,PHN2Zz4=' })).toBeNull()
    expect(sanitizeIcon({ type: 'image', src: `data:image/png;base64,${'A'.repeat(60_000)}` })).toBeNull()
  })
})

describe('tool library', () => {
  it('starts with the built-in tools, which can be deleted like any other', () => {
    let d = defaultData()
    expect(d.tools.map((t) => t.label)).toContain('VS Code')
    d = applyAction(d, { type: 'tool/remove', id: presetLibraryId('vscode') }, 0)
    expect(d.tools.some((t) => t.label === 'VS Code')).toBe(false)
    d = applyAction(d, { type: 'tool/restoreDefaults' }, 0)
    expect(d.tools.filter((t) => t.label === 'VS Code')).toHaveLength(1)
    // Restoring twice adds nothing.
    expect(applyAction(d, { type: 'tool/restoreDefaults' }, 0)).toBe(d)
  })

  it('adds and edits tools, including their icon', () => {
    let d = applyAction(defaultData(), { type: 'tool/upsert', tool: anki }, 0)
    d = applyAction(d, { type: 'tool/upsert', tool: { ...anki, icon: { type: 'image', src: PNG } } }, 0)
    expect(d.tools.filter((t) => t.id === 'anki')).toEqual([{ ...anki, icon: { type: 'image', src: PNG } }])
    // Nonsense is rejected rather than stored.
    const same = applyAction(d, { type: 'tool/upsert', tool: { ...anki, label: '   ' } }, 0)
    expect(same).toBe(d)
  })

  it('tasks show the library version, so icon edits reach every task', () => {
    let d = applyAction(defaultData(), { type: 'tool/upsert', tool: anki }, 0)
    d = withTask(d, ['anki'])
    d = applyAction(d, { type: 'tool/upsert', tool: { ...anki, label: 'Anki decks', icon: { type: 'emoji', value: '🧠' } } }, 0)
    const shown = resolveTool(d.tasks[0].tools[0], d.tools)
    expect(shown).toMatchObject({ label: 'Anki decks', icon: { type: 'emoji', value: '🧠' } })
  })

  it('deleting a tool keeps it on old tasks as a plain tool with its last name and icon', () => {
    let d = applyAction(defaultData(), { type: 'tool/upsert', tool: anki }, 0)
    d = withTask(d, ['anki', presetLibraryId('google')])
    d = applyAction(d, { type: 'tool/upsert', tool: { ...anki, icon: { type: 'emoji', value: '🧠' } } }, 0)
    d = applyAction(d, { type: 'tool/remove', id: 'anki' }, 0)

    expect(d.tools.some((t) => t.id === 'anki')).toBe(false)
    const [kept, google] = d.tasks[0].tools
    expect(kept).toEqual({ id: null, label: 'Anki', url: null, preset: null, icon: { type: 'emoji', value: '🧠' } })
    expect(resolveTool(kept, d.tools)).toEqual(kept)
    expect(google.id).toBe(presetLibraryId('google'))
  })
})

describe('persistence', () => {
  it('icons and deletions survive a save and reload', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'focusflow-tools-'))
    try {
      let d = applyAction(defaultData(), { type: 'tool/upsert', tool: { ...anki, icon: { type: 'image', src: PNG } } }, 0)
      d = withTask(d, ['anki'])
      d = applyAction(d, { type: 'tool/remove', id: presetLibraryId('figma') }, 0)
      const store = new JsonStore(dir)
      store.save(d, { window: {}, trayHintShown: false })
      store.flush()

      const loaded = new JsonStore(dir).load().data
      expect(loaded.tools.find((t) => t.id === 'anki')?.icon).toEqual({ type: 'image', src: PNG })
      expect(loaded.tools.some((t) => t.id === presetLibraryId('figma'))).toBe(false)
      expect(loaded.tasks[0].tools[0]).toMatchObject({ id: 'anki', label: 'Anki' })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('migrates the previous version: built-ins plus old saved tools, and links task tools to them', () => {
    const { data } = normalize(
      {
        data: {
          tasks: [
            {
              id: 'a',
              title: 'Old task',
              tools: [
                { label: 'Google', url: 'https://www.google.com', preset: 'google' },
                { label: 'Anki', url: null, preset: null }
              ]
            }
          ],
          settings: { savedTools: [{ label: 'Anki', url: null, preset: null }] }
        }
      },
      0
    )
    expect(data.tools).toHaveLength(defaultToolLibrary().length + 1)
    const ankiId = data.tools.find((t) => t.label === 'Anki')?.id
    expect(ankiId).toBeTruthy()
    expect(data.tasks[0].tools.map((t) => t.id)).toEqual([presetLibraryId('google'), ankiId])
    expect('savedTools' in data.settings).toBe(false)
  })

  it('keeps an emptied library empty instead of re-adding the built-ins', () => {
    const { data } = normalize({ data: { tools: [] } }, 0)
    expect(data.tools).toEqual([])
  })
})
