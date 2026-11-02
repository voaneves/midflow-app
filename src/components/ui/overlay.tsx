import { X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './button'
import { cx, useIsPhone } from './hooks'

/* ---------- Shared overlay plumbing ----------
   One stack for every open overlay: only the top one reacts to Esc/Tab. While anything is open the app root
   is `inert` (unreachable by keyboard and screen readers) and the page does not scroll. */
const stack: string[] = []
let locks = 0

function lock() {
  if (locks++ > 0) return
  const sw = window.innerWidth - document.documentElement.clientWidth
  document.body.style.overflow = 'hidden'
  if (sw > 0) document.body.style.paddingRight = `${sw}px`
  document.getElementById('root')?.setAttribute('inert', '')
}
function unlock() {
  if (--locks > 0) return
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
  document.getElementById('root')?.removeAttribute('inert')
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),audio[controls],video[controls]'
export const focusables = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest('[inert]') && el.getClientRects().length > 0)

/**
 * Focus trap + Esc + focus return + scroll lock for an overlay panel.
 * `initial`: element to focus first; otherwise `[data-autofocus]`, otherwise the panel itself.
 */
export function useOverlay(open: boolean, onClose: () => void, panel: React.RefObject<HTMLElement | null>) {
  const id = useId()
  const close = useRef(onClose)
  close.current = onClose
  useLayoutEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    stack.push(id)
    lock()
    const el = panel.current
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el
    first?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id || !panel.current) return
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        close.current()
      } else if (e.key === 'Tab') {
        const list = focusables(panel.current)
        if (!list.length) return e.preventDefault()
        const a = list[0]
        const z = list[list.length - 1]
        const cur = document.activeElement
        if (!panel.current.contains(cur)) {
          e.preventDefault()
          a.focus()
        } else if (e.shiftKey && (cur === a || cur === panel.current)) {
          e.preventDefault()
          z.focus()
        } else if (!e.shiftKey && cur === z) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(id), 1)
      unlock()
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true })
    }
  }, [open, id, panel])
}

/* ---------- Dialog / Sheet ---------- */
export interface DialogProps {
  open: boolean
  onClose: () => void
  /** Visible title (also the accessible name). */
  title?: ReactNode
  /** Accessible name when there is no visible title. */
  label?: string
  description?: ReactNode
  children: ReactNode
  /** Sticky footer (actions). */
  footer?: ReactNode
  /** Desktop width. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Below `md`: a draggable bottom sheet (default) or a full-screen page. */
  mobile?: 'sheet' | 'fullscreen'
  /** Above `md` too: full-screen (story player, mobile-like viewers). */
  fullscreen?: boolean
  tone?: 'light' | 'dark'
  className?: string
  bodyClassName?: string
  /** Extra header content (right side, before the close button). */
  headerAside?: ReactNode
  hideClose?: boolean
  /** Hide the header row entirely (content brings its own). */
  bare?: boolean
}

const widths = { sm: 'md:max-w-md', md: 'md:max-w-lg', lg: 'md:max-w-3xl', xl: 'md:max-w-5xl', full: 'md:max-w-[min(1400px,96vw)]' }

export function Dialog({
  open,
  onClose,
  title,
  label,
  description,
  children,
  footer,
  size = 'md',
  mobile = 'sheet',
  fullscreen,
  tone = 'light',
  className,
  bodyClassName,
  headerAside,
  hideClose,
  bare,
}: DialogProps) {
  const panel = useRef<HTMLDivElement>(null)
  const phone = useIsPhone()
  const titleId = useId()
  const descId = useId()
  useOverlay(open, onClose, panel)

  const isSheet = phone && mobile === 'sheet' && !fullscreen
  const isFull = fullscreen || (phone && mobile === 'fullscreen')
  const [expanded, setExpanded] = useState(false)
  const drag = useRef<{ y: number; t: number } | null>(null)
  const [dy, setDy] = useState(0)

  useEffect(() => {
    if (!open) {
      setExpanded(false)
      setDy(0)
    }
  }, [open])

  if (!open) return null

  // Swipe down on the handle/header closes the sheet; swipe up expands it to the full height snap point.
  const dragProps = isSheet
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          if ((e.target as HTMLElement).closest('button,a,input,select,textarea')) return
          drag.current = { y: e.clientY, t: performance.now() }
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        },
        onPointerMove: (e: React.PointerEvent) => {
          if (drag.current) setDy(e.clientY - drag.current.y)
        },
        onPointerUp: () => {
          if (!drag.current) return
          const v = dy / Math.max(1, performance.now() - drag.current.t)
          drag.current = null
          if (dy > 110 || v > 0.6) onClose()
          else if (dy < -60) setExpanded(true)
          setDy(0)
        },
        onPointerCancel: () => {
          drag.current = null
          setDy(0)
        },
      }
    : {}

  const dark = tone === 'dark'
  return createPortal(
    <div className={cx('fixed inset-0 z-50 flex', isFull ? '' : isSheet ? 'items-end' : 'items-center justify-center p-6')}>
      <div className="absolute inset-0 bg-ink/55 animate-fade-in" aria-hidden onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        style={dy > 0 ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}
        className={cx(
          'relative flex w-full flex-col outline-none',
          dark ? 'bg-ink text-white' : 'bg-white text-ink',
          isFull
            ? 'h-dvh max-h-dvh animate-fade-in'
            : isSheet
              ? cx('rounded-t-3xl shadow-pop animate-sheet-up transition-[max-height] duration-300', expanded ? 'h-[94dvh] max-h-[94dvh]' : 'max-h-[88dvh]')
              : cx('max-h-[90dvh] rounded-3xl shadow-pop animate-scale-in', widths[size]),
          className,
        )}
      >
        {isSheet && (
          <div {...dragProps} className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1" aria-hidden>
            <span className={cx('h-1.5 w-10 rounded-full', dark ? 'bg-white/30' : 'bg-slate-300')} />
          </div>
        )}
        {!bare && (title || !hideClose) && (
          <div
            {...dragProps}
            className={cx(
              'flex shrink-0 items-center gap-3 px-5',
              isSheet ? 'pt-1 pb-3' : 'border-b py-3.5 md:px-6',
              isFull && 'pt-[max(0.875rem,var(--safe-top))]',
              dark ? 'border-white/10' : 'border-line',
              isSheet && 'touch-none',
            )}
          >
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="truncate text-title-sm font-bold">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className={cx('text-sm', dark ? 'text-white/70' : 'text-fg-subtle')}>
                  {description}
                </p>
              )}
            </div>
            {headerAside}
            {!hideClose && (
              <IconButton label="Fechar" onClick={onClose} variant={dark ? 'glass' : 'ghost'} className="-mr-2">
                <X className="size-5" />
              </IconButton>
            )}
          </div>
        )}
        <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-thin', bodyClassName)}>{children}</div>
        {footer && (
          <div
            className={cx(
              'shrink-0 border-t px-5 py-3 md:px-6',
              (isSheet || isFull) && 'pb-[calc(0.75rem+var(--safe-bottom))]',
              dark ? 'border-white/10' : 'border-line bg-white',
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Backwards-compatible wrapper: `wide` → xl. New code should use <Dialog>. */
export function Modal({ open, onClose, children, className, title, wide, label, footer }: { open: boolean; onClose: () => void; children: ReactNode; className?: string; title?: ReactNode; wide?: boolean; label?: string; footer?: ReactNode }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} label={label} size={wide ? 'xl' : 'md'} className={className} footer={footer}>
      {children}
    </Dialog>
  )
}

/** Confirmation dialog with a clear primary/destructive action. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  danger,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-slate-50" data-autofocus>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cx('h-11 rounded-xl px-4 text-sm font-semibold text-white', danger ? 'bg-danger hover:bg-red-800' : 'bg-brand-700 hover:bg-brand-800')}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="px-5 py-4 text-sm text-slate-700 md:px-6">{children}</div>
    </Dialog>
  )
}
