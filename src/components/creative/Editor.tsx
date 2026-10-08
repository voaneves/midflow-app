import { Download, ImagePlus, RotateCcw, Save, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { derivePalette } from '../../lib/color'
import { segmentDef, STYLES } from '../../lib/data'
import { rewrite } from '../../lib/generator'
import { PHOTOS, photoUrl } from '../../lib/photos'
import { useApp } from '../../lib/store'
import type { Creative as CreativeT, Palette, PostFormat, StyleId } from '../../lib/types'
import { Button, cx, Input, Label, Modal, Textarea, toast } from '../ui'
import { Creative, type BrandMark } from './Creative'
import { exportCreatives, jobFor, readFile } from './parts'

interface Props {
  open: boolean
  onClose: () => void
  creative: CreativeT | null
  look: { palette: Palette; style: StyleId; format: PostFormat; brand: BrandMark }
  onSave: (c: CreativeT) => void
}

const photoIds = Object.keys(PHOTOS).filter((k) => !k.startsWith('st-'))

export function Editor({ open, onClose, creative, look, onSave }: Props) {
  const segment = useApp((s) => s.briefing.segment || s.brand.segment)
  const [c, setC] = useState<CreativeT | null>(creative)
  const [tab, setTab] = useState<'texto' | 'visual' | 'legenda'>('texto')
  const [seed, setSeed] = useState(1)
  useEffect(() => {
    setC(creative)
    setTab('texto')
  }, [creative])
  if (!c) return null
  const set = (p: Partial<CreativeT>) => setC({ ...c, ...p })
  const palettes: { label: string; p: Palette }[] = [
    { label: 'Marca', p: look.palette },
    { label: 'Sugerida', p: derivePalette(segmentDef(segment).palette) },
    { label: 'Neutra', p: derivePalette(['#1B1B1B', '#8C8C8C', '#E6E6E6', '#FAFAFA']) },
    { label: 'Teal', p: derivePalette(['#0B4D3D', '#12B386', '#A8EAD5', '#F3F7F6']) },
  ]
  const activePalette = c.palette ?? look.palette
  return (
    <Modal open={open} onClose={onClose} title={c.kind === 'story' ? `Editar story ${c.order}` : `Editar post ${c.order}`} wide>
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="mx-auto w-full max-w-[340px] lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-2xl shadow-card">
            <Creative c={c} style={look.style} palette={look.palette} format={look.format} brand={look.brand} chrome={false} />
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">A prévia atualiza enquanto você edita.</p>
        </div>

        <div className="min-w-0">
          <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
            {(['texto', 'visual', 'legenda'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cx('h-9 flex-1 rounded-lg text-[13px] font-semibold capitalize', tab === t ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-500')}>
                {t === 'texto' ? 'Texto da arte' : t === 'visual' ? 'Visual' : 'Legenda e hashtags'}
              </button>
            ))}
          </div>

          {tab === 'texto' && (
            <div className="grid gap-4">
              <div className="flex justify-end">
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => {
                    set(rewrite(c, segment as never, seed))
                    setSeed(seed + 1)
                  }}
                >
                  <Wand2 className="size-4" /> Reescrever com IA
                </Button>
              </div>
              <div>
                <Label htmlFor="ed-tag">Etiqueta</Label>
                <Input id="ed-tag" value={c.tag ?? ''} onChange={(e) => set({ tag: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ed-head">Título</Label>
                <Textarea id="ed-head" value={c.headline} max={90} onChange={(e) => set({ headline: e.target.value })} className="min-h-[70px]" />
              </div>
              <div>
                <Label htmlFor="ed-hl" hint="(trecho do título com destaque)">Destaque</Label>
                <Input id="ed-hl" value={c.highlight ?? ''} onChange={(e) => set({ highlight: e.target.value })} />
              </div>
              {c.sub !== undefined && (
                <div>
                  <Label htmlFor="ed-sub">Subtítulo</Label>
                  <Input id="ed-sub" value={c.sub} onChange={(e) => set({ sub: e.target.value })} />
                </div>
              )}
              {c.bullets && (
                <div>
                  <Label htmlFor="ed-bul" hint="(um por linha)">Itens</Label>
                  <Textarea id="ed-bul" value={c.bullets.join('\n')} onChange={(e) => set({ bullets: e.target.value.split('\n') })} />
                </div>
              )}
              {c.price && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3 sm:col-span-1">
                    <Label htmlFor="ed-pl">Rótulo</Label>
                    <Input id="ed-pl" value={c.price.label} onChange={(e) => set({ price: { ...c.price!, label: e.target.value } })} />
                  </div>
                  <div>
                    <Label htmlFor="ed-pv">Valor (R$)</Label>
                    <Input id="ed-pv" value={c.price.value} onChange={(e) => set({ price: { ...c.price!, value: e.target.value } })} />
                  </div>
                  <div>
                    <Label htmlFor="ed-pc">Centavos</Label>
                    <Input id="ed-pc" value={c.price.cents ?? ''} onChange={(e) => set({ price: { ...c.price!, cents: e.target.value } })} />
                  </div>
                </div>
              )}
              {c.quote && (
                <div className="grid gap-3">
                  <div>
                    <Label htmlFor="ed-qt">Depoimento</Label>
                    <Textarea id="ed-qt" value={c.quote.text} onChange={(e) => set({ quote: { ...c.quote!, text: e.target.value } })} />
                  </div>
                  <div>
                    <Label htmlFor="ed-qa">Autor</Label>
                    <Input id="ed-qa" value={c.quote.author} onChange={(e) => set({ quote: { ...c.quote!, author: e.target.value } })} />
                  </div>
                </div>
              )}
              {c.poll && (
                <div className="grid grid-cols-2 gap-3">
                  {c.poll.map((o, i) => (
                    <div key={i}>
                      <Label htmlFor={`ed-poll-${i}`}>Opção {i + 1}</Label>
                      <Input id={`ed-poll-${i}`} value={o} onChange={(e) => set({ poll: c.poll!.map((x, k) => (k === i ? e.target.value : x)) })} />
                    </div>
                  ))}
                </div>
              )}
              <div>
                <Label htmlFor="ed-cta">Chamada para ação (CTA)</Label>
                <Input id="ed-cta" value={c.cta} onChange={(e) => set({ cta: e.target.value })} />
              </div>
            </div>
          )}

          {tab === 'visual' && (
            <div className="grid gap-6">
              <div>
                <Label>Layout</Label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {STYLES.map((s) => {
                    const on = (c.style ?? look.style) === s.id
                    return (
                      <button key={s.id} onClick={() => set({ style: s.id })} className={cx('overflow-hidden rounded-xl border text-left text-xs font-semibold transition', on ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:border-slate-300')}>
                        <img src={photoUrl(s.photo)} alt="" className="aspect-square w-full object-cover" />
                        <div className="px-2 py-1.5">{s.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <Label>Paleta</Label>
                <div className="flex flex-wrap gap-2">
                  {palettes.map(({ label, p }) => {
                    const on = JSON.stringify(p) === JSON.stringify(activePalette)
                    return (
                      <button key={label} onClick={() => set({ palette: p })} className={cx('flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold', on ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-slate-300')}>
                        <span className="flex">
                          {[p.dark, p.mid, p.soft, p.light].map((x) => (
                            <i key={x} className="-ml-1 size-5 rounded-full border-2 border-white first:ml-0" style={{ background: x }} />
                          ))}
                        </span>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <Label>Imagem</Label>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                  <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-700" title="Enviar foto">
                    <ImagePlus className="size-5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (f) set({ photo: await readFile(f) })
                      }}
                    />
                  </label>
                  {c.photo?.startsWith('data:') && <img src={c.photo} alt="" className="aspect-square rounded-lg object-cover ring-2 ring-brand-500" />}
                  {photoIds.map((id) => (
                    <button key={id} onClick={() => set({ photo: id })} className={cx('overflow-hidden rounded-lg transition', c.photo === id ? 'ring-2 ring-brand-500 ring-offset-1' : 'opacity-90 hover:opacity-100')}>
                      <img src={photoUrl(id)} alt="" className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
              {(c.style || c.palette) && (
                <button onClick={() => set({ style: undefined, palette: undefined })} className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-ink">
                  <RotateCcw className="size-3.5" /> Voltar ao estilo da geração
                </button>
              )}
            </div>
          )}

          {tab === 'legenda' && (
            <div className="grid gap-4">
              <div>
                <Label htmlFor="ed-cap">Legenda</Label>
                <Textarea id="ed-cap" value={c.caption} max={2200} onChange={(e) => set({ caption: e.target.value })} className="min-h-[220px]" />
              </div>
              <div>
                <Label htmlFor="ed-tags" hint="(separadas por espaço)">Hashtags</Label>
                <Input id="ed-tags" value={c.hashtags.join(' ')} onChange={(e) => set({ hashtags: e.target.value.split(/\s+/).filter(Boolean) })} />
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-end gap-2 border-t border-line pt-5">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={() => exportCreatives([jobFor(c, look, c.order - 1, c.headline)])}>
              <Download className="size-4" /> Baixar
            </Button>
            <Button
              onClick={() => {
                onSave(c)
                toast('Alterações salvas')
                onClose()
              }}
            >
              <Save className="size-4" /> Salvar alterações
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
