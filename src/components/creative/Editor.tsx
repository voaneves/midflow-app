import { useState, useEffect } from 'react'
import {
  Download,
  ImagePlus,
  RotateCcw,
  Save,
  Sparkles,
  Wand2,
  Tag as TagIcon,
  List,
  CheckCircle2,
  DollarSign,
  Quote as QuoteIcon,
  Vote,
  LayoutTemplate,
} from 'lucide-react'
import { derivePalette } from '../../lib/color'
import { generateCustomImageWithAI, rewriteCreativeWithAI } from '../../lib/aiService'
import { segmentDef, STYLES } from '../../lib/data'
import { PHOTOS, photoUrl } from '../../lib/photos'
import { useApp } from '../../lib/store'
import { track } from '../../lib/telemetry'
import type { Creative as CreativeT, Palette, PostFormat, StyleId, Variant } from '../../lib/types'
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

const VARIANTS: { id: Variant; label: string; icon: typeof TagIcon }[] = [
  { id: 'photo', label: 'Foto Destaque', icon: TagIcon },
  { id: 'list', label: 'Lista com Ícones', icon: List },
  { id: 'icons', label: '3 Destaques', icon: CheckCircle2 },
  { id: 'beforeafter', label: 'Antes e Depois', icon: LayoutTemplate },
  { id: 'offer', label: 'Oferta com Preço', icon: DollarSign },
  { id: 'quote', label: 'Depoimento 5★', icon: QuoteIcon },
  { id: 'poll', label: 'Enquete', icon: Vote },
]

export function Editor({ open, onClose, creative, look, onSave }: Props) {
  const brand = useApp((s) => s.brand)
  const styleState = useApp((s) => s.style)
  const segment = useApp((s) => s.briefing.segment || s.brand.segment)
  const [c, setC] = useState<CreativeT | null>(creative)
  const [tab, setTab] = useState<'texto' | 'visual' | 'legenda'>('texto')
  const [aiMode, setAiMode] = useState<'vendedor' | 'curto' | 'sofisticado' | 'descontraido' | 'educativo'>('vendedor')
  const [seed, setSeed] = useState(1)
  const [rewriting, setRewriting] = useState(false)
  const [imgPrompt, setImgPrompt] = useState('')
  const [imgType, setImgType] = useState<'fotos' | 'ilustracoes' | 'render'>(
    styleState.imageType === 'ilustracoes' || styleState.imageType === 'render' ? styleState.imageType : 'fotos',
  )
  const [generatingImg, setGeneratingImg] = useState(false)

  useEffect(() => {
    setC(creative)
    setTab('texto')
  }, [creative])

  if (!c) return null

  const set = (p: Partial<CreativeT>) => setC({ ...c, ...p })

  const changeVariant = (v: Variant) => {
    const updates: Partial<CreativeT> = { variant: v }
    if (v === 'list' && (!c.bullets || !c.bullets.length)) {
      updates.bullets = ['Atendimento exclusivo e individual', 'Produtos e técnicas profissionais', 'Resultados visíveis e duradouros']
    }
    if (v === 'offer' && !c.price) {
      updates.price = { label: 'A partir de', value: '89', cents: '90' }
    }
    if (v === 'quote' && !c.quote) {
      updates.quote = {
        text: 'Melhor experiência que já tive! Atendimento impecável e resultado maravilhoso.',
        author: 'Cliente Satisfeita',
      }
    }
    if (v === 'poll' && (!c.poll || !c.poll.length)) {
      updates.poll = ['Com certeza!', 'Quero saber mais']
    }
    if (v === 'beforeafter' && !c.photo2) {
      updates.photo2 = 'transform'
    }
    set(updates)
    toast(`Modelo alterado para ${VARIANTS.find((x) => x.id === v)?.label}`)
  }

  const palettes: { label: string; p: Palette }[] = [
    { label: 'Marca', p: look.palette },
    { label: 'Sugerida', p: derivePalette(segmentDef(segment).palette) },
    { label: 'Neutra', p: derivePalette(['#1B1B1B', '#8C8C8C', '#E6E6E6', '#FAFAFA']) },
    { label: 'Teal', p: derivePalette(['#0B4D3D', '#12B386', '#A8EAD5', '#F3F7F6']) },
  ]
  const activePalette = c.palette ?? look.palette

  const handleRewrite = async () => {
    setRewriting(true)
    try {
      const res = await rewriteCreativeWithAI({
        creative: c,
        mode: aiMode,
        brandName: brand.name,
        segment: segment || 'beleza',
        city: brand.city,
        seed,
      })
      set({
        headline: res.headline || c.headline,
        highlight: res.highlight || c.highlight,
        sub: res.sub !== undefined ? res.sub : c.sub,
        bullets: res.bullets?.length ? res.bullets : c.bullets,
        cta: res.cta || c.cta,
        caption: res.caption || c.caption,
      })
      setSeed(seed + 1)
      toast(
        res.engine === 'gemini' || res.engine === 'openai'
          ? `Texto reescrito com IA (modo ${aiMode})`
          : `Texto reescrito com modelo de reserva (IA indisponível)`,
        res.engine === 'gemini' || res.engine === 'openai' ? 'ok' : 'info',
      )
    } finally {
      setRewriting(false)
    }
  }

  const handleGenerateAIImage = async () => {
    setGeneratingImg(true)
    try {
      const nextSeed = Date.now() % 100000
      const url = await generateCustomImageWithAI({
        prompt: imgPrompt.trim() || undefined,
        headline: c.headline,
        segment: segment || 'beleza',
        themeId: c.themeId,
        imageType: imgType,
        style: c.style ?? look.style,
        kind: c.kind,
        order: c.order,
        seed: nextSeed,
        palette: activePalette,
      })
      if (url) {
        set({ photo: url })
        toast('Nova imagem contextual gerada com IA!')
      } else {
        toast('Não foi possível gerar a imagem agora.', 'error')
      }
    } finally {
      setGeneratingImg(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={c.kind === 'story' ? `Editar story ${c.order}` : `Editar post ${c.order}`} wide>
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="mx-auto w-full max-w-[340px] lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-2xl shadow-card">
            <Creative c={c} style={c.style ?? look.style} palette={c.palette ?? look.palette} format={look.format} brand={look.brand} chrome={false} />
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">A prévia atualiza instantaneamente enquanto você edita.</p>
        </div>

        <div className="min-w-0">
          <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
            {(['texto', 'visual', 'legenda'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cx('h-9 flex-1 rounded-lg text-[13px] font-semibold capitalize transition', tab === t ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-500 hover:text-ink')}
              >
                {t === 'texto' ? 'Texto e Conteúdo' : t === 'visual' ? 'Design e Imagens' : 'Legenda e Hashtags'}
              </button>
            ))}
          </div>

          {tab === 'texto' && (
            <div className="grid gap-4">
              {/* Seletor de Modelo de Arte */}
              <div>
                <Label>Modelo da Arte (Estrutura)</Label>
                <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {VARIANTS.map((v) => {
                    const on = c.variant === v.id
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => changeVariant(v.id)}
                        className={cx(
                          'flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition',
                          on ? 'border-brand-500 bg-brand-50 text-brand-900 shadow-sm' : 'border-line bg-white text-slate-600 hover:border-slate-300',
                        )}
                      >
                        <v.icon className="size-3.5" />
                        <span>{v.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Barra de Reescrita com IA */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50/60 p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-brand-600" />
                  <span className="text-xs font-bold text-brand-900">Reescrever com IA:</span>
                  <select
                    value={aiMode}
                    onChange={(e) => setAiMode(e.target.value as typeof aiMode)}
                    className="h-8 rounded-lg border border-line bg-white px-2 text-xs font-semibold text-slate-700"
                  >
                    <option value="vendedor">Mais Vendedor</option>
                    <option value="curto">Mais Curto & Direto</option>
                    <option value="sofisticado">Mais Sofisticado</option>
                    <option value="descontraido">Mais Descontraído</option>
                    <option value="educativo">Mais Educativo</option>
                  </select>
                </div>
                <Button variant="primary" size="sm" loading={rewriting} onClick={handleRewrite}>
                  <Wand2 className="size-3.5" /> {rewriting ? 'Reescrevendo…' : 'Aplicar'}
                </Button>
              </div>

              <div>
                <Label htmlFor="ed-tag">Etiqueta Superior</Label>
                <Input id="ed-tag" value={c.tag ?? ''} onChange={(e) => set({ tag: e.target.value })} placeholder="Ex: DICA, NOVIDADE, PROMOÇÃO" />
              </div>

              <div>
                <Label htmlFor="ed-head">Título Principal</Label>
                <Textarea id="ed-head" value={c.headline} max={110} onChange={(e) => set({ headline: e.target.value })} className="min-h-[70px]" />
              </div>

              <div>
                <Label htmlFor="ed-hl" hint="(trecho destacado na tipografia especial)">Palavra de Destaque</Label>
                <Input id="ed-hl" value={c.highlight ?? ''} onChange={(e) => set({ highlight: e.target.value })} placeholder="Ex: resultado, autocuidado" />
              </div>

              <div>
                <Label htmlFor="ed-sub">Subtítulo / Apoio</Label>
                <Input id="ed-sub" value={c.sub ?? ''} onChange={(e) => set({ sub: e.target.value })} placeholder="Linha explicativa curta" />
              </div>

              {/* Campos dinâmicos conforme a variante */}
              {(c.variant === 'list' || c.bullets) && (
                <div>
                  <Label htmlFor="ed-bul" hint="(um item por linha)">Itens da Lista (Benefícios)</Label>
                  <Textarea
                    id="ed-bul"
                    value={(c.bullets ?? []).join('\n')}
                    onChange={(e) => set({ bullets: e.target.value.split('\n').filter(Boolean) })}
                    placeholder="Benefício 1&#10;Benefício 2&#10;Benefício 3"
                    className="min-h-[80px]"
                  />
                </div>
              )}

              {c.variant === 'offer' && (
                <div className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-slate-50 p-3">
                  <div>
                    <Label htmlFor="ed-pl">Rótulo</Label>
                    <Input id="ed-pl" value={c.price?.label ?? 'A partir de'} onChange={(e) => set({ price: { ...c.price, label: e.target.value, value: c.price?.value ?? '0' } })} />
                  </div>
                  <div>
                    <Label htmlFor="ed-pv">Valor (R$)</Label>
                    <Input id="ed-pv" value={c.price?.value ?? '89'} onChange={(e) => set({ price: { ...c.price, value: e.target.value, label: c.price?.label ?? 'R$' } })} />
                  </div>
                  <div>
                    <Label htmlFor="ed-pc">Centavos</Label>
                    <Input id="ed-pc" value={c.price?.cents ?? '90'} onChange={(e) => set({ price: { ...c.price, cents: e.target.value, label: c.price?.label ?? 'R$', value: c.price?.value ?? '0' } })} />
                  </div>
                </div>
              )}

              {c.variant === 'quote' && (
                <div className="grid gap-3 rounded-xl border border-line bg-slate-50 p-3">
                  <div>
                    <Label htmlFor="ed-qt">Depoimento</Label>
                    <Textarea id="ed-qt" value={c.quote?.text ?? ''} onChange={(e) => set({ quote: { ...c.quote, text: e.target.value, author: c.quote?.author ?? 'Cliente' } })} />
                  </div>
                  <div>
                    <Label htmlFor="ed-qa">Autor do Depoimento</Label>
                    <Input id="ed-qa" value={c.quote?.author ?? ''} onChange={(e) => set({ quote: { ...c.quote, author: e.target.value, text: c.quote?.text ?? '' } })} />
                  </div>
                </div>
              )}

              {c.variant === 'poll' && (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-slate-50 p-3">
                  {(c.poll || ['Sim', 'Não']).map((o, i) => (
                    <div key={i}>
                      <Label htmlFor={`ed-poll-${i}`}>Opção {i + 1}</Label>
                      <Input
                        id={`ed-poll-${i}`}
                        value={o}
                        onChange={(e) => {
                          const nextPoll = [...(c.poll || ['Sim', 'Não'])]
                          nextPoll[i] = e.target.value
                          set({ poll: nextPoll })
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label htmlFor="ed-cta">Chamada para Ação (CTA do botão)</Label>
                <Input id="ed-cta" value={c.cta} onChange={(e) => set({ cta: e.target.value })} placeholder="Ex: Agende seu horário, Saiba mais" />
              </div>
            </div>
          )}

          {tab === 'visual' && (
            <div className="grid gap-6">
              <div>
                <Label>Estilo Visual (Layout)</Label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {STYLES.map((s) => {
                    const on = (c.style ?? look.style) === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => set({ style: s.id })}
                        className={cx(
                          'overflow-hidden rounded-xl border text-left text-xs font-semibold transition',
                          on ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:border-slate-300',
                        )}
                      >
                        <img src={photoUrl(s.photo)} alt="" className="aspect-square w-full object-cover" />
                        <div className="px-2 py-1.5">{s.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <Label>Paleta de Cores</Label>
                <div className="flex flex-wrap gap-2">
                  {palettes.map(({ label, p }) => {
                    const on = JSON.stringify(p) === JSON.stringify(activePalette)
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => set({ palette: p })}
                        className={cx(
                          'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold transition',
                          on ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-line hover:border-slate-300',
                        )}
                      >
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

              {/* Gerador de Imagem sob demanda com IA */}
              <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
                    <Sparkles className="size-4 text-brand-600" /> Estúdio Visual IA — Gerar Imagem Exclusiva
                  </span>
                  <div className="flex gap-1">
                    {(
                      [
                        ['fotos', 'Foto Real'],
                        ['ilustracoes', 'Ilustração'],
                        ['render', 'Render 3D'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setImgType(id)}
                        className={cx(
                          'rounded-md px-2 py-0.5 text-[11px] font-semibold transition',
                          imgType === id ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Descreva a cena que deseja ou deixe em branco para gerar com base no título do post:
                </p>
                <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="ai-img-prompt"
                    value={imgPrompt}
                    onChange={(e) => setImgPrompt(e.target.value)}
                    placeholder={`Ex: ${c.headline.slice(0, 45)}...`}
                    className="flex-1 bg-white"
                  />
                  <Button size="sm" loading={generatingImg} onClick={handleGenerateAIImage}>
                    <Wand2 className="size-3.5" /> Gerar Imagem IA
                  </Button>
                </div>
              </div>

              {/* Foto 1 */}
              <div>
                <Label hint={c.variant === 'beforeafter' ? '(Foto "Antes")' : ''}>Catálogo Rápido & Upload</Label>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                  <label
                    className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-700"
                    title="Enviar foto do seu dispositivo"
                  >
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
                  {c.photo?.startsWith('data:') && (
                    <img src={c.photo} alt="" className="aspect-square rounded-lg object-cover ring-2 ring-brand-500" />
                  )}
                  {photoIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => set({ photo: id })}
                      className={cx(
                        'overflow-hidden rounded-lg transition',
                        c.photo === id ? 'ring-2 ring-brand-500 ring-offset-1' : 'opacity-90 hover:opacity-100',
                      )}
                    >
                      <img src={photoUrl(id)} alt="" className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Foto 2 para Antes e Depois */}
              {c.variant === 'beforeafter' && (
                <div>
                  <Label hint='(Foto "Depois")'>Segunda Imagem</Label>
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                    <label
                      className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-700"
                      title="Enviar segunda foto"
                    >
                      <ImagePlus className="size-5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={async (e) => {
                          const f = e.target.files?.[0]
                          if (f) set({ photo2: await readFile(f) })
                        }}
                      />
                    </label>
                    {c.photo2?.startsWith('data:') && (
                      <img src={c.photo2} alt="" className="aspect-square rounded-lg object-cover ring-2 ring-brand-500" />
                    )}
                    {photoIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => set({ photo2: id })}
                        className={cx(
                          'overflow-hidden rounded-lg transition',
                          c.photo2 === id ? 'ring-2 ring-brand-500 ring-offset-1' : 'opacity-90 hover:opacity-100',
                        )}
                      >
                        <img src={photoUrl(id)} alt="" className="aspect-square w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(c.style || c.palette) && (
                <button
                  type="button"
                  onClick={() => set({ style: undefined, palette: undefined })}
                  className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-ink"
                >
                  <RotateCcw className="size-3.5" /> Restaurar visual original da geração
                </button>
              )}
            </div>
          )}

          {tab === 'legenda' && (
            <div className="grid gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="ed-cap">Legenda para o Instagram</Label>
                  <span className="text-xs text-slate-400 tabular-nums">{c.caption.length}/2200</span>
                </div>
                <Textarea
                  id="ed-cap"
                  value={c.caption}
                  max={2200}
                  onChange={(e) => set({ caption: e.target.value })}
                  className="min-h-[220px]"
                />
              </div>
              <div>
                <Label htmlFor="ed-tags" hint="(separadas por espaço)">Hashtags Estratégicas</Label>
                <Input
                  id="ed-tags"
                  value={c.hashtags.join(' ')}
                  onChange={(e) => set({ hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
                />
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-end gap-2 border-t border-line pt-5">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportCreatives([jobFor(c, look, c.order - 1, c.headline)])}
            >
              <Download className="size-4" /> Baixar PNG
            </Button>
            <Button
              onClick={() => {
                onSave(c)
                track('edit', { brandName: brand.name })
                toast('Alterações salvas com sucesso!')
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
