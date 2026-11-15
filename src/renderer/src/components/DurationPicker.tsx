import { useState } from 'react'
import { DURATION_PRESETS } from '@shared/defaults'
import { formatDuration } from '@shared/time'
import { useT } from '@/lib/hooks'
import { Chip, inputBase } from './ui'

const isPreset = (minutes: number): boolean => (DURATION_PRESETS as readonly number[]).includes(minutes)

/** Preset chips (15m, 30m, 1h, 2h) plus a custom number of minutes. */
export function DurationPicker({ value, onChange }: { value: number; onChange(minutes: number): void }) {
  const t = useT()
  const [custom, setCustom] = useState(!isPreset(value))
  const [text, setText] = useState(String(value))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {DURATION_PRESETS.map((minutes) => (
        <Chip
          key={minutes}
          selected={!custom && value === minutes}
          onClick={() => {
            setCustom(false)
            setText(String(minutes))
            onChange(minutes)
          }}
        >
          {formatDuration(minutes)}
        </Chip>
      ))}
      <Chip selected={custom} onClick={() => setCustom(true)}>
        {t('field.custom')}
      </Chip>
      {custom && (
        <span className="inline-flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={1440}
            value={text}
            aria-label={`${t('field.custom')} (${t('field.minutes')})`}
            onChange={(e) => {
              setText(e.target.value)
              const minutes = Math.round(Number(e.target.value))
              if (Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440) onChange(minutes)
            }}
            className={`${inputBase} h-8 w-20 tabular-nums`}
          />
          <span className="text-[13px] text-muted">{t('field.minutes')}</span>
        </span>
      )}
    </div>
  )
}
