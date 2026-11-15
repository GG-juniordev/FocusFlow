import { useEffect, useState, type ReactNode } from 'react'
import { Check, FolderOpen, Plus, Trash2 } from 'lucide-react'
import { ACCENTS, CATEGORY_COLORS } from '@shared/defaults'
import { LANGUAGES } from '@shared/i18n'
import type { Category, Settings } from '@shared/types'
import { Button, IconButton, Segmented, Toggle, cn, inputBase, inputClass } from '@/components/ui'
import { useData, useT } from '@/lib/hooks'
import { AccountSection } from '@/features/cloud/AccountSection'
import { ACCOUNT_ANCHOR } from '@/features/cloud/CloudPill'
import { BackgroundPicker } from './BackgroundPicker'
import { SavedTools } from './SavedTools'
import { newId, useApp } from '@/state/useApp'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9 first:mt-6">
      <h2 className="mb-1 font-display text-[17px] font-semibold">{title}</h2>
      <div className="divide-y divide-line border-y border-line">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <div className="text-[15px]">{label}</div>
        {hint && <div className="mt-0.5 text-[13px] text-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** A minutes field that commits when you leave it or press Enter. */
function MinutesInput({ value, max, label, onCommit }: { value: number; max: number; label: string; onCommit(v: number): void }) {
  const t = useT()
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const commit = (): void => {
    const minutes = Math.round(Number(text))
    if (Number.isFinite(minutes) && minutes >= 1 && minutes <= max) onCommit(minutes)
    else setText(String(value))
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={max}
        value={text}
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className={`${inputBase} w-20 tabular-nums`}
      />
      <span className="text-[13px] text-muted">{t('field.minutes')}</span>
    </span>
  )
}

export function SettingsView() {
  const data = useData()
  const env = useApp((s) => s.env)
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const { settings } = data
  const update = (patch: Partial<Settings>): void => dispatch({ type: 'settings/update', patch })
  const customAccent = !(ACCENTS as readonly string[]).some((a) => a.toLowerCase() === settings.accent.toLowerCase())

  const addCategory = (): void => {
    const used = new Set(data.categories.map((c) => c.color.toLowerCase()))
    const color = CATEGORY_COLORS.find((c) => !used.has(c.toLowerCase())) ?? CATEGORY_COLORS[0]
    dispatch({ type: 'category/upsert', category: { id: newId(), name: t('set.newCategory'), color } })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[680px] px-12 pb-16 pt-4">
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.01em]">{t('set.title')}</h1>

        <Section title={t('set.appearance')}>
          <Row label={t('set.theme')} hint={settings.bgColor ? t('set.themeOverridden') : undefined}>
            <Segmented
              label={t('set.theme')}
              value={settings.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { id: 'dark', label: t('set.theme.dark') },
                { id: 'light', label: t('set.theme.light') },
                { id: 'system', label: t('set.theme.system') }
              ]}
            />
          </Row>
          <Row label={t('set.accent')}>
            <div className="flex items-center gap-2" role="radiogroup" aria-label={t('set.accent')}>
              {ACCENTS.map((color) => {
                const selected = settings.accent.toLowerCase() === color.toLowerCase()
                return (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={color}
                    onClick={() => update({ accent: color })}
                    className={cn(
                      'grid size-7 place-items-center rounded-full transition-transform hover:scale-110',
                      selected && 'ring-2 ring-ink ring-offset-2 ring-offset-bg'
                    )}
                    style={{ background: color }}
                  >
                    {selected && <Check size={14} strokeWidth={3} color="#15171d" />}
                  </button>
                )
              })}
              <span className="mx-1 h-5 w-px bg-line" />
              <input
                type="color"
                value={settings.accent}
                title={t('set.accentCustom')}
                aria-label={t('set.accentCustom')}
                onChange={(e) => update({ accent: e.target.value })}
                className={cn('size-7 rounded-full', customAccent && 'ring-2 ring-ink ring-offset-2 ring-offset-bg')}
              />
            </div>
          </Row>
          <BackgroundPicker />
          <Row label={t('set.language')}>
            <Segmented
              label={t('set.language')}
              value={settings.language}
              onChange={(language) => update({ language })}
              options={LANGUAGES}
            />
          </Row>
        </Section>

        <Section title={t('set.timer')}>
          <Row label={t('set.focusMin')} hint={t('set.focusMinHint')}>
            <MinutesInput
              value={settings.focusMin}
              max={600}
              label={t('set.focusMin')}
              onCommit={(focusMin) => update({ focusMin })}
            />
          </Row>
          <Row label={t('set.breakMin')}>
            <MinutesInput
              value={settings.breakMin}
              max={120}
              label={t('set.breakMin')}
              onCommit={(breakMin) => update({ breakMin })}
            />
          </Row>
        </Section>

        <Section title={t('set.behavior')}>
          <Row label={t('set.startup')} hint={env && !env.packaged ? t('set.startupDev') : undefined}>
            <Toggle
              label={t('set.startup')}
              checked={settings.launchAtStartup}
              onChange={(launchAtStartup) => update({ launchAtStartup })}
            />
          </Row>
          <Row label={t('set.startMin')} hint={t('set.startMinHint')}>
            <Toggle
              label={t('set.startMin')}
              checked={settings.startMinimized}
              onChange={(startMinimized) => update({ startMinimized })}
            />
          </Row>
          <Row label={t('set.onTop')}>
            <Toggle label={t('set.onTop')} checked={settings.alwaysOnTop} onChange={(alwaysOnTop) => update({ alwaysOnTop })} />
          </Row>
          <Row label={t('set.sounds')}>
            <Toggle
              label={t('set.sounds')}
              checked={settings.notificationSounds}
              onChange={(notificationSounds) => update({ notificationSounds })}
            />
          </Row>
        </Section>

        <div id={ACCOUNT_ANCHOR} className="scroll-mt-4">
          <Section title={t('set.account')}>
            <AccountSection />
          </Section>
        </div>

        <Section title={t('set.tools')}>
          <SavedTools />
        </Section>

        <Section title={t('set.categories')}>
          {data.categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
          <div className="py-3">
            <Button size="sm" onClick={addCategory}>
              <Plus size={15} />
              {t('set.addCategory')}
            </Button>
          </div>
        </Section>

        <Section title={t('set.data')}>
          <Row label={t('set.dataHint')} hint={env?.dataPath}>
            <Button size="sm" onClick={() => window.api.windowCommand('open-data-folder')}>
              <FolderOpen size={15} />
              {t('set.openFolder')}
            </Button>
          </Row>
        </Section>

        {env && <p className="mt-8 text-xs text-faint">FocusFlow {env.version}</p>}
      </div>
    </div>
  )
}

function CategoryRow({ category }: { category: Category }) {
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const save = (patch: Partial<Category>): void =>
    dispatch({ type: 'category/upsert', category: { ...category, ...patch } })

  return (
    <div className="flex items-center gap-3 py-2.5">
      <input
        type="color"
        value={category.color}
        aria-label={`${t('set.accent')}: ${category.name}`}
        onChange={(e) => save({ color: e.target.value })}
        className="size-6 shrink-0 rounded-full"
      />
      <input
        value={category.name}
        aria-label={t('set.categoryName')}
        placeholder={t('set.categoryName')}
        onChange={(e) => save({ name: e.target.value })}
        className={`${inputClass} max-w-[280px]`}
      />
      <span className="flex-1" />
      <IconButton
        label={t('set.deleteCategory')}
        tone="danger"
        onClick={() => dispatch({ type: 'category/remove', id: category.id })}
      >
        <Trash2 size={15} />
      </IconButton>
    </div>
  )
}
