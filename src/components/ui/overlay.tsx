import { X } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './button'
import { cx, useIsPhone } from './hooks'
import { useOverlay } from './useOverlay'

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

  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setExpanded(false)
      setDy(0)
    }
  }

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
