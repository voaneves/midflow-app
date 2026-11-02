import { ChevronLeft, ChevronRight, Copy, Download, FolderPlus, Hash, Pencil, Send, ZoomIn, ZoomOut } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { copyText } from '../../lib/export'
import type { Creative as CreativeT } from '../../lib/types'
import { Button, Dialog, IconButton, toast, useIsPhone } from '../ui'
import { Creative } from './Creative'
import { creativeLabel } from './canvas'
import { exportCreatives, jobFor, type Look } from './helpers'

/**
 * Full-screen viewer on phones (dialog on desktop): swipe or ←/→ between creatives, pinch or the zoom
 * button to zoom, caption below with separate "Copiar legenda" / "Copiar hashtags" actions.
 */
export function CreativeViewer({
  items,
  index,
  onIndex,
  onClose,
  look,
  title,
  onEdit,
  onSave,
  onPublish,
  extraActions,
}: {
  items: CreativeT[]
  index: number | null
  onIndex: (i: number) => void
  onClose: () => void
  look: Look
  title?: string
  onEdit?: (c: CreativeT) => void
  onSave?: (c: CreativeT) => void
  onPublish?: (c: CreativeT) => void
  extraActions?: (c: CreativeT) => ReactNode
}) {
  const open = index !== null && !!items[index]
  const c = open ? items[index!] : null
  const phone = useIsPhone()
  const [zoom, setZoom] = useState(1)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const pinch = useRef<{ d: number; z: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  const [shownIndex, setShownIndex] = useState(index)
  if (shownIndex !== index) {
    setShownIndex(index)
    setZoom(1)
  }

  const go = (d: 1 | -1) => {
    if (index === null) return
    const n = index + d
    if (n >= 0 && n < items.length) onIndex(n)
  }

  if (!c) return null
  const name = creativeLabel(c)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title ?? (c.kind === 'story' ? `Story ${c.order}` : `Post ${c.order}`)}
      description={`${index! + 1} de ${items.length}`}
      size="xl"
      mobile="fullscreen"
      bodyClassName="p-0"
    >
      <div
        className="grid gap-5 p-4 md:grid-cols-[minmax(0,400px)_1fr] md:gap-6 md:p-6"
        onKeyDown={(e) => {
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
          if (e.key === 'ArrowRight') go(1)
          if (e.key === 'ArrowLeft') go(-1)
        }}
      >
        <div className="relative mx-auto w-full max-w-[400px]">
          <div
            className="overflow-auto rounded-2xl shadow-card"
            style={{ touchAction: zoom > 1 ? 'pan-x pan-y' : 'pan-y' }}
            onPointerDown={(e) => {
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
              if (pointers.current.size === 2) {
                const [a, b] = [...pointers.current.values()]
                pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom }
                swipe.current = null
              } else if (zoom === 1) swipe.current = { x: e.clientX, y: e.clientY }
            }}
            onPointerMove={(e) => {
              if (!pointers.current.has(e.pointerId)) return
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
              if (pinch.current && pointers.current.size === 2) {
                const [a, b] = [...pointers.current.values()]
                const z = (pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d
                setZoom(Math.max(1, Math.min(3, z)))
              }
            }}
            onPointerUp={(e) => {
              pointers.current.delete(e.pointerId)
              if (pointers.current.size < 2) pinch.current = null
              const s = swipe.current
              swipe.current = null
              if (!s || zoom > 1) return
              const dx = e.clientX - s.x
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) go(dx < 0 ? 1 : -1)
            }}
            onPointerCancel={(e) => {
              pointers.current.delete(e.pointerId)
              pinch.current = null
              swipe.current = null
            }}
          >
            <div style={{ width: `${zoom * 100}%` }} className="transition-[width] duration-150">
              <Creative key={c.id} c={c} style={look.style} palette={look.palette} format={look.format} brand={look.brand} chrome={false} className="animate-fade-in" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <IconButton variant="secondary" label="Anterior" onClick={() => go(-1)} disabled={index === 0}>
              <ChevronLeft className="size-5" aria-hidden />
            </IconButton>
            <span className="text-sm font-medium text-fg-subtle tabular-nums" aria-hidden>
              {index! + 1} / {items.length}
            </span>
            <div className="flex gap-2">
              <IconButton variant="secondary" label={zoom > 1 ? 'Diminuir zoom' : 'Ampliar imagem'} onClick={() => setZoom(zoom > 1 ? 1 : 2)}>
                {zoom > 1 ? <ZoomOut className="size-5" aria-hidden /> : <ZoomIn className="size-5" aria-hidden />}
              </IconButton>
              <IconButton variant="secondary" label="Próximo" onClick={() => go(1)} disabled={index === items.length - 1}>
                <ChevronRight className="size-5" aria-hidden />
              </IconButton>
            </div>
          </div>
          {phone && <p className="mt-2 text-center text-xs text-fg-subtle">Deslize para os lados para ver os outros · use dois dedos para ampliar</p>}
        </div>

        <div className="min-w-0">
          <h3 className="sr-only">{name}</h3>
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold">Legenda</h4>
            <Button variant="ghost" size="sm" onClick={async () => (await copyText(c.caption)) && toast('Legenda copiada')}>
              <Copy className="size-4" aria-hidden /> Copiar legenda
            </Button>
          </div>
          <p className="mt-1 max-h-64 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm leading-relaxed whitespace-pre-line text-slate-800 scroll-thin">{c.caption}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold">Hashtags</h4>
            <Button variant="ghost" size="sm" onClick={async () => (await copyText(c.hashtags.join(' '))) && toast('Hashtags copiadas')}>
              <Hash className="size-4" aria-hidden /> Copiar hashtags
            </Button>
          </div>
          <p className="mt-1 text-sm font-medium break-words text-brand-800">{c.hashtags.join(' ')}</p>
          {c.cta && (
            <>
              <h4 className="mt-4 text-sm font-bold">Chamada para ação</h4>
              <p className="mt-1 text-sm text-slate-700">{c.cta}</p>
            </>
          )}
          <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {onPublish && (
              <Button className="col-span-2" onClick={() => onPublish(c)}>
                <Send className="size-4" aria-hidden /> Auxiliar postagem
              </Button>
            )}
            {onEdit && (
              <Button variant="secondary" onClick={() => onEdit(c)}>
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
            )}
            <Button variant="secondary" onClick={() => exportCreatives([jobFor(c, look, c.order - 1, c.headline)])}>
              <Download className="size-4" aria-hidden /> Baixar
            </Button>
            {onSave && (
              <Button variant="secondary" onClick={() => onSave(c)}>
                <FolderPlus className="size-4" aria-hidden /> Salvar
              </Button>
            )}
            {extraActions?.(c)}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
