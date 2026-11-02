import { clsx } from 'clsx'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

export const cx = clsx

/** Live media-query match (SSR-safe, no flash on first render in the browser). */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

/** Below `md` (768 px): bottom sheets, action sheets, full-screen viewers. */
export const useIsPhone = () => !useMediaQuery('(min-width: 768px)')
/** `lg+` (1024 px): sidebar, side-by-side preview, inline action bars. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')

/**
 * Flags `<html data-keyboard="open">` while the on-screen keyboard covers part of the viewport,
 * so the bottom nav and action bar can step aside (they would otherwise cover the focused field).
 */
export function useKeyboardFlag() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const open = window.innerHeight - vv.height > 150 && matchMedia('(max-width: 1023px)').matches
      if (open) document.documentElement.setAttribute('data-keyboard', 'open')
      else document.documentElement.removeAttribute('data-keyboard')
    }
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])
}

/** Long-press (500 ms) on touch/pen/mouse; short taps fall through to onClick. */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<number | undefined>(undefined)
  const fired = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const clear = () => window.clearTimeout(timer.current)
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = window.setTimeout(() => {
        fired.current = true
        navigator.vibrate?.(15)
        onLongPress()
      }, ms)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      if (fired.current) e.preventDefault()
    },
    /** true when the last press became a long-press (swallow the click that follows). */
    consumed: () => {
      const f = fired.current
      fired.current = false
      return f
    },
  }
}

/** Shows "Salvando…" briefly after `deps` change, then "Rascunho salvo". */
export function useSavedIndicator(key: string) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const initial = useRef(key)
  useEffect(() => {
    if (key === initial.current) return
    setState('saving')
    const t = window.setTimeout(() => setState('saved'), 600)
    return () => window.clearTimeout(t)
  }, [key])
  return state
}

/** Persist a small per-viewer preference (sidebar collapsed, remembered tab). Never throws. */
export function usePref<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (next: T) => {
      setV(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* private mode / blocked storage: keep in memory only */
      }
    },
    [key],
  )
  return [v, set] as const
}
