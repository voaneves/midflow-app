import { useId, useLayoutEffect, useRef } from 'react'

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
  useLayoutEffect(() => {
    close.current = onClose
  })
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
