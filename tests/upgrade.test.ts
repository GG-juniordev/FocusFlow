import { describe, expect, it } from 'vitest'
import { defaultData } from '@shared/defaults'
import { applyAction } from '@shared/model'
import { BACKGROUND_PRESETS, contrast, customPalette, readability, resolvePalette } from '@shared/palette'
import { normalize } from '../src/main/store'

/* tools: see tests/tools.test.ts */

describe('palette', () => {
  it('keeps body text readable on every preset', () => {
    for (const p of BACKGROUND_PRESETS) {
      const palette = customPalette(p.bg, p.surface)
      expect(readability(palette).ratio, p.id).toBeGreaterThanOrEqual(7)
      expect(contrast(palette.muted, palette.surface), `${p.id} muted`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('picks dark text on light backgrounds and light text on dark ones', () => {
    expect(customPalette('#ffffff', null).tone).toBe('light')
    expect(customPalette('#000000', null).tone).toBe('dark')
    // A mid-tone background still gets whichever text colour reads better.
    const mid = customPalette('#7a7a7a', null)
    expect(readability(mid).ratio).toBeGreaterThanOrEqual(3.5)
  })

  it('reports a clash between the chosen card colour and the text', () => {
    // Dark page, but nearly white cards: one of the two must lose.
    const clash = customPalette('#000000', '#f0f0f0')
    expect(readability(clash).level).toBe('low')
  })

  it('only takes over from the theme when a custom colour is set', () => {
    expect(resolvePalette(defaultData().settings, true)).toBeNull()
    const s = { ...defaultData().settings, bgColor: '#0d1430' }
    expect(resolvePalette(s, true)?.bg).toBe('#0d1430')
  })

  it('validates colour settings', () => {
    let d = applyAction(defaultData(), { type: 'settings/update', patch: { bgColor: '#123456', surfaceColor: '#abcdef' } }, 0)
    expect(d.settings).toMatchObject({ bgColor: '#123456', surfaceColor: '#abcdef' })
    d = applyAction(d, { type: 'settings/update', patch: { bgColor: 'red' } }, 0)
    expect(d.settings.bgColor).toBe('#123456')
    d = applyAction(d, { type: 'settings/update', patch: { bgColor: null, surfaceColor: null } }, 0)
    expect(d.settings).toMatchObject({ bgColor: null, surfaceColor: null })
  })
})

describe('data from the previous version', () => {
  it('loads files saved before tools and custom colours existed', () => {
    const { data } = normalize(
      {
        schemaVersion: 1,
        data: {
          tasks: [{ id: 'a', title: 'Old task', estimateMin: 30 }],
          settings: { theme: 'light', accent: '#4C8DF6', language: 'it' }
        }
      },
      0
    )
    expect(data.tasks[0].tools).toEqual([])
    expect(data.tools.length).toBeGreaterThan(0)
    expect(data.settings).toMatchObject({
      theme: 'light',
      accent: '#4C8DF6',
      language: 'it',
      bgColor: null,
      surfaceColor: null
    })
  })
})
