import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { X } from 'lucide-react'

export const cn = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ')

type Variant = 'primary' | 'soft' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink font-semibold hover:brightness-110 active:brightness-95',
  soft: 'bg-raised text-ink hover:bg-line',
  ghost: 'text-muted hover:bg-raised hover:text-ink',
  danger: 'text-danger hover:bg-danger/10'
}

const SIZE: Record<Size, string> = {
  sm: 'h-7 gap-1.5 rounded-md px-2.5 text-[13px]',
  md: 'h-9 gap-2 rounded-lg px-3.5 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-[15px]'
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'soft', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-[color,background-color,filter,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-40 disabled:hover:brightness-100 disabled:active:scale-100',
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    />
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'ghost' | 'danger' | 'accent'
}

export function IconButton({ label, tone = 'ghost', className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'inline-grid size-8 shrink-0 place-items-center rounded-lg transition-[color,background-color,transform] duration-150 active:scale-90 disabled:opacity-35',
        tone === 'ghost' && 'text-muted hover:bg-raised hover:text-ink',
        tone === 'danger' && 'text-muted hover:bg-danger/10 hover:text-danger',
        tone === 'accent' && 'bg-accent text-accent-ink hover:brightness-110',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

interface ModalProps {
  title: string
  closeLabel: string
  onClose(): void
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ title, closeLabel, onClose, children, footer }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]')
    first?.focus()
  }, [])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-6"
      style={{ background: 'var(--overlay)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[560px] rounded-2xl border border-line bg-surface"
        style={{ boxShadow: 'var(--shadow)' }}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 4 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <IconButton label={closeLabel} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="px-6 pb-5 pt-4">{children}</div>
        {footer && <div className="flex items-center gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </motion.div>
    </motion.div>,
    document.body
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

/** Like Field, for groups of buttons where a wrapping <label> would be wrong. */
export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-1.5 text-[13px] font-medium text-muted">{label}</div>
      {children}
    </div>
  )
}

/** Input look without a width, for fields that set their own. Combining it with
 * `inputClass` would leave two competing width classes, and CSS order decides. */
export const inputBase =
  'h-9 rounded-lg border border-line bg-bg px-3 text-sm text-ink outline-none transition-colors focus:border-accent'

export const inputClass = `${inputBase} w-full`

interface ToggleProps {
  checked: boolean
  onChange(next: boolean): void
  label: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-accent' : 'bg-line'
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 size-5 rounded-full transition-[transform,background-color] duration-200 ease-[cubic-bezier(.3,1.4,.5,1)]',
          checked ? 'translate-x-5 bg-accent-ink' : 'bg-muted'
        )}
      />
    </button>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: { id: T; label: string }[]
  onChange(next: T): void
  label: string
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  // The selected background slides between options; each control needs its own layout id.
  const indicator = useId()
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-raised p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'relative h-8 rounded-md px-3 text-[13px] font-medium transition-colors duration-150',
            value === o.id ? 'text-ink' : 'text-muted hover:text-ink'
          )}
        >
          {value === o.id && (
            <motion.span
              layoutId={indicator}
              className="absolute inset-0 rounded-md bg-surface shadow-sm"
              transition={{ type: 'spring', stiffness: 520, damping: 40 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/** A selectable pill, used for presets and category choices. */
export function Chip({
  selected,
  onClick,
  children,
  color
}: {
  selected: boolean
  onClick(): void
  children: ReactNode
  color?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.95]',
        selected
          ? 'border-accent bg-accent-soft text-ink'
          : 'border-line text-muted hover:border-faint hover:text-ink'
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  )
}
