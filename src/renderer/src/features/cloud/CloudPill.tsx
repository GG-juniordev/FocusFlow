import { Cloud, CloudAlert, CloudOff, HardDrive, RefreshCw } from 'lucide-react'
import type { MessageKey } from '@shared/i18n'
import type { CloudPhase } from '@shared/types'
import { cn } from '@/components/ui'
import { useT } from '@/lib/hooks'
import { useApp } from '@/state/useApp'

const LABEL: Record<CloudPhase, MessageKey> = {
  local: 'cloud.local',
  choose: 'cloud.choose',
  syncing: 'cloud.syncing',
  synced: 'cloud.synced',
  offline: 'cloud.offline',
  error: 'cloud.error'
}

/** Where the Account section lives, so the pill can jump to it. */
export const ACCOUNT_ANCHOR = 'cloud-account'

/** Small always-visible status: "Local mode" or the state of cloud sync. Click to open the Account settings. */
export function CloudPill() {
  const t = useT()
  const cloud = useApp((s) => s.cloud)
  const setView = useApp((s) => s.setView)
  if (!cloud) return null

  const { phase } = cloud
  const Icon =
    phase === 'local' ? HardDrive : phase === 'offline' ? CloudOff : phase === 'error' ? CloudAlert : phase === 'syncing' ? RefreshCw : Cloud
  const title =
    phase === 'local'
      ? t('cloud.pillLocal')
      : `${t('cloud.pillAccount', { email: cloud.user?.email ?? '' })}${cloud.pending > 0 ? ` · ${t('account.pending', { n: cloud.pending })}` : ''}`

  return (
    <button
      type="button"
      title={title}
      data-testid="cloud-pill"
      data-phase={phase}
      onClick={() => {
        setView('settings')
        // Wait for the view to switch before scrolling to the section.
        setTimeout(() => document.getElementById(ACCOUNT_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 320)
      }}
      className={cn(
        'no-drag ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-[color,border-color,background-color,transform] duration-150 active:scale-95',
        phase === 'error' || phase === 'choose'
          ? 'border-danger/50 text-danger hover:bg-danger/10'
          : phase === 'synced'
            ? 'border-line text-accent-text hover:border-faint'
            : 'border-line text-muted hover:border-faint hover:text-ink'
      )}
    >
      <Icon size={13} className={phase === 'syncing' ? 'animate-spin' : undefined} />
      {t(LABEL[phase])}
      {cloud.pending > 0 && phase !== 'local' && (
        <span className="rounded-full bg-raised px-1.5 tabular-nums text-[11px] text-muted">{cloud.pending}</span>
      )}
    </button>
  )
}
