import { Bookmark, ChevronLeft, Copy, Download, Heart, Loader2, MessageCircle, MoreHorizontal, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isHex, normalizeHex } from '../../lib/color'
import { copyText, dataUrlToBlob, makeZip, renderPng, saveFile, slug, type ExportJob } from '../../lib/export'
import { currentLook, useApp } from '../../lib/store'
import type { Creative as CreativeT, Palette, PostFormat, StyleId } from '../../lib/types'
import { Button, CheckBadge, cx, Modal, toast } from '../ui'
import { Creative, type BrandMark } from './Creative'

/* ---------- shared look ---------- */
export function useLook() {
  const style = useApp((s) => s.style)
  const briefing = useApp((s) => s.briefing)
  const brand = useApp((s) => s.brand)
  const { palette, style: st } = currentLook({ style, briefing })
  const mark: BrandMark = { name: brand.name, handle: brand.handle, logo: style.logo ?? brand.logo }
  return { palette, style: st, format: style.postFormat, brand: mark }
}

/* ---------- Instagram phone ---------- */
export function PhoneMockup({ c, style, palette, format, brand, mode, city, className }: { c?: CreativeT; style: StyleId; palette: Palette; format: PostFormat; brand: BrandMark; mode: 'feed' | 'story'; city?: string; className?: string }) {
  return (
    <div className={cx('mx-auto w-full max-w-[290px] rounded-[44px] bg-ink p-[9px] shadow-pop', className)}>
      <div className="relative overflow-hidden rounded-[36px] bg-white">
        <div className="absolute top-2 left-1/2 z-20 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-ink" />
        {mode === 'story' && c ? (
          <div className="relative bg-black">
            <Creative c={{ ...c, kind: 'story' }} style={style} palette={palette} format={format} brand={brand} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 pt-3 text-[11px] font-semibold">
              <span>9:41</span>
              <span className="tracking-tight">▮▮▮ ◔</span>
            </div>
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <ChevronLeft className="size-5" />
              <span className="font-serif text-[19px] italic">Instagram</span>
              <Send className="size-[18px]" />
            </div>
            <div className="flex items-center gap-2 px-3 pb-2">
              <div className="grid size-7 place-items-center overflow-hidden rounded-full bg-gradient-to-tr from-amber-300 via-pink-500 to-violet-600 p-[2px]">
                <div className="grid size-full place-items-center overflow-hidden rounded-full bg-white text-[10px] font-bold">
                  {brand.logo ? <img src={brand.logo} alt="" className="size-[80%] object-contain" /> : brand.name.slice(0, 1)}
                </div>
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[11px] font-semibold">{brand.handle}</div>
                {city && <div className="truncate text-[10px] text-slate-500">{city}</div>}
              </div>
              <MoreHorizontal className="size-4" />
            </div>
            {c ? <Creative c={c} style={style} palette={palette} format={format} brand={brand} /> : <div className="aspect-[4/5] skeleton" />}
            <div className="flex items-center gap-3 px-3 pt-2.5">
              <Heart className="size-5 fill-red-500 text-red-500" />
              <MessageCircle className="size-5" />
              <Send className="size-5" />
              <span className="mx-auto flex gap-1">
                <i className="size-1.5 rounded-full bg-brand-500" />
                <i className="size-1.5 rounded-full bg-slate-300" />
                <i className="size-1.5 rounded-full bg-slate-300" />
              </span>
              <Bookmark className="size-5" />
            </div>
            <div className="px-3 pt-1.5 pb-4 text-[11px] leading-snug">
              <div className="font-semibold">102 curtidas</div>
              <p className="line-clamp-2">
                <b className="font-semibold">{brand.handle}</b> {c?.caption.split('\n')[0]} <span className="text-slate-400">… mais</span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- Result card (Step 4 / library) ---------- */
export function CreativeTile({
  c, n, selected, onSelect, onOpen, onEdit, onDownload, menu, look, compact, index = 0,
}: {
  c: CreativeT
  n?: number
  selected?: boolean
  onSelect?: () => void
  onOpen?: () => void
  onEdit?: () => void
  onDownload?: () => void
  menu?: { label: string; icon: ReactNode; onClick: () => void; danger?: boolean }[]
  look: { palette: Palette; style: StyleId; format: PostFormat; brand: BrandMark }
  compact?: boolean
  /** position in a list, used to stagger the entrance animation */
  index?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="group flex min-w-0 animate-rise flex-col gap-2" style={{ animationDelay: `${Math.min(index, 11) * 70}ms` }}>
      <div
        className={cx(
          'relative overflow-hidden rounded-xl ring-2 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-pop',
          selected ? 'ring-brand-500 ring-offset-2' : 'ring-transparent hover:ring-slate-200',
        )}
      >
        <button type="button" className="block w-full cursor-zoom-in text-left" onClick={onOpen} aria-label="Abrir em tamanho maior">
          <Creative c={c} style={look.style} palette={look.palette} format={look.format} brand={look.brand} />
        </button>
        {n !== undefined && (
          <span className="absolute top-2.5 left-2.5 grid size-7 place-items-center rounded-full bg-white text-[13px] font-bold text-ink shadow">{n}</span>
        )}
        {onSelect && (
          <button type="button" onClick={onSelect} className="absolute top-2.5 right-2.5 rounded-md bg-white/90 p-0.5 shadow" aria-label={selected ? 'Desmarcar' : 'Selecionar'}>
            <CheckBadge on={!!selected} />
          </button>
        )}
      </div>
      {(onEdit || onDownload || menu) && (
        <div className={cx('flex gap-1.5', compact && 'gap-1')}>
          {onEdit && (
            <button onClick={onEdit} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Pencil className="size-3.5" /> {!compact && 'Editar'}
            </button>
          )}
          {onDownload && (
            <button onClick={onDownload} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Download className="size-3.5" /> {!compact && 'Baixar'}
            </button>
          )}
          {menu && (
            <div className="relative" ref={ref}>
              <button onClick={() => setOpen((o) => !o)} className="grid h-8 w-9 place-items-center rounded-lg border border-line bg-white text-slate-600 hover:bg-slate-50" aria-label="Mais opções">
                <MoreHorizontal className="size-4" />
              </button>
              {open && (
                <div className="absolute right-0 bottom-10 z-20 w-48 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-pop animate-fade-in">
                  {menu.map((m) => (
                    <button
                      key={m.label}
                      onClick={() => {
                        setOpen(false)
                        m.onClick()
                      }}
                      className={cx('flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-slate-50', m.danger ? 'text-red-600' : 'text-slate-700')}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const tileMenu = (o: { caption: string; onDuplicate?: () => void; onDelete?: () => void }) =>
  [
    { label: 'Copiar legenda', icon: <Copy className="size-4" />, onClick: async () => (await copyText(o.caption)) && toast('Legenda copiada') },
    o.onDuplicate && { label: 'Duplicar', icon: <Plus className="size-4" />, onClick: o.onDuplicate },
    o.onDelete && { label: 'Remover', icon: <Trash2 className="size-4" />, onClick: o.onDelete, danger: true },
  ].filter(Boolean) as { label: string; icon: ReactNode; onClick: () => void; danger?: boolean }[]

/* ---------- Export (PNG / ZIP) ---------- */
interface ExportState {
  open: boolean
  jobs: ExportJob[]
}
let openExport: (jobs: ExportJob[]) => void = () => {}
export const exportCreatives = (jobs: ExportJob[]) => openExport(jobs)

export function ExportHost() {
  const [st, setSt] = useState<ExportState>({ open: false, jobs: [] })
  const [files, setFiles] = useState<{ name: string; dataUrl: string }[]>([])
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    openExport = (jobs) => setSt({ open: true, jobs })
  }, [])
  useEffect(() => {
    if (!st.open) return
    let alive = true
    setFiles([])
    setZipBlob(null)
    setBusy(true)
    ;(async () => {
      const out: { name: string; dataUrl: string }[] = []
      for (const j of st.jobs) {
        try {
          out.push({ name: j.name, dataUrl: await renderPng(j) })
        } catch (e) {
          console.error(e)
        }
        if (!alive) return
        setFiles([...out])
      }
      if (out.length > 1) setZipBlob(await makeZip(out))
      if (alive) setBusy(false)
    })()
    return () => {
      alive = false
    }
  }, [st])
  const close = () => setSt({ open: false, jobs: [] })
  const save = async (name: string, blob: Blob) => {
    const r = await saveFile(name, blob)
    if (r === 'saved') toast('Download iniciado')
    else if (r === 'failed') toast('Não foi possível baixar aqui. Clique com o botão direito na imagem e salve.', 'info')
  }
  const many = st.jobs.length > 1
  return (
    <Modal open={st.open} onClose={close} title={many ? `Baixar ${st.jobs.length} arquivos` : 'Baixar criativo'} wide={many}>
      <div className="p-6">
        <div className={cx('grid gap-3', many ? 'grid-cols-2 sm:grid-cols-4' : 'mx-auto max-w-[300px]')}>
          {st.jobs.map((j, i) => (
            <div key={j.name} className="overflow-hidden rounded-xl border border-line bg-slate-50">
              {files[i] ? (
                <img src={files[i].dataUrl} alt={j.name} className="block w-full" />
              ) : (
                <div className={cx('grid place-items-center skeleton', j.creative.kind === 'story' ? 'aspect-[9/16]' : j.format === '1:1' ? 'aspect-square' : 'aspect-[4/5]')}>
                  <Loader2 className="size-5 animate-spin text-slate-400" />
                </div>
              )}
              <div className="truncate px-2 py-1.5 text-[11px] text-slate-500">{j.name}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">PNG em alta resolução (1080 px). Se o download não começar, clique com o botão direito na imagem e escolha “Salvar imagem”.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={close}>
            <X className="size-4" /> Fechar
          </Button>
          {many ? (
            <Button loading={busy} disabled={!zipBlob} onClick={() => zipBlob && save('midflow-criativos.zip', zipBlob)}>
              <Download className="size-4" /> {busy ? 'Preparando…' : 'Baixar .zip'}
            </Button>
          ) : (
            <Button loading={busy} disabled={!files[0]} onClick={() => files[0] && save(files[0].name, dataUrlToBlob(files[0].dataUrl))}>
              <Download className="size-4" /> {busy ? 'Gerando PNG…' : 'Baixar PNG'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export function jobFor(c: CreativeT, look: { palette: Palette; style: StyleId; format: PostFormat; brand: BrandMark }, i: number, theme: string): ExportJob {
  const kind = c.kind === 'story' ? 'story' : 'post'
  return { creative: c, ...look, name: `${String(i + 1).padStart(2, '0')}-${kind}-${slug(theme || c.headline)}.png` }
}

/* ---------- Color swatches with HEX editing (≤5) ---------- */
export function ColorSwatches({ colors, onChange, max = 5, size = 'md' }: { colors: string[]; onChange: (c: string[]) => void; max?: number; size?: 'sm' | 'md' }) {
  const [edit, setEdit] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const box = size === 'sm' ? 'size-10' : 'size-12'
  const commit = (i: number) => {
    if (isHex(draft)) {
      const next = [...colors]
      next[i] = normalizeHex(draft)
      onChange(next)
    }
    setEdit(null)
  }
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {colors.map((c, i) => (
        <div key={i} className="relative">
          <button
            type="button"
            onClick={() => {
              setEdit(i)
              setDraft(c)
            }}
            className={cx(box, 'rounded-xl border border-black/10 shadow-sm transition hover:scale-105')}
            style={{ background: c }}
            aria-label={`Cor ${i + 1}: ${c}`}
          />
          {edit === i && (
            <div className="absolute top-full left-0 z-30 mt-2 w-56 rounded-xl border border-line bg-white p-3 shadow-pop animate-fade-in">
              <div className="flex items-center gap-2">
                <input type="color" value={isHex(draft) ? normalizeHex(draft) : c} onChange={(e) => setDraft(e.target.value.toUpperCase())} className="size-9 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Escolher cor" />
                <input
                  id={`hex-${i}`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commit(i)}
                  className="h-9 w-full rounded-lg border border-line px-2 font-mono text-sm uppercase focus:border-brand-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="mt-2.5 flex justify-between">
                <button
                  className="text-xs font-semibold text-red-600 disabled:opacity-40"
                  disabled={colors.length <= 1}
                  onClick={() => {
                    onChange(colors.filter((_, k) => k !== i))
                    setEdit(null)
                  }}
                >
                  Remover
                </button>
                <button className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => commit(i)}>
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {colors.length < max && (
        <button
          type="button"
          onClick={() => {
            onChange([...colors, '#CCCCCC'])
            setEdit(colors.length)
            setDraft('#CCCCCC')
          }}
          className={cx(box, 'grid place-items-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-500 hover:border-brand-400 hover:text-brand-700')}
          aria-label="Adicionar cor"
        >
          <Plus className="size-5" />
        </button>
      )}
    </div>
  )
}

/* ---------- File → data URL ---------- */
export function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}
