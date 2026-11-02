import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './button'
import { cx } from './hooks'

/** Placeholder sized like the final content (no layout shift). Decorative for assistive tech. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('skeleton rounded-xl', className)} />
}

export function Spinner({ label = 'Carregando', className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cx('inline-flex items-center gap-2', className)}>
      <Loader2 className="size-5 animate-spin text-brand-700 motion-reduce:animate-none" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** Determinate when `value` (0–100) is given, otherwise indeterminate. */
export function ProgressBar({ value, label, className, tone = 'brand' }: { value?: number; label: string; className?: string; tone?: 'brand' | 'light' }) {
  const indeterminate = value === undefined
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
      className={cx('relative h-2 overflow-hidden rounded-full', tone === 'brand' ? 'bg-slate-100' : 'bg-white/15', className)}
    >
      {indeterminate ? (
        <div className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-gradient-to-r from-brand-500 to-mint animate-indeterminate motion-reduce:w-1/2 motion-reduce:animate-none" />
      ) : (
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-mint transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      )}
    </div>
  )
}

/** Meter for plan usage (aria-valuetext in pt-BR). */
export function UsageMeter({ used, total, label, tone = 'light' }: { used: number; total: number; label: string; tone?: 'light' | 'dark' }) {
  const pct = Math.min(100, (used / Math.max(1, total)) * 100)
  return (
    <div>
      <div className={cx('flex justify-between text-caption', tone === 'dark' ? 'text-slate-300' : 'text-fg-subtle')}>
        <span>{label}</span>
        <b className={cx('tabular-nums', tone === 'dark' ? 'text-white' : 'text-ink')}>
          {used}/{total}
        </b>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(used, total)}
        aria-valuetext={`${used} de ${total} conteúdos usados`}
        className={cx('mt-1.5 h-2 overflow-hidden rounded-full', tone === 'dark' ? 'bg-white/10' : 'bg-slate-100')}
      >
        <div className={cx('h-full rounded-full bg-gradient-to-r from-brand-500 to-mint', pct >= 90 && 'from-amber-500 to-amber-400')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, text, action, className }: { icon: ReactNode; title: string; text: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center', className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700" aria-hidden>
        {icon}
      </div>
      <h2 className="text-title-sm font-bold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-fg-subtle">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
/** @deprecated use EmptyState */
export const Empty = EmptyState

export function ErrorState({
  title = 'Algo deu errado',
  text,
  onRetry,
  retryLabel = 'Tentar novamente',
  secondary,
  className,
}: {
  title?: string
  text: ReactNode
  onRetry?: () => void
  retryLabel?: string
  secondary?: ReactNode
  className?: string
}) {
  return (
    <div role="alert" className={cx('flex flex-col items-center rounded-2xl border border-red-200 bg-white px-6 py-10 text-center', className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger" aria-hidden>
        <AlertTriangle className="size-6" />
      </div>
      <h2 className="text-title-sm font-bold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-fg-muted">{text}</p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {onRetry && (
          <Button onClick={onRetry}>
            <RotateCcw className="size-4" aria-hidden /> {retryLabel}
          </Button>
        )}
        {secondary}
      </div>
    </div>
  )
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800', className)}>{children}</span>
}
