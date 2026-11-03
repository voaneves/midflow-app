import type { ReactNode } from 'react'
import { cx } from '../../components/ui'

/** Horizontally scrollable wrapper that stays keyboard reachable (scrollable regions need a tab stop and a name). */
export function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="relative overflow-x-auto rounded-2xl border border-line bg-white focus-visible:ring-3 focus-visible:ring-brand-600/25 focus-visible:outline-none">
      {children}
    </div>
  )
}

export const th = 'whitespace-nowrap px-3 py-2.5 text-left text-xs font-bold tracking-wide text-fg-muted uppercase'
export const td = 'px-3 py-2.5 align-top text-sm text-ink'

export function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'neutral'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        tone === 'ok' && 'bg-emerald-50 text-emerald-900 ring-emerald-300',
        tone === 'warn' && 'bg-warning-soft text-amber-950 ring-amber-300',
        tone === 'bad' && 'bg-danger-soft text-red-900 ring-red-300',
        tone === 'neutral' && 'bg-slate-100 text-slate-800 ring-slate-300',
      )}
    >
      {children}
    </span>
  )
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5', className)}>
      {title && <h3 className="mb-3 text-sm font-bold text-ink">{title}</h3>}
      {children}
    </section>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <dt className="text-xs font-semibold text-fg-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold tracking-tight text-ink tabular-nums">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-fg-subtle">{hint}</dd>}
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'note'}
      className={cx(
        'rounded-xl px-4 py-3 text-sm',
        tone === 'info' && 'bg-brand-50 text-brand-900',
        tone === 'warn' && 'bg-warning-soft text-amber-950',
        tone === 'error' && 'bg-danger-soft font-medium text-red-900',
      )}
    >
      {children}
    </p>
  )
}
