import { useId } from 'react'
import { cx } from './hooks'

export function InstagramIcon({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <radialGradient id={id} cx="30%" cy="107%" r="150%">
          <stop offset="0" stopColor="#fdf497" />
          <stop offset=".05" stopColor="#fdf497" />
          <stop offset=".45" stopColor="#fd5949" />
          <stop offset=".6" stopColor="#d6249f" />
          <stop offset=".9" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke={`url(#${id})`} strokeWidth="2" />
      <circle cx="12" cy="12" r="4.3" fill="none" stroke={`url(#${id})`} strokeWidth="2" />
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
  const id = useId()
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 64 40" className="h-[1.55em] w-auto" aria-hidden>
        <defs>
          <linearGradient id={`${id}a`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#0B9C7A" />
            <stop offset="1" stopColor="#2BEBB5" />
          </linearGradient>
          <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#14C79A" />
            <stop offset="1" stopColor="#087B62" />
          </linearGradient>
        </defs>
        <path d="M7 31 C 14 23, 20 13, 30 20 S 46 27, 57 8" fill="none" stroke={`url(#${id}a)`} strokeWidth="11" strokeLinecap="round" />
        <path d="M7 31 C 12 26, 17 21, 23 21" fill="none" stroke={`url(#${id}b)`} strokeWidth="11" strokeLinecap="round" opacity=".55" />
      </svg>
      {mark ? (
        <span className="sr-only">MIDFLOW</span>
      ) : (
        <span className="font-display text-[1.25em] leading-none font-extrabold tracking-[-0.02em]">
          <span className={dark ? 'text-white' : 'text-ink'}>MID</span>
          <span className="text-gradient-brand">FLOW</span>
        </span>
      )}
    </span>
  )
}
