import { Bookmark, Check, ChevronLeft, Download, Heart, Loader2, MessageCircle, MoreHorizontal, Pencil, Plus, Send, Share2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isHex, normalizeHex } from '../../lib/color'
import { dataUrlToBlob, makeZip, renderPng, saveFile, type ExportJob } from '../../lib/export'
import type { Creative as CreativeT, Palette, PostFormat, StyleId } from '../../lib/types'
import { Button, CheckBadge, cx, Dialog, IconButton, Menu, toast, useIsPhone, useLongPress, type MenuItem } from '../ui'
import { creativeLabel } from './canvas'
import { Creative, type BrandMark } from './Creative'
import { setExportOpener, type Look } from './helpers'

/* ---------- Instagram phone (desktop preview only; on a real phone the full-screen viewer replaces it) ---------- */
export function PhoneMockup({ c, style, palette, format, brand, mode, city, className }: { c?: CreativeT; style: StyleId; palette: Palette; format: PostFormat; brand: BrandMark; mode: 'feed' | 'story'; city?: string; className?: string }) {
  return (
    <div className={cx('mx-auto w-full max-w-[290px] rounded-[44px] bg-ink p-[9px] shadow-pop', className)} role="group" aria-label={`Prévia no Instagram (${mode === 'story' ? 'Stories' : 'Feed'})`}>
      <div className="relative overflow-hidden rounded-[36px] bg-white">
        <div className="absolute top-2 left-1/2 z-20 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-ink" aria-hidden />
        {mode === 'story' && c ? (
          <div className="relative bg-black">
            <Creative c={{ ...c, kind: 'story' }} style={style} palette={palette} format={format} brand={brand} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 pt-3 text-xs font-semibold" aria-hidden>
              <span>9:41</span>
              <span className="tracking-tight">▮▮▮ ◔</span>
            </div>
            <div className="flex items-center justify-between px-3 pt-3 pb-2" aria-hidden>
              <ChevronLeft className="size-5" />
              <span className="font-serif text-[19px] italic">Instagram</span>
              <Send className="size-[18px]" />
            </div>
            <div className="flex items-center gap-2 px-3 pb-2">
              <div className="grid size-7 place-items-center overflow-hidden rounded-full bg-gradient-to-tr from-amber-300 via-pink-500 to-violet-600 p-[2px]" aria-hidden>
                <div className="grid size-full place-items-center overflow-hidden rounded-full bg-white text-xs font-bold">
                  {brand.logo ? <img src={brand.logo} alt="" className="size-[80%] object-contain" /> : brand.name.slice(0, 1)}
                </div>
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-xs font-semibold">{brand.handle}</div>
                {city && <div className="truncate text-xs text-slate-600">{city}</div>}
              </div>
              <MoreHorizontal className="size-4" aria-hidden />
            </div>
            {c ? <Creative c={c} style={style} palette={palette} format={format} brand={brand} /> : <div className="aspect-[4/5] skeleton" />}
            <div className="flex items-center gap-3 px-3 pt-2.5" aria-hidden>
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
            <div className="px-3 pt-1.5 pb-4 text-xs leading-snug">
              <div className="font-semibold">102 curtidas</div>
              <p className="line-clamp-2">
                <b className="font-semibold">{brand.handle}</b> {c?.caption.split('\n')[0]} <span className="text-slate-600">… mais</span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- Result card (Step 4 / library) ----------
   Tap opens the viewer; long-press (or the check button, or "Selecionar") enters selection mode,
   where a tap toggles selection (Google Photos pattern). Every gesture has a button alternative. */
export function CreativeTile({
  c,
  n,
  selected,
  selecting,
  onSelect,
  onOpen,
  onEdit,
  onDownload,
  menu,
  look,
  compact,
  index = 0,
}: {
  c: CreativeT
  n?: number
  selected?: boolean
  /** selection mode: taps toggle selection instead of opening */
  selecting?: boolean
  onSelect?: () => void
  onOpen?: () => void
  onEdit?: () => void
  onDownload?: () => void
  menu?: MenuItem[]
  look: Look
  compact?: boolean
  /** position in a list, used to stagger the entrance animation */
  index?: number
}) {
  const name = creativeLabel(c)
  const { consumed: longPressConsumed, ...lp } = useLongPress(() => onSelect?.())
  return (
    <div className="group flex min-w-0 animate-rise flex-col gap-2" style={{ animationDelay: `${Math.min(index, 11) * 50}ms` }}>
      <div className={cx('relative overflow-hidden rounded-xl ring-offset-2 transition duration-200', selected ? 'ring-3 ring-brand-600' : 'ring-0')}>
        <Creative c={c} style={look.style} palette={look.palette} format={look.format} brand={look.brand} label="" />
        {/* Transparent layer over the artwork: the text drawn in the creative must not become the button's visible label (WCAG 2.5.3). */}
        <button
          type="button"
          {...(onSelect ? lp : {})}
          className="absolute inset-0 block w-full [-webkit-touch-callout:none]"
          onClick={() => {
            if (longPressConsumed()) return
            if (selecting && onSelect) onSelect()
            else onOpen?.()
          }}
          aria-label={selecting ? `${selected ? 'Desmarcar' : 'Selecionar'} ${name}` : `Abrir ${name}`}
          aria-pressed={selecting ? !!selected : undefined}
        />
        {n !== undefined && (
          <span className="pointer-events-none absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-white text-sm font-bold text-ink shadow" aria-hidden>
            {n}
          </span>
        )}
        {onSelect && (
          <button
            type="button"
            onClick={onSelect}
            className={cx('absolute top-0 right-0 grid size-11 place-items-center', !selecting && !selected && 'opacity-90')}
            aria-label={`${selected ? 'Desmarcar' : 'Selecionar'} ${name}`}
            aria-pressed={!!selected}
          >
            <span className="rounded-md bg-white/95 p-0.5 shadow">
              <CheckBadge on={!!selected} />
            </span>
          </button>
        )}
        {selected && <span className="pointer-events-none absolute inset-0 bg-brand-700/15" aria-hidden />}
      </div>
      {(onEdit || onDownload || menu) && !selecting && (
        <div className="flex gap-1.5">
          {onEdit && (
            <Button variant="secondary" size="sm" onClick={onEdit} className="flex-1 px-2" aria-label={compact ? `Editar ${name}` : undefined}>
              <Pencil className="size-4" aria-hidden /> {!compact && 'Editar'}
            </Button>
          )}
          {onDownload && (
            <IconButton size="sm" variant="secondary" label={`Baixar ${name}`} onClick={onDownload}>
              <Download className="size-4" aria-hidden />
            </IconButton>
          )}
          {menu && (
            <Menu
              label={`Mais opções: ${name}`}
              items={menu}
              trigger={(p) => (
                <IconButton {...p} size="sm" variant="secondary" label={`Mais opções: ${name}`}>
                  <MoreHorizontal className="size-4" aria-hidden />
                </IconButton>
              )}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Export (PNG / ZIP / native share) ---------- */
interface ExportState {
  open: boolean
  jobs: ExportJob[]
}
/** iOS Safari and many Android browsers save images better through the share sheet than through downloads. */
function canShareFiles(files: File[]) {
  try {
    return typeof navigator !== 'undefined' && 'canShare' in navigator && navigator.canShare({ files })
  } catch {
    return false
  }
}

export function ExportHost() {
  const [st, setSt] = useState<ExportState>({ open: false, jobs: [] })
  const [files, setFiles] = useState<{ name: string; dataUrl: string }[]>([])
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const phone = useIsPhone()
  useEffect(() => {
    setExportOpener((jobs) => {
      setFiles([])
      setZipBlob(null)
      setBusy(true)
      setSt({ open: true, jobs })
    })
  }, [])
  useEffect(() => {
    if (!st.open) return
    let alive = true
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
      if (out.length > 1 && !(phone && canShareFiles(asFiles(out)))) setZipBlob(await makeZip(out))
      if (alive) setBusy(false)
    })()
    return () => {
      alive = false
    }
  }, [st, phone])
  const close = () => setSt({ open: false, jobs: [] })
  const save = async (name: string, blob: Blob) => {
    const r = await saveFile(name, blob)
    if (r === 'saved') toast('Download iniciado')
    else if (r === 'failed') toast('Não foi possível baixar aqui. Toque e segure a imagem para salvar.', 'error')
  }
  const share = async () => {
    try {
      await navigator.share({ files: asFiles(files), title: 'Criativos MIDFLOW' })
      toast('Pronto para salvar ou publicar')
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast('Não foi possível compartilhar. Tente baixar.', 'error')
    }
  }
  const many = st.jobs.length > 1
  const shareable = phone && files.length === st.jobs.length && files.length > 0 && canShareFiles(asFiles(files))
  return (
    <Dialog
      open={st.open}
      onClose={close}
      title={many ? `Baixar ${st.jobs.length} arquivos` : 'Baixar criativo'}
      size={many ? 'xl' : 'md'}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close}>
            Fechar
          </Button>
          {shareable && (
            <Button onClick={share}>
              <Share2 className="size-4" aria-hidden /> Salvar no celular / compartilhar
            </Button>
          )}
          {many
            ? !shareable && (
                <Button loading={busy} disabled={!zipBlob} onClick={() => zipBlob && save('midflow-criativos.zip', zipBlob)}>
                  <Download className="size-4" aria-hidden /> {busy ? 'Preparando…' : 'Baixar .zip'}
                </Button>
              )
            : !shareable && (
                <Button loading={busy} disabled={!files[0]} onClick={() => files[0] && save(files[0].name, dataUrlToBlob(files[0].dataUrl))}>
                  <Download className="size-4" aria-hidden /> {busy ? 'Gerando PNG…' : 'Baixar PNG'}
                </Button>
              )}
        </div>
      }
    >
      <div className="p-5 md:p-6">
        <p role="status" className="sr-only">
          {busy ? `Gerando ${files.length} de ${st.jobs.length}` : `${files.length} arquivos prontos`}
        </p>
        <div className={cx('grid gap-3', many ? 'grid-cols-2 sm:grid-cols-4' : 'mx-auto max-w-[300px]')}>
          {st.jobs.map((j, i) => (
            <figure key={j.name} className="overflow-hidden rounded-xl border border-line bg-slate-50">
              {files[i] ? (
                <img src={files[i].dataUrl} alt={creativeLabel(j.creative)} className="block w-full" />
              ) : (
                <div className={cx('grid place-items-center skeleton', j.creative.kind === 'story' ? 'aspect-[9/16]' : j.format === '1:1' ? 'aspect-square' : 'aspect-[4/5]')}>
                  <Loader2 className="size-5 animate-spin text-slate-500 motion-reduce:animate-none" aria-hidden />
                </div>
              )}
              <figcaption className="truncate px-2 py-1.5 text-xs text-fg-subtle">{j.name}</figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-fg-subtle">PNG em alta resolução (1080 px). Se o download não começar, toque e segure a imagem para salvar.</p>
      </div>
    </Dialog>
  )
}
const asFiles = (list: { name: string; dataUrl: string }[]) => list.map((f) => new File([dataUrlToBlob(f.dataUrl)], f.name, { type: 'image/png' }))

/* ---------- Color swatches with HEX editing (≤5) ----------
   Each swatch has an accessible name ("Cor 1, #0B765B"); the editor is a small dialog-like popover
   with a native color picker + HEX field. Esc / outside click close it and focus returns to the swatch. */
export function ColorSwatches({ colors, onChange, max = 5, size = 'md', labelledBy }: { colors: string[]; onChange: (c: string[]) => void; max?: number; size?: 'sm' | 'md'; labelledBy?: string }) {
  const [edit, setEdit] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const wrap = useRef<HTMLDivElement>(null)
  const box = size === 'sm' ? 'size-11' : 'size-12'
  const closeEdit = (i: number | null) => {
    setEdit(null)
    if (i !== null) requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>(`[data-swatch="${i}"]`)?.focus())
  }
  const commit = (i: number) => {
    if (isHex(draft)) {
      const next = [...colors]
      next[i] = normalizeHex(draft)
      onChange(next)
    }
    closeEdit(i)
  }
  useEffect(() => {
    if (edit === null) return
    const h = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setEdit(null)
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [edit])
  return (
    <div ref={wrap} role="group" aria-labelledby={labelledBy} className="flex flex-wrap items-center gap-2.5">
      {colors.map((c, i) => (
        <div key={i} className="relative">
          <button
            type="button"
            data-swatch={i}
            onClick={() => {
              setEdit(edit === i ? null : i)
              setDraft(c)
            }}
            aria-expanded={edit === i}
            className={cx(box, 'rounded-xl border border-black/15 shadow-sm transition hover:scale-105')}
            style={{ background: c }}
            aria-label={`Cor ${i + 1}, ${c}. Editar`}
          />
          {edit === i && (
            <div
              role="group"
              aria-label={`Editar cor ${i + 1}`}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  closeEdit(i)
                }
              }}
              className="absolute top-full left-0 z-30 mt-2 w-64 rounded-xl border border-line bg-white p-3 shadow-pop animate-fade-in"
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={isHex(draft) ? normalizeHex(draft) : c}
                  onChange={(e) => setDraft(e.target.value.toUpperCase())}
                  className="size-11 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  aria-label={`Seletor visual da cor ${i + 1}`}
                />
                <label className="sr-only" htmlFor={`hex-${i}`}>
                  Código HEX da cor {i + 1}
                </label>
                <input
                  id={`hex-${i}`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit(i))}
                  aria-invalid={!isHex(draft) || undefined}
                  spellCheck={false}
                  autoCapitalize="characters"
                  className="h-11 w-full rounded-lg border border-line px-2 font-mono text-base uppercase focus:border-brand-600 focus:outline-none aria-[invalid=true]:border-danger sm:text-sm"
                  autoFocus
                />
              </div>
              {!isHex(draft) && <p className="mt-1.5 text-xs font-medium text-danger">Use o formato #RRGGBB.</p>}
              <div className="mt-2.5 flex justify-between gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={colors.length <= 1}
                  onClick={() => {
                    onChange(colors.filter((_, k) => k !== i))
                    setEdit(null)
                  }}
                  aria-label={`Remover cor ${i + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden /> Remover
                </Button>
                <Button size="sm" onClick={() => commit(i)}>
                  <Check className="size-4" aria-hidden /> Aplicar
                </Button>
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
          className={cx(box, 'grid place-items-center rounded-xl border-2 border-dashed border-slate-400 bg-white text-slate-600 hover:border-brand-500 hover:text-brand-800')}
          aria-label="Adicionar cor"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      )}
    </div>
  )
}
