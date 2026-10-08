import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Reveals its content when it scrolls into view. Content that is already on screen when the page
 * loads is never hidden, so the first frame is always complete (thumbnails, slow devices, no JS).
 */
export function Reveal({ children, delay = 0, className, as = 'div', style }: { children: ReactNode; delay?: number; className?: string; as?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLElement>(null)
  const [state, setState] = useState<'idle' | 'hidden' | 'shown'>('idle')
  useEffect(() => {
    const el = ref.current
    if (!el || reduced() || typeof IntersectionObserver === 'undefined') return
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return
    setState('hidden')
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setState('shown')
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return createElement(
    as,
    { ref, className, 'data-reveal': state === 'idle' ? undefined : state, style: { ...style, '--d': `${delay}ms` } as CSSProperties },
    children,
  )
}

/** Counts up to `value` once (used for stats). */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [n, setN] = useState(reduced() ? value : 0)
  useEffect(() => {
    if (reduced()) return setN(value)
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{n}</>
}
