import { useRef, useState } from 'react'
import { ImageUp } from 'lucide-react'
import { firstGrapheme } from '@shared/tools'
import type { ToolIconSpec } from '@shared/types'
import { CustomIcon, DefaultToolIcon } from '@/components/tools'
import { Button, Segmented, cn, inputBase } from '@/components/ui'
import { useT } from '@/lib/hooks'
import { ICON_ACCEPT, fileToIcon } from '@/lib/iconImage'

const EMOJIS = [
  '💻', '🖥️', '⌨️', '🧑‍💻', '🐍', '☕', '🌐', '🔎',
  '🎥', '▶️', '🎧', '🎵', '📚', '📖', '📝', '📄',
  '📊', '📈', '🗂️', '📁', '✏️', '🎨', '🧪', '🧮',
  '📐', '💬', '📧', '📅', '⏱️', '🧠', '🚀', '⭐'
]

type Tab = 'default' | 'emoji' | 'image'

interface Props {
  value: ToolIconSpec | null
  /** For the "Default" preview. */
  preset: string | null
  hasUrl: boolean
  onChange(next: ToolIconSpec | null): void
  onDone(): void
}

/** Choose a tool's icon: the built-in one, an emoji, or an image from this PC. */
export function IconEditor({ value, preset, hasUrl, onChange, onDone }: Props) {
  const t = useT()
  const [tab, setTab] = useState<Tab>(value?.type ?? 'default')
  const [emojiText, setEmojiText] = useState(value?.type === 'emoji' ? value.value : '')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const pickEmoji = (text: string): void => {
    const emoji = firstGrapheme(text)
    setEmojiText(emoji)
    if (emoji) onChange({ type: 'emoji', value: emoji })
  }

  const upload = async (picked: File | undefined): Promise<void> => {
    if (!picked) return
    setBusy(true)
    setError(false)
    try {
      onChange({ type: 'image', src: await fileToIcon(picked) })
    } catch {
      setError(true)
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }

  return (
    <div className="mt-1 mb-2 rounded-xl border border-line bg-bg p-3">
      <div className="flex items-center justify-between gap-3">
        <Segmented<Tab>
          label={t('set.toolIcon', { name: '' })}
          value={tab}
          onChange={(next) => {
            setTab(next)
            if (next === 'default') onChange(null)
          }}
          options={[
            { id: 'default', label: t('icon.default') },
            { id: 'emoji', label: t('icon.emoji') },
            { id: 'image', label: t('icon.image') }
          ]}
        />
        <Button size="sm" variant="primary" onClick={onDone}>
          {t('common.done')}
        </Button>
      </div>

      {tab === 'default' && (
        <div className="mt-3 flex items-center gap-3 text-[13px] text-muted">
          <span className="grid size-9 place-items-center rounded-lg bg-raised">
            <DefaultToolIcon preset={preset} hasUrl={hasUrl} size={20} />
          </span>
          {t('icon.defaultHint')}
        </div>
      )}

      {tab === 'emoji' && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <input
              value={emojiText}
              aria-label={t('icon.emojiInput')}
              placeholder={t('icon.emojiInput')}
              onChange={(e) => pickEmoji(e.target.value)}
              className={`${inputBase} w-44 text-base`}
            />
            <span className="text-xs text-faint">{t('icon.emojiHint')}</span>
          </div>
          <div className="mt-2.5 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5">
            {EMOJIS.map((emoji) => {
              const selected = value?.type === 'emoji' && value.value === emoji
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-label={emoji}
                  aria-pressed={selected}
                  onClick={() => pickEmoji(emoji)}
                  className={cn(
                    'grid aspect-square place-items-center rounded-md transition-[background-color,transform] duration-150 hover:bg-raised active:scale-90',
                    selected && 'bg-accent-soft ring-1 ring-accent'
                  )}
                >
                  <CustomIcon icon={{ type: 'emoji', value: emoji }} size={20} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'image' && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <input
            ref={file}
            type="file"
            accept={ICON_ACCEPT}
            className="hidden"
            data-testid="icon-file"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <Button size="sm" disabled={busy} onClick={() => file.current?.click()}>
            <ImageUp size={15} />
            {value?.type === 'image' ? t('icon.replace') : t('icon.upload')}
          </Button>
          {value?.type === 'image' && (
            // The icon at the sizes it is actually shown at.
            <span className="flex items-end gap-3" aria-label={t('set.preview')}>
              {[16, 20, 32].map((px) => (
                <span key={px} className="flex flex-col items-center gap-1">
                  <CustomIcon icon={value} size={px} />
                  <span className="text-[10px] tabular-nums text-faint">{px}px</span>
                </span>
              ))}
            </span>
          )}
          <p className={cn('w-full text-xs', error ? 'text-danger' : 'text-faint')} role={error ? 'alert' : undefined}>
            {error ? t('icon.uploadError') : t('icon.uploadHint')}
          </p>
        </div>
      )}
    </div>
  )
}
