import { useEffect, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cx } from './hooks'

const cardBase = 'rounded-2xl border border-line bg-white shadow-card'

/** Pure container. Interactive cards use <CardButton> or <CardLink> (real buttons/links, keyboard-operable). */
export function Card({ className, children, as: Tag = 'div', ...rest }: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'article' | 'aside' }) {
  return (
    <Tag {...rest} className={cx(cardBase, className)}>
      {children}
    </Tag>
  )
}

export function CardButton({ className, children, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} {...rest} className={cx(cardBase, 'block w-full text-left transition hover:border-brand-300 hover:shadow-pop', className)}>
      {children}
    </button>
  )
}

export function CardLink({ className, children, ...rest }: LinkProps) {
  return (
    <Link {...rest} className={cx(cardBase, 'block transition hover:border-brand-300 hover:shadow-pop', className)}>
      {children}
    </Link>
  )
}

/**
 * Sticky bottom action bar on phones/tablets (thumb zone, safe-area aware, above the bottom nav);
 * an inline footer from `lg`. Publishes its height as --action-bar-h so toasts and scroll padding avoid it.
 */
export function ActionBar({ children, hint, className }: { children: ReactNode; hint?: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const set = () => root.style.setProperty('--action-bar-h', `${el.offsetHeight}px`)
    const ro = new ResizeObserver(set)
    ro.observe(el)
    set()
    return () => {
      ro.disconnect()
      root.style.setProperty('--action-bar-h', '0px')
    }
  }, [])
  return (
    <div
      ref={ref}
      data-hide-on-keyboard
      className={cx(
        'fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[calc(0.75rem+var(--safe-bottom))] shadow-[0_-8px_24px_-12px_rgb(11_26_36/0.18)] blur-surface backdrop-blur-md',
        'lg:static lg:z-auto lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none',
        className,
      )}
    >
      {hint && <div className="mb-2 text-center text-caption text-fg-subtle lg:mb-3 lg:text-left">{hint}</div>}
      <div className="flex items-center gap-3 lg:justify-end">{children}</div>
    </div>
  )
}

/** Section heading used inside cards/panels. */
export function SectionHeading({ children, hint, as: Tag = 'h3', id, aside }: { children: ReactNode; hint?: ReactNode; as?: 'h2' | 'h3'; id?: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <Tag id={id} className="text-base font-bold text-ink">
          {children}
        </Tag>
        {hint && <p className="mt-0.5 text-sm text-fg-subtle">{hint}</p>}
      </div>
      {aside}
    </div>
  )
}
