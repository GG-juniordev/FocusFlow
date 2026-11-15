import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Pipette } from 'lucide-react'
import {
  BACKGROUND_PRESETS,
  THEME_DEFAULTS,
  customPalette,
  isHex,
  readability,
  resolvePalette,
  type Palette
} from '@shared/palette'
import type { MessageKey } from '@shared/i18n'
import type { Settings } from '@shared/types'
import { cn, inputBase } from '@/components/ui'
import { useData, useT } from '@/lib/hooks'
import { useApp } from '@/state/useApp'

const same = (a: string | null, b: string | null): boolean => (a ?? '').toLowerCase() === (b ?? '').toLowerCase()

/** A colour swatch that opens the system picker, plus an editable HEX field. */
function ColorField({ value, label, onChange }: { value: string; label: string; onChange(hex: string): void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  const commit = (): void => {
    const hex = text.startsWith('#') ? text : `#${text}`
    if (isHex(hex)) onChange(hex.toLowerCase())
    else setText(value)
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="color"
        value={value}
        aria-label={label}
        title={label}
        onChange={(e) => onChange(e.target.value)}
        className="size-8 shrink-0 rounded-full border border-line"
      />
      <input
        value={text}
        aria-label={`${label} (HEX)`}
        spellCheck={false}
        maxLength={7}
        onChange={(e) => setText(e.target.value.trim())}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className={`${inputBase} h-8 w-[92px] font-mono text-[13px] uppercase`}
      />
    </span>
  )
}

/** A miniature of the app in the given colours, used for the preset tiles. */
function Swatch({ palette }: { palette: Palette }) {
  return (
    <span
      className="flex h-[52px] w-full gap-1 overflow-hidden rounded-lg border p-1.5"
      style={{ background: palette.bg, borderColor: palette.line }}
    >
      <span className="w-2 rounded-sm" style={{ background: palette.rail }} />
      <span className="flex flex-1 flex-col justify-center gap-1 rounded-md px-1.5" style={{ background: palette.surface }}>
        <span className="h-1.5 w-3/4 rounded-full" style={{ background: palette.ink }} />
        <span className="h-1 w-1/2 rounded-full" style={{ background: palette.muted }} />
        <span className="h-1 w-1/4 rounded-full" style={{ background: 'var(--accent)' }} />
      </span>
    </span>
  )
}

export function BackgroundPicker() {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const { settings } = data
  const update = (patch: Partial<Settings>): void => dispatch({ type: 'settings/update', patch })

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const themeTone = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme
  const current = resolvePalette(settings, systemDark) ?? THEME_DEFAULTS[themeTone]
  const activePreset = BACKGROUND_PRESETS.find((p) => same(p.bg, settings.bgColor) && same(p.surface, settings.surfaceColor))
  const isDefault = !settings.bgColor && !settings.surfaceColor
  const isCustom = !isDefault && !activePreset
  const { ratio, level } = readability(current)

  const tile = (selected: boolean): string =>
    cn(
      'group flex flex-col gap-1.5 rounded-xl p-1.5 text-left text-xs font-medium transition-[background-color,transform] duration-150 active:scale-[0.97]',
      selected ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-raised hover:text-ink'
    )
  const tick = (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="grid size-4 place-items-center rounded-full bg-accent text-accent-ink"
    >
      <Check size={10} strokeWidth={3.5} />
    </motion.span>
  )

  return (
    <div className="py-4">
      <div className="text-[15px]">{t('set.background')}</div>
      <div className="mt-0.5 text-[13px] text-muted">{t('set.bgHint')}</div>

      <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label={t('set.background')}>
        <button
          type="button"
          role="radio"
          aria-checked={isDefault}
          onClick={() => update({ bgColor: null, surfaceColor: null })}
          className={tile(isDefault)}
        >
          <Swatch palette={THEME_DEFAULTS[themeTone]} />
          <span className="flex items-center gap-1.5 px-0.5">
            {isDefault && tick}
            {t('set.bgDefault')}
          </span>
        </button>
        {BACKGROUND_PRESETS.map((p) => {
          const selected = activePreset?.id === p.id
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => update({ bgColor: p.bg, surfaceColor: p.surface })}
              className={tile(selected)}
            >
              <Swatch palette={customPalette(p.bg, p.surface)} />
              <span className="flex items-center gap-1.5 px-0.5">
                {selected && tick}
                {t(`bg.${p.id}` as MessageKey)}
              </span>
            </button>
          )
        })}
        {/* Custom: the whole tile opens the colour picker. */}
        <label className={cn(tile(isCustom), 'relative cursor-pointer')}>
          {isCustom ? (
            <Swatch palette={current} />
          ) : (
            <span className="grid h-[52px] w-full place-items-center rounded-lg border border-dashed border-line text-muted group-hover:text-ink">
              <Pipette size={18} />
            </span>
          )}
          <span className="flex items-center gap-1.5 px-0.5">
            {isCustom && tick}
            {t('set.bgCustom')}
          </span>
          <input
            type="color"
            value={settings.bgColor ?? current.bg}
            aria-label={t('set.bgCustom')}
            onChange={(e) => update({ bgColor: e.target.value, surfaceColor: null })}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-muted">{t('set.background')}</span>
        <ColorField
          value={current.bg}
          label={t('set.bgCustom')}
          onChange={(bgColor) => update({ bgColor, surfaceColor: settings.surfaceColor })}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-muted">{t('set.surface')}</span>
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            aria-pressed={!settings.surfaceColor}
            onClick={() => update({ surfaceColor: null })}
            className={cn(
              'h-8 rounded-full border px-3 text-[13px] font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-95',
              !settings.surfaceColor ? 'border-accent bg-accent-soft text-ink' : 'border-line text-muted hover:text-ink'
            )}
          >
            {t('set.surfaceAuto')}
          </button>
          <ColorField
            value={current.surface}
            label={t('set.surfaceCustom')}
            onChange={(surfaceColor) => update({ surfaceColor, bgColor: settings.bgColor ?? current.bg })}
          />
        </span>
      </div>

      {/* Live preview with the measured contrast, so a poor combination is obvious before you leave the page. */}
      <div className="mt-4 rounded-xl border border-line p-3" style={{ background: current.bg }} aria-label={t('set.preview')}>
        <div className="rounded-lg border border-line p-3" style={{ background: current.surface }}>
          <div className="text-[15px] font-semibold" style={{ color: current.ink }}>
            {t('set.previewTitle')}
          </div>
          <div className="mt-0.5 text-[13px]" style={{ color: current.muted }}>
            {t('set.previewBody')}
          </div>
        </div>
        <div
          role="status"
          className={cn(
            'mt-2.5 flex items-center gap-2 text-[13px] font-medium',
            level === 'low' ? 'text-danger' : 'text-muted'
          )}
        >
          <span
            className="size-2 rounded-full"
            style={{ background: level === 'low' ? 'var(--danger)' : level === 'good' ? '#d99a2b' : '#3fb37f' }}
          />
          {t(`set.contrast.${level}`, { ratio: ratio.toFixed(1) })}
        </div>
      </div>
    </div>
  )
}
