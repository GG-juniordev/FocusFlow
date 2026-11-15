import { useState, type FormEvent } from 'react'
import { AnimatePresence } from 'motion/react'
import { GitBranch, Globe, LogOut, Mail, RefreshCw } from 'lucide-react'
import type { MessageKey, Translate } from '@shared/i18n'
import type { CloudCommand, CloudResult, CloudState } from '@shared/types'
import { Button, Field, cn, inputClass } from '@/components/ui'
import { localeOf, useData, useT } from '@/lib/hooks'
import { useApp } from '@/state/useApp'
import { SignOutModal } from './CloudModals'

/** Known error codes get a translated explanation; anything else is the server's own message. */
function explain(error: string | null | undefined, t: Translate): string | null {
  if (!error) return null
  if (error === 'network') return t('account.err.network')
  if (error === 'schema') return t('account.err.schema')
  return error
}

const INFO: Record<NonNullable<CloudResult['info']>, MessageKey> = {
  'confirm-email': 'account.confirmEmail',
  'link-sent': 'account.linkSent',
  'browser-opened': 'account.browser'
}

function SignInForm() {
  const t = useT()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const send = async (command: CloudCommand): Promise<void> => {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const result = await window.api.cloudCommand(command)
      if (!result.ok) setError(explain(result.error, t))
      else if (result.info) setInfo(t(INFO[result.info]))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!email.trim()) return setError(t('account.err.email'))
    if (password.length < 6) return setError(t('account.err.password'))
    void send({ type: mode, email: email.trim(), password })
  }

  const magicLink = (): void => {
    if (!email.trim()) return setError(t('account.err.email'))
    void send({ type: 'magic-link', email: email.trim() })
  }

  return (
    <div>
      <form onSubmit={submit} className="grid max-w-[420px] gap-3">
        <Field label={t('account.email')}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t('account.password')}>
          <input
            type="password"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {mode === 'sign-in' ? t('account.signIn') : t('account.signUp')}
          </Button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
              setError(null)
            }}
            className="rounded px-1 text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {mode === 'sign-in' ? t('account.toSignUp') : t('account.toSignIn')}
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={magicLink}>
          <Mail size={14} />
          {t('account.magic')}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void send({ type: 'oauth', provider: 'github' })}>
          <GitBranch size={14} />
          {t('account.github')}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void send({ type: 'oauth', provider: 'google' })}>
          <Globe size={14} />
          {t('account.google')}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="mt-3 text-[13px] text-accent-text">
          {info}
        </p>
      )}
    </div>
  )
}

function SignedIn({ cloud }: { cloud: CloudState }) {
  const t = useT()
  const language = useData().settings.language
  const [signingOut, setSigningOut] = useState(false)
  const [busy, setBusy] = useState(false)

  const status =
    cloud.phase === 'error'
      ? explain(cloud.error, t)
      : cloud.phase === 'offline'
        ? t('account.status.offline')
        : cloud.phase === 'choose'
          ? t('account.status.choose')
          : cloud.phase === 'syncing'
            ? t('account.status.syncing')
            : t('account.status.synced')

  const lastSync = cloud.lastSyncedAt
    ? t('account.lastSync', {
        time: new Date(cloud.lastSyncedAt).toLocaleTimeString(localeOf(language), { hour: '2-digit', minute: '2-digit' })
      })
    : t('account.never')

  return (
    <div>
      <div className="text-[15px] font-medium">{t('account.signedInAs', { email: cloud.user?.email ?? '' })}</div>
      <p
        role="status"
        data-testid="cloud-status"
        className={cn('mt-1 text-[13px]', cloud.phase === 'error' ? 'text-danger' : 'text-muted')}
      >
        {status}
        {cloud.pending > 0 && cloud.phase !== 'choose' && ` ${t('account.pending', { n: cloud.pending })}.`}
      </p>
      <p className="mt-0.5 text-xs text-faint">{lastSync}</p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={busy || cloud.phase === 'choose'}
          onClick={() => {
            setBusy(true)
            void window.api.cloudCommand({ type: 'sync-now' }).finally(() => setBusy(false))
          }}
        >
          <RefreshCw size={14} className={busy || cloud.phase === 'syncing' ? 'animate-spin' : undefined} />
          {t('account.syncNow')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSigningOut(true)}>
          <LogOut size={14} />
          {t('account.signOut')}
        </Button>
      </div>
      <AnimatePresence>{signingOut && <SignOutModal key="signout" onClose={() => setSigningOut(false)} />}</AnimatePresence>
    </div>
  )
}

/** Settings -> Cloud sync: optional account. The app works fully without it. */
export function AccountSection() {
  const t = useT()
  const cloud = useApp((s) => s.cloud)
  if (!cloud) return null

  return (
    <div className="py-4">
      {!cloud.configured ? (
        <>
          <p className="text-[15px]">{t('account.notConfigured')}</p>
          <p className="mt-1 text-[13px] text-muted">{t('account.notConfiguredHint')}</p>
        </>
      ) : cloud.user ? (
        <SignedIn cloud={cloud} />
      ) : (
        <>
          <p className="mb-4 max-w-[60ch] text-[13px] text-muted">{t('account.intro')}</p>
          <SignInForm />
        </>
      )}
    </div>
  )
}
