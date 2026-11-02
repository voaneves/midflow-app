import { AlertCircle, Check, Info, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { cx } from './hooks'

type Tone = 'ok' | 'info' | 'error'
interface ToastItem {
  id: number
  text: string
  tone: Tone
  action?: { label: string; onClick: () => void }
}
interface ToastOpts {
  action?: { label: string; onClick: () => void }
  /** ms; errors never auto-dismiss */
  duration?: number
}

const timers = new Map<number, number>()
const useToasts = create<{ items: ToastItem[]; push: (t: string, tone?: Tone, o?: ToastOpts) => number; drop: (id: number) => void }>((set, get) => ({
  items: [],
  push: (text, tone = 'ok', o = {}) => {
    const id = Date.now() + Math.random()
    // keep at most 3 on screen
    set((s) => ({ items: [...s.items.slice(-2), { id, text, tone, action: o.action }] }))
    if (tone !== 'error') arm(id, o.duration ?? (o.action ? 7000 : 5000), get().drop)
    return id
  },
  drop: (id) => {
    window.clearTimeout(timers.get(id))
    timers.delete(id)
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
  },
}))
function arm(id: number, ms: number, drop: (id: number) => void) {
  window.clearTimeout(timers.get(id))
  timers.set(id, window.setTimeout(() => drop(id), ms))
}

/** Success/info toasts auto-dismiss after 5 s (paused on hover/focus); errors stay until dismissed. */
export const toast = (t: string, tone?: Tone, o?: ToastOpts) => useToasts.getState().push(t, tone, o)
export const dismissToast = (id: number) => useToasts.getState().drop(id)

function ToastCard({ t }: { t: ToastItem }) {
  const drop = useToasts((s) => s.drop)
  const pause = () => window.clearTimeout(timers.get(t.id))
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
 */
export function Toaster() {
  const items = useToasts((s) => s.items)
  const pos =
    'pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4 bottom-[calc(var(--bottom-nav-h)+var(--action-bar-h)+12px+var(--safe-bottom))] lg:inset-x-auto lg:right-6 lg:bottom-auto lg:top-[calc(var(--header-h)+12px)] lg:items-end lg:px-0'
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
