import { useCallback, useState } from 'react'
import type { Translate } from '@shared/i18n'
import type { Language } from '@shared/types'
import { useToasts } from '@/components/toast'
import { localeOf, useT } from '@/lib/hooks'

/** Known error codes get a translated explanation; anything else is the server's own message. */
export function explainSyncError(error: string | null | undefined, t: Translate): string {
  if (!error || error === 'network') return t('account.err.network')
  if (error === 'schema') return t('account.err.schema')
  return error
}

/** "14:02" for today, otherwise "15 Nov, 14:02". */
export function formatSyncTime(at: number, language: Language): string {
  const date = new Date(at)
  const locale = localeOf(language)
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === new Date().toDateString()) return time
  return `${date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${time}`
}

/** Run a sync on request and confirm the outcome with a toast. */
export function useSyncNow(): { syncing: boolean; syncNow(): Promise<void> } {
  const t = useT()
  const show = useToasts((s) => s.show)
  const [syncing, setSyncing] = useState(false)

  const syncNow = useCallback(async () => {
    setSyncing(true)
    try {
      const result = await window.api.cloudCommand({ type: 'sync-now' })
      if (result.ok) show('success', t('sync.ok'))
      else show('error', t('sync.failed', { reason: explainSyncError(result.error, t) }))
    } catch (error) {
      show('error', t('sync.failed', { reason: error instanceof Error ? error.message : String(error) }))
    } finally {
      setSyncing(false)
    }
  }, [show, t])

  return { syncing, syncNow }
}
