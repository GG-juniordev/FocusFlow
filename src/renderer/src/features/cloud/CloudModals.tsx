import { useState, type ReactNode } from 'react'
import { CloudDownload, CloudUpload, HardDrive, Trash2 } from 'lucide-react'
import type { CloudCommand } from '@shared/types'
import { Button, Modal } from '@/components/ui'
import { useT } from '@/lib/hooks'
import { useApp } from '@/state/useApp'

function Choice({
  icon,
  title,
  hint,
  onClick,
  disabled,
  testId
}: {
  icon: ReactNode
  title: string
  hint: string
  onClick(): void
  disabled: boolean
  testId: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className="flex w-full items-start gap-3 rounded-xl border border-line p-3.5 text-left transition-[border-color,background-color,transform] duration-150 hover:border-accent hover:bg-accent-soft active:scale-[0.99] disabled:opacity-50"
    >
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-raised text-accent-text">{icon}</span>
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>
      </span>
    </button>
  )
}

function useCommand(): { busy: boolean; run(command: CloudCommand): Promise<void> } {
  const [busy, setBusy] = useState(false)
  return {
    busy,
    run: async (command) => {
      setBusy(true)
      try {
        await window.api.cloudCommand(command)
      } finally {
        setBusy(false)
      }
    }
  }
}

/** First sign-in on a PC that already has work on it: transfer it, or take the cloud copy. */
export function MigrationModal() {
  const t = useT()
  const cloud = useApp((s) => s.cloud)
  const { busy, run } = useCommand()
  const cancel = (): void => void run({ type: 'sign-out', keepLocal: true })

  return (
    <Modal
      title={t('migrate.title')}
      closeLabel={t('migrate.cancel')}
      onClose={cancel}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" disabled={busy} onClick={cancel}>
            {t('migrate.cancel')}
          </Button>
        </>
      }
    >
      <p className="text-[15px] text-muted">
        {t('migrate.body', { tasks: cloud?.local.tasks ?? 0, events: cloud?.local.events ?? 0 })}
      </p>
      <div className="mt-4 space-y-2.5">
        <Choice
          testId="migrate-merge"
          icon={<CloudUpload size={18} />}
          title={t('migrate.merge')}
          hint={t('migrate.mergeHint')}
          disabled={busy}
          onClick={() => void run({ type: 'choose', mode: 'merge' })}
        />
        <Choice
          testId="migrate-cloud"
          icon={<CloudDownload size={18} />}
          title={t('migrate.cloud')}
          hint={t('migrate.cloudHint')}
          disabled={busy}
          onClick={() => void run({ type: 'choose', mode: 'cloud' })}
        />
      </div>
    </Modal>
  )
}

/** Signing out: keep working locally with the data, or remove it from this PC. */
export function SignOutModal({ onClose }: { onClose(): void }) {
  const t = useT()
  const pending = useApp((s) => s.cloud?.pending ?? 0)
  const { busy, run } = useCommand()
  const signOut = (keepLocal: boolean): void => void run({ type: 'sign-out', keepLocal }).then(onClose)

  return (
    <Modal
      title={t('signout.title')}
      closeLabel={t('common.cancel')}
      onClose={onClose}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </>
      }
    >
      <p className="text-[15px] text-muted">{t('signout.body')}</p>
      {pending > 0 && <p className="mt-2 text-[13px] text-accent-text">{t('signout.pending', { n: pending })}</p>}
      <div className="mt-4 space-y-2.5">
        <Choice
          testId="signout-keep"
          icon={<HardDrive size={18} />}
          title={t('signout.keep')}
          hint={t('signout.keepHint')}
          disabled={busy}
          onClick={() => signOut(true)}
        />
        <Choice
          testId="signout-clear"
          icon={<Trash2 size={18} />}
          title={t('signout.clear')}
          hint={t('signout.clearHint')}
          disabled={busy}
          onClick={() => signOut(false)}
        />
      </div>
    </Modal>
  )
}
