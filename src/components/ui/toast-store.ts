import { create } from 'zustand'

type Tone = 'ok' | 'info' | 'error'
export interface ToastItem {
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
export const useToasts = create<{ items: ToastItem[]; push: (t: string, tone?: Tone, o?: ToastOpts) => number; drop: (id: number) => void }>((set, get) => ({
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
export function arm(id: number, ms: number, drop: (id: number) => void) {
  window.clearTimeout(timers.get(id))
  timers.set(id, window.setTimeout(() => drop(id), ms))
}

/** Success/info toasts auto-dismiss after 5 s (paused on hover/focus); errors stay until dismissed. */
export const toast = (t: string, tone?: Tone, o?: ToastOpts) => useToasts.getState().push(t, tone, o)
export const dismissToast = (id: number) => useToasts.getState().drop(id)

/** Hover/focus on a toast keeps it on screen. */
export const pauseToast = (id: number) => window.clearTimeout(timers.get(id))
