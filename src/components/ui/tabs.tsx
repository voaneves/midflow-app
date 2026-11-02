import { useRef, type ReactNode } from 'react'
import { cx } from './hooks'

export interface TabItem<T extends string> {
  id: T
  label: ReactNode
  icon?: ReactNode
}

const tabId = (base: string, id: string) => `${base}-tab-${id}`
const panelId = (base: string, id: string) => `${base}-panel-${id}`

/**
 * WAI-ARIA tabs with automatic activation: one tab stop, ←/→/Home/End move and select.
 * Pair every tab with a <TabPanel idBase=… id=…>. `scrollable` adds horizontal scroll with edge fades.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  idBase,
  label,
  variant = 'pill',
  scrollable,
  className,
}: {
  value: T
  onChange: (v: T) => void
  items: TabItem<T>[]
  idBase: string
  label: string
  variant?: 'pill' | 'underline' | 'chip'
  scrollable?: boolean
  className?: string
}) {
  const list = useRef<HTMLDivElement>(null)
  const focusTab = (i: number) => {
    const it = items[(i + items.length) % items.length]
    onChange(it.id)
    const el = document.getElementById(tabId(idBase, it.id))
    el?.focus()
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  const cur = items.findIndex((i) => i.id === value)
  return (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          focusTab(cur + 1)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          focusTab(cur - 1)
        } else if (e.key === 'Home') {
          e.preventDefault()
          focusTab(0)
        } else if (e.key === 'End') {
          e.preventDefault()
          focusTab(items.length - 1)
        }
      }}
      className={cx(
        'flex',
        variant === 'pill' && 'gap-1 rounded-xl bg-slate-100 p-1',
        variant === 'underline' && 'gap-1 border-b border-line',
        variant === 'chip' && 'gap-2',
        scrollable && 'no-scrollbar edge-fade -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0',
        className,
      )}
    >
      {items.map((it) => {
        const on = it.id === value
        return (
          <button
            key={it.id}
            id={tabId(idBase, it.id)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId(idBase, it.id)}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(it.id)}
            className={cx(
              'flex shrink-0 items-center justify-center gap-2 text-sm font-semibold whitespace-nowrap transition',
              variant === 'pill' && cx('min-h-10 flex-1 rounded-lg px-3', on ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-ink'),
              variant === 'underline' && cx('-mb-px min-h-11 border-b-2 px-3', on ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-600 hover:text-ink'),
              variant === 'chip' && cx('min-h-10 rounded-full px-4', on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'),
            )}
          >
            {it.icon}
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ idBase, id, active, children, className }: { idBase: string; id: string; active: boolean; children: ReactNode; className?: string }) {
  if (!active) return null
  return (
    <div role="tabpanel" id={panelId(idBase, id)} aria-labelledby={tabId(idBase, id)} tabIndex={0} className={cx('outline-none focus-visible:ring-3 focus-visible:ring-brand-600/25 rounded-xl', className)}>
      {children}
    </div>
  )
}
