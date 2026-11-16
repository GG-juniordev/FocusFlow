import { AnimatePresence, motion } from 'motion/react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { create } from 'zustand'
import { useT } from '@/lib/hooks'
import { cn } from './ui'

interface Toast {
  id: number
  kind: 'success' | 'error'
  text: string
}

interface ToastStore {
  toasts: Toast[]
  show(kind: Toast['kind'], text: string): void
  dismiss(id: number): void
}

let nextId = 1

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (kind, text) => {
    const id = nextId++
    // One message at a time is enough here; a new one replaces the old.
    set({ toasts: [{ id, kind, text }] })
    // Errors stay longer: they usually need reading twice.
    setTimeout(() => get().dismiss(id), kind === 'error' ? 8000 : 3500)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}))

/** Brief confirmations and error reports, bottom centre, above everything else. */
export function Toaster() {
  const t = useT()
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 px-6">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            data-testid="toast"
            data-kind={toast.kind}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              'pointer-events-auto flex max-w-[520px] items-start gap-2.5 rounded-xl border bg-surface py-2.5 pl-3.5 pr-2 text-[13.5px]',
              toast.kind === 'error' ? 'border-danger/60' : 'border-line'
            )}
            style={{ boxShadow: 'var(--shadow)' }}
          >
            {toast.kind === 'error' ? (
              <CircleAlert size={17} className="mt-0.5 shrink-0 text-danger" />
            ) : (
              <CircleCheck size={17} className="mt-0.5 shrink-0 text-accent-text" />
            )}
            <span className="min-w-0 flex-1 break-words leading-snug">{toast.text}</span>
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={() => dismiss(toast.id)}
              className="grid size-6 shrink-0 place-items-center rounded-md text-faint hover:bg-raised hover:text-ink"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
