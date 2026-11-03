import { AlertCircle, Check, Info, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cx } from './hooks'
import { arm, pauseToast, useToasts, type ToastItem } from './toast-store'

function ToastCard({ t }: { t: ToastItem }) {
  const drop = useToasts((s) => s.drop)
  const pause = () => pauseToast(t.id)
  const resume = () => t.tone !== 'error' && arm(t.id, 3000, drop)
  return (
    <div
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink py-2 pr-2 pl-3.5 text-sm font-medium text-white shadow-pop animate-rise"
    >
      <span aria-hidden className={cx('grid size-6 shrink-0 place-items-center rounded-full', t.tone === 'ok' ? 'bg-brand-500' : t.tone === 'error' ? 'bg-red-500' : 'bg-slate-600')}>
        {t.tone === 'error' ? <AlertCircle className="size-4" /> : t.tone === 'info' ? <Info className="size-4" /> : <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 py-1.5">{t.text}</span>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            t.action!.onClick()
            drop(t.id)
          }}
          className="h-10 shrink-0 rounded-xl px-3 font-bold text-mint hover:bg-white/10"
        >
          {t.action.label}
        </button>
      )}
      <button type="button" onClick={() => drop(t.id)} className="grid size-10 shrink-0 place-items-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white" aria-label="Dispensar aviso">
        <X className="size-4" />
      </button>
    </div>
  )
}

/**
 * Rendered outside #root so it stays reachable (and announced) while a dialog makes the app inert.
 * Phones: bottom-center above the bottom nav and action bar. Desktop: top-right under the header.
 * While a dialog is open (#root is inert) they move out of the way of its header and action buttons (see .toaster in index.css).
 */
export function Toaster() {
  const items = useToasts((s) => s.items)
  const pos =
    'toaster pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4 bottom-[calc(var(--bottom-nav-h)+var(--action-bar-h)+12px+var(--safe-bottom))] lg:inset-x-auto lg:right-6 lg:bottom-auto lg:top-[calc(var(--header-h)+12px)] lg:items-end lg:px-0'
  return createPortal(
    <div className={pos}>
      <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-2 lg:items-end">
        {items.filter((t) => t.tone !== 'error').map((t) => (
          <ToastCard key={t.id} t={t} />
        ))}
      </div>
      <div role="alert" aria-live="assertive" className="flex w-full flex-col items-center gap-2 lg:items-end">
        {items.filter((t) => t.tone === 'error').map((t) => (
          <ToastCard key={t.id} t={t} />
        ))}
      </div>
    </div>,
    document.body,
  )
}
