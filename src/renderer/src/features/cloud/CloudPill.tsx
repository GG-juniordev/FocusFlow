import { CloudAlert, HardDrive, RefreshCw } from 'lucide-react'
import { cn } from '@/components/ui'
import { useData, useT } from '@/lib/hooks'
import { useApp } from '@/state/useApp'
import { formatSyncTime, useSyncNow } from './sync'

/** Where the Account section lives, so the pill can jump to it. */
export const ACCOUNT_ANCHOR = 'cloud-account'

/**
 * Title-bar cloud control.
 * Not signed in: a quiet "Local mode" pill that opens the Cloud sync settings.
 * Signed in: a "Sync now" button with the last sync time, or a badge when there
 * are local changes that have not been synced. Sync only happens on this click.
 */
export function CloudPill() {
  const t = useT()
  const cloud = useApp((s) => s.cloud)
  const setView = useApp((s) => s.setView)
  const language = useData().settings.language
  const { syncing, syncNow } = useSyncNow()
  if (!cloud) return null

  const { phase, pending } = cloud
  const openSettings = (): void => {
    setView('settings')
    // Wait for the view to switch before scrolling to the section.
    setTimeout(() => document.getElementById(ACCOUNT_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 320)
  }
  const base =
    'no-drag ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-[color,border-color,background-color,transform] duration-150 active:scale-95'

  if (!cloud.user || phase === 'local' || phase === 'choose') {
    const choosing = phase === 'choose'
    return (
      <button
        type="button"
        title={choosing ? t('account.status.choose') : t('cloud.pillLocal')}
        data-testid="cloud-pill"
        data-phase={phase}
        onClick={openSettings}
        className={cn(
          base,
          choosing ? 'border-danger/50 text-danger hover:bg-danger/10' : 'border-line text-muted hover:border-faint hover:text-ink'
        )}
      >
        {choosing ? <CloudAlert size={13} /> : <HardDrive size={13} />}
        {choosing ? t('cloud.choose') : t('cloud.local')}
      </button>
    )
  }

  const busy = syncing || phase === 'syncing'
  const failed = phase === 'offline' || phase === 'error'
  const last = cloud.lastSyncedAt ? t('sync.last', { time: formatSyncTime(cloud.lastSyncedAt, language) }) : t('sync.never')
  const title = [
    t('cloud.pillAccount', { email: cloud.user.email ?? '' }),
    last,
    pending > 0 ? t('sync.unsynced') : null,
    failed ? t('cloud.' + phase as 'cloud.offline' | 'cloud.error') : null
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <button
      type="button"
      title={title}
      data-testid="cloud-pill"
      data-phase={busy ? 'syncing' : phase}
      disabled={busy}
      onClick={() => void syncNow()}
      className={cn(
        base,
        failed
          ? 'border-danger/50 text-ink hover:bg-danger/10'
          : pending > 0
            ? 'border-accent bg-accent-soft text-ink hover:brightness-110'
            : 'border-line text-muted hover:border-faint hover:text-ink'
      )}
    >
      {failed ? <CloudAlert size={13} className="text-danger" /> : <RefreshCw size={13} className={busy ? 'animate-spin' : undefined} />}
      <span>{busy ? t('cloud.syncing') : t('sync.now')}</span>
      {!busy && pending > 0 && (
        <span
          data-testid="unsynced-badge"
          className="rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-accent-ink"
        >
          {t('sync.unsyncedCount', { n: pending })}
        </span>
      )}
      {!busy && pending === 0 && cloud.lastSyncedAt && (
        <span className="tabular-nums text-faint">{formatSyncTime(cloud.lastSyncedAt, language)}</span>
      )}
    </button>
  )
}
