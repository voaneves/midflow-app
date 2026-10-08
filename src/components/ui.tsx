import { clsx } from 'clsx'
import { Check, Loader2, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'

export const cx = clsx

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'soft' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'btn-sheen bg-brand-700 text-white hover:bg-brand-800 shadow-cta disabled:bg-slate-300 disabled:shadow-none',
  secondary: 'bg-white text-ink border border-line hover:border-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-ink',
  dark: 'bg-ink text-white hover:bg-ink-3',
  soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
}
const sizes = { sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-lg', md: 'h-11 px-4 text-sm gap-2 rounded-xl', lg: 'h-13 px-6 text-[15px] gap-2.5 rounded-xl' }

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx('inline-flex shrink-0 items-center justify-center font-semibold transition-all duration-150 active:scale-[.98] disabled:cursor-not-allowed', variants[variant], sizes[size], className)}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ---------- Card ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-white shadow-card', className)}>{children}</div>
}

/* ---------- Form ---------- */
export function Label({ children, required, hint, htmlFor }: { children: ReactNode; required?: boolean; hint?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-baseline gap-1.5 text-sm font-semibold text-ink">
      {children}
      {required && <span className="text-red-500">*</span>}
      {hint && <span className="font-normal text-slate-500">{hint}</span>}
    </label>
  )
}

const fieldBase =
  'w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100'

export function Input({ className, icon, ...rest }: InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400">{icon}</span>}
      <input {...rest} className={cx(fieldBase, 'h-11', icon && 'pl-10', className)} />
    </div>
  )
}

export function Textarea({ className, max, value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { max?: number; value: string }) {
  return (
    <div className="relative">
      <textarea {...rest} value={value} maxLength={max} className={cx(fieldBase, 'min-h-[84px] resize-y py-3 pb-6 leading-relaxed', className)} />
      {max && (
        <span className="pointer-events-none absolute right-3 bottom-2 text-[11px] text-slate-400 tabular-nums">
          {value.length}/{max}
        </span>
      )}
    </div>
  )
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cx(
        fieldBase,
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%236b7a7e%22 stroke-width=%222%22><path d=%22m4 6 4 4 4-4%22/></svg>')] bg-[right_12px_center] bg-no-repeat pr-10",
        className,
      )}
    >
      {children}
    </select>
  )
}

export function Checkbox({ checked, onChange, label, className, id }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string; id?: string }) {
  return (
    <label htmlFor={id} className={cx('inline-flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 select-none', className)}>
      <span
        className={cx(
          'grid size-5 shrink-0 place-items-center rounded-md border transition',
          checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white',
        )}
      >
        {checked && <Check className="size-3.5 animate-pop" strokeWidth={3} />}
      </span>
      <input id={id} type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function CheckBadge({ on }: { on: boolean }) {
  return (
    <span className={cx('grid size-5 place-items-center rounded-md border transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white')}>
      {on && <Check className="size-3.5 animate-pop" strokeWidth={3} />}
    </span>
  )
}

export function Chip({ active, onClick, children, icon, className }: { active?: boolean; onClick?: () => void; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition',
        active ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-line bg-white text-slate-600 hover:border-slate-300',
        className,
      )}
    >
      {active ? <span className="grid size-4 place-items-center rounded-full bg-brand-600 text-white animate-pop"><Check className="size-3" strokeWidth={3} /></span> : icon}
      {children}
    </button>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="inline-flex items-center gap-2.5 text-sm font-semibold text-ink" aria-pressed={on}>
      <span className={cx('relative h-6 w-11 rounded-full transition', on ? 'bg-brand-600' : 'bg-slate-300')}>
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  )
}

/* ---------- Tabs ---------- */
export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode; icon?: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('flex gap-1 rounded-xl bg-slate-100 p-1', className)} role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={cx(
            'flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-semibold whitespace-nowrap transition',
            value === it.id ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-500 hover:text-ink',
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, children, className, title, wide }: { open: boolean; onClose: () => void; children: ReactNode; className?: string; title?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('relative max-h-[94vh] w-full overflow-auto rounded-t-3xl bg-white shadow-pop animate-scale-in scroll-thin sm:rounded-3xl', wide ? 'max-w-5xl' : 'max-w-lg', className)}>
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-white/95 px-6 py-4 backdrop-blur">
            <h3 className="text-lg font-bold">{title}</h3>
            <button onClick={onClose} className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Fechar">
              <X className="size-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

/* ---------- Toasts ---------- */
interface ToastItem {
  id: number
  text: string
  tone: 'ok' | 'info'
}
const useToasts = create<{ items: ToastItem[]; push: (t: string, tone?: 'ok' | 'info') => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (text, tone = 'ok') => {
    const id = Date.now() + Math.random()
    set((s) => ({ items: [...s.items, { id, text, tone }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), 3200)
  },
  drop: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}))
export const toast = (t: string, tone?: 'ok' | 'info') => useToasts.getState().push(t, tone)

export function Toaster() {
  const items = useToasts((s) => s.items)
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-pop animate-rise">
          <span className={cx('grid size-6 place-items-center rounded-full', t.tone === 'ok' ? 'bg-brand-500' : 'bg-slate-600')}>
            <Check className="size-3.5" strokeWidth={3} />
          </span>
          {t.text}
        </div>
      ))}
    </div>
  )
}

/* ---------- Misc ---------- */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800', className)}>{children}</span>
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <radialGradient id="ig" cx="30%" cy="107%" r="150%">
          <stop offset="0" stopColor="#fdf497" />
          <stop offset=".05" stopColor="#fdf497" />
          <stop offset=".45" stopColor="#fd5949" />
          <stop offset=".6" stopColor="#d6249f" />
          <stop offset=".9" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke="url(#ig)" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.3" fill="none" stroke="url(#ig)" strokeWidth="2" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="#d6249f" />
    </svg>
  )
}

export function StoriesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden>
      <path d="M12 2.5a9.5 9.5 0 1 1-8.2 4.7" strokeDasharray="2.5 2.6" />
      <path d="M12 2.5a9.5 9.5 0 0 1 8.2 14.3" />
    </svg>
  )
}

export function Logo({ dark, className, mark = false }: { dark?: boolean; className?: string; mark?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 64 40" className="h-[1.55em] w-auto" aria-hidden>
        <defs>
          <linearGradient id="mf-a" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#0B9C7A" />
            <stop offset="1" stopColor="#2BEBB5" />
          </linearGradient>
          <linearGradient id="mf-b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#14C79A" />
            <stop offset="1" stopColor="#087B62" />
          </linearGradient>
        </defs>
        <path d="M7 31 C 14 23, 20 13, 30 20 S 46 27, 57 8" fill="none" stroke="url(#mf-a)" strokeWidth="11" strokeLinecap="round" />
        <path d="M7 31 C 12 26, 17 21, 23 21" fill="none" stroke="url(#mf-b)" strokeWidth="11" strokeLinecap="round" opacity=".55" />
      </svg>
      {!mark && (
        <span className="font-display text-[1.25em] leading-none font-extrabold tracking-[-0.02em]">
          <span className={dark ? 'text-white' : 'text-ink'}>MID</span>
          <span className="text-gradient-brand">FLOW</span>
        </span>
      )}
    </span>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
