import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Creative as CreativeT } from '../../lib/types'
import { Dialog, IconButton, useReducedMotion } from '../ui'
import { Creative } from './Creative'
import { creativeLabel } from './canvas'
import type { Look } from './helpers'

const DURATION = 5000

/**
 * Instagram-like sequence player: segmented progress, tap left/right zones, press-and-hold to pause,
 * swipe down to close. Buttons cover every gesture (keyboard: ←/→, space). With reduced motion the
 * sequence never auto-advances.
 */
export function StoryPlayer({ open, onClose, stories, look }: { open: boolean; onClose: () => void; stories: CreativeT[]; look: Look }) {
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(!reduced)
  const [held, setHeld] = useState(false)
  const hold = useRef<number | undefined>(undefined)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      setI(0)
      setPlaying(!reduced)
    }
  }

  const next = () => (i + 1 < stories.length ? setI(i + 1) : setPlaying(false))
  const prev = () => setI(Math.max(0, i - 1))
  const running = playing && !held && !reduced

  if (!stories.length) return null
  const c = stories[i]
  return (
    <Dialog open={open} onClose={onClose} label="Reproduzir sequência de Stories" fullscreen tone="dark" bare bodyClassName="flex items-center justify-center">
      <div
        className="relative mx-auto flex h-full w-full max-w-[min(100%,calc((100dvh-120px)*9/16))] flex-col justify-center px-2 py-3"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            next()
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            prev()
          } else if (e.key === ' ') {
            e.preventDefault()
            setPlaying((p) => !p)
          }
        }}
      >
        {/* progress segments */}
        <div className="mb-2 flex gap-1 px-1" aria-hidden>
          {stories.map((s, k) => (
            <span key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                key={k === i ? `${s.id}-${i}` : s.id}
                className="block h-full origin-left bg-white"
                onAnimationEnd={k === i ? next : undefined}
                style={
                  k < i
                    ? { transform: 'scaleX(1)' }
                    : k === i
                      ? reduced
                        ? { transform: 'scaleX(1)', opacity: 0.6 }
                        : { animation: `story-progress ${DURATION}ms linear both`, animationPlayState: running ? 'running' : 'paused' }
                      : { transform: 'scaleX(0)' }
                }
              />
            </span>
          ))}
        </div>

        <div
          className="relative overflow-hidden rounded-2xl select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            swipe.current = { x: e.clientX, y: e.clientY }
            hold.current = window.setTimeout(() => setHeld(true), 220)
          }}
          onPointerUp={(e) => {
            window.clearTimeout(hold.current)
            const s = swipe.current
            swipe.current = null
            const wasHeld = held
            setHeld(false)
            if (!s) return
            const dy = e.clientY - s.y
            const dx = e.clientX - s.x
            if (dy > 90 && Math.abs(dy) > Math.abs(dx)) return onClose()
            if (wasHeld || Math.abs(dx) > 10 || Math.abs(dy) > 10) return
            const r = e.currentTarget.getBoundingClientRect()
            if (e.clientX - r.left < r.width * 0.33) prev()
            else next()
          }}
          onPointerCancel={() => {
            window.clearTimeout(hold.current)
            setHeld(false)
            swipe.current = null
          }}
        >
          <Creative key={c.id} c={c} style={look.style} palette={look.palette} format={look.format} brand={look.brand} className="animate-fade-in" />
        </div>
        <p className="sr-only" aria-live="polite">
          Story {i + 1} de {stories.length}: {creativeLabel(c)}
        </p>

        <div className="mt-3 flex items-center justify-between text-white">
          <IconButton variant="glass" label="Story anterior" onClick={prev} disabled={i === 0}>
            <ChevronLeft className="size-5" aria-hidden />
          </IconButton>
          <div className="flex items-center gap-3">
            <IconButton variant="glass" label={running ? 'Pausar' : 'Reproduzir'} onClick={() => setPlaying((p) => !p)} disabled={reduced} data-autofocus>
              {running ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
            </IconButton>
            <span className="text-sm tabular-nums" aria-hidden>
              {i + 1} / {stories.length}
            </span>
          </div>
          <div className="flex gap-2">
            <IconButton variant="glass" label="Próximo story" onClick={next} disabled={i === stories.length - 1}>
              <ChevronRight className="size-5" aria-hidden />
            </IconButton>
            <IconButton variant="glass" label="Fechar" onClick={onClose}>
              <X className="size-5" aria-hidden />
            </IconButton>
          </div>
        </div>
        {reduced && <p className="mt-2 text-center text-xs text-white/80">Avanço automático desligado (movimento reduzido). Use as setas.</p>}
      </div>
    </Dialog>
  )
}
