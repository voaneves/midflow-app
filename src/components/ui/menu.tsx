import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Dialog } from './overlay'
import { cx, useIsPhone } from './hooks'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

type TriggerProps = {
  ref: React.RefObject<HTMLButtonElement | null>
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
  'aria-controls': string | undefined
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

function MenuList({ id, items, onPick, onClose, labelledBy, sheet }: { id: string; items: MenuItem[]; onPick: (m: MenuItem) => void; onClose: (refocus: boolean) => void; labelledBy?: string; sheet?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus()
  }, [])
  const move = (dir: 1 | -1 | 'first' | 'last') => {
    const list = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
    if (!list.length) return
    const i = list.indexOf(document.activeElement as HTMLElement)
    const next = dir === 'first' ? 0 : dir === 'last' ? list.length - 1 : (i + dir + list.length) % list.length
    list[next].focus()
  }
  return (
    <div
      ref={ref}
      id={id}
      role="menu"
      aria-labelledby={labelledBy}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') (e.preventDefault(), move(1))
        else if (e.key === 'ArrowUp') (e.preventDefault(), move(-1))
        else if (e.key === 'Home') (e.preventDefault(), move('first'))
        else if (e.key === 'End') (e.preventDefault(), move('last'))
        else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onClose(true)
        } else if (e.key === 'Tab') onClose(false)
      }}
      className={cx(sheet ? 'px-2 pb-2' : 'py-1.5')}
    >
      {items.map((m) => (
        <button
          key={m.label}
          type="button"
          role="menuitem"
          tabIndex={-1}
          disabled={m.disabled}
          onClick={() => onPick(m)}
          className={cx(
            'flex w-full items-center gap-3 text-left font-medium outline-none hover:bg-slate-50 focus-visible:bg-brand-50 disabled:opacity-40',
            sheet ? 'min-h-13 rounded-xl px-3 text-base' : 'min-h-11 px-3.5 text-sm',
            m.danger ? 'text-danger' : 'text-slate-800',
          )}
        >
          {m.icon && <span className="grid size-5 shrink-0 place-items-center" aria-hidden>{m.icon}</span>}
          {m.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Menu button (WAI-ARIA APG): aria-haspopup/expanded, arrow keys, Home/End, Esc returns focus,
 * outside click closes, flips to stay inside the viewport. On phones it opens as an action sheet.
 */
export function Menu({ trigger, items, label, align = 'end' }: { trigger: (p: TriggerProps) => ReactNode; items: MenuItem[]; label: string; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const id = useId()
  const phone = useIsPhone()
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null)

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) btn.current?.focus()
  }
  const pick = (m: MenuItem) => {
    setOpen(false)
    btn.current?.focus()
    m.onClick()
  }

  useLayoutEffect(() => {
    if (!open || phone || !btn.current) return
    const place = () => {
      const r = btn.current!.getBoundingClientRect()
      const h = pop.current?.offsetHeight ?? 200
      const w = pop.current?.offsetWidth ?? 224
      const up = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0
      let left = align === 'end' ? r.right - w : r.left
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
      setPos({ top: up ? r.top - h - 6 : r.bottom + 6, left, up })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, phone, align])

  useEffect(() => {
    if (!open || phone) return
    const h = (e: PointerEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [open, phone])

  const triggerProps: TriggerProps = {
    ref: btn,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    onClick: () => setOpen((o) => !o),
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setOpen(true)
      }
    },
  }

  return (
    <>
      {trigger(triggerProps)}
      {open &&
        (phone ? (
          <Dialog open onClose={() => close(true)} title={label}>
            <MenuList id={id} items={items} onPick={pick} onClose={close} sheet />
          </Dialog>
        ) : (
          createPortal(
            <div
              ref={pop}
              aria-label={label}
              style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
              className="fixed z-[70] w-56 overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-fade-in"
            >
              <MenuList id={id} items={items} onPick={pick} onClose={close} />
            </div>,
            document.body,
          )
        ))}
    </>
  )
}

/**
 * Disclosure popover (account, notifications). Esc and outside click close it and focus returns to the
 * trigger. On phones the same content opens as a bottom sheet.
 */
export function Popover({
  trigger,
  title,
  children,
  align = 'end',
  width = 'w-80',
}: {
  trigger: (p: { ref: React.RefObject<HTMLButtonElement | null>; 'aria-expanded': boolean; 'aria-controls'?: string; onClick: () => void }) => ReactNode
  title: string
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const phone = useIsPhone()
  const id = useId()
  const close = () => {
    setOpen(false)
    btn.current?.focus()
  }
  useEffect(() => {
    if (!open || phone) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    panel.current?.querySelector<HTMLElement>('a[href],button:not([disabled])')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, phone])
  return (
    <div className="relative">
      {trigger({ ref: btn, 'aria-expanded': open, 'aria-controls': open ? id : undefined, onClick: () => setOpen((o) => !o) })}
      {open &&
        (phone ? (
          <Dialog open onClose={close} title={title}>
            <div id={id}>{children(close)}</div>
          </Dialog>
        ) : (
          <div
            ref={panel}
            id={id}
            role="region"
            aria-label={title}
            className={cx('absolute z-40 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-pop animate-fade-in', width, align === 'end' ? 'right-0' : 'left-0')}
          >
            {children(close)}
          </div>
        ))}
    </div>
  )
}
