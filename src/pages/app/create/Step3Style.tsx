import { ArrowLeft, ArrowRight, Box, Check, ImageIcon, Images, Palette as PaletteIcon, RefreshCw, Shapes, Smartphone, Square, Upload, Wand2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../../components/creative/Creative'
import { ColorSwatches, readFile, useLook } from '../../../components/creative/parts'
import { Button, CheckBadge, Chip, cx, Label, toast } from '../../../components/ui'
import { suggestedColors } from '../../../lib/color'
import { STYLES, TONES } from '../../../lib/data'
import { photoUrl } from '../../../lib/photos'
import { useApp } from '../../../lib/store'
import type { ImageType, ToneId } from '../../../lib/types'
import { Panel, PreviewPanel, SectionTitle, useExamples } from './shared'
import { TONE_ICON } from './Step1Briefing'

const IMAGE_TYPES: { id: ImageType; label: string; icon: typeof ImageIcon }[] = [
  { id: 'fotos', label: 'Fotos reais', icon: ImageIcon },
  { id: 'ilustracoes', label: 'Ilustrações', icon: Shapes },
  { id: 'render', label: 'Render/IA', icon: Box },
  { id: 'misto', label: 'Misto', icon: Images },
]

export function Step3Style() {
  const nav = useNavigate()
  const st = useApp((s) => s.style)
  const set = useApp((s) => s.setStyle)
  const content = useApp((s) => s.content)
  const setContent = useApp((s) => s.setContent)
  const briefing = useApp((s) => s.briefing)
  const brand = useApp((s) => s.brand)
  const setBrand = useApp((s) => s.setBrand)
  const markDone = useApp((s) => s.markDone)
  const seed = useApp((s) => s.exampleSeed)
  const look = useLook()
  const [tab, setTab] = useState<'posts' | 'stories'>('posts')
  const styleRef = useRef<HTMLDivElement>(null)
  const segment = briefing.segment || brand.segment
  const ex = useExamples({
    segment, themeId: content.themeId, customTheme: content.customTheme, objective: content.objective, tones: st.tones,
    style: look.style, palette: look.palette, seed, brandName: brand.name, handle: brand.handle, city: briefing.location || brand.city,
  })
  const aiColors = suggestedColors(segment, st.style)

  const toggleTone = (t: ToneId) => set({ tones: st.tones.includes(t) ? st.tones.filter((x) => x !== t) : [...st.tones, t] })

  const next = () => {
    if (!content.posts && !content.stories) return toast('Escolha ao menos um formato', 'info')
    markDone(3)
    nav('/app/criar/4')
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Panel>
        <h2 className="text-xl font-bold">3. Estilo</h2>
        <p className="mt-1 text-sm text-slate-500">Defina o estilo visual, a linguagem e as referências para que a IA gere conteúdos com a cara da sua marca.</p>

        <div className="mt-6 border-t border-line pt-5">
          <SectionTitle hint="Use as cores e elementos da sua marca ou escolha um estilo pronto.">Identidade visual</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: 'brand' as const, title: 'Usar minha marca', sub: 'Cores, logo e estilo da minha empresa', icon: PaletteIcon },
              { id: 'ai' as const, title: 'Usar estilo sugerido pela IA', sub: 'A IA escolhe um estilo ideal', icon: Wand2 },
            ].map((o) => {
              const on = st.identity === o.id
              return (
                <button key={o.id} onClick={() => set({ identity: o.id })} aria-pressed={on} className={cx('flex items-center gap-3.5 rounded-xl border p-4 text-left transition', on ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-200' : 'border-line hover:border-slate-300')}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white ring-1 ring-line">
                    <o.icon className="size-5 text-slate-600" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-sm font-semibold">{o.title}</span>
                    <span className="block text-xs text-slate-500">{o.sub}</span>
                  </span>
                  <CheckBadge on={on} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <Label>{st.identity === 'brand' ? 'Cores da marca' : 'Cores sugeridas pela IA'}</Label>
            {st.identity === 'brand' ? (
              <ColorSwatches
                colors={st.colors}
                onChange={(colors) => {
                  set({ colors })
                  setBrand({ colors })
                }}
              />
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {aiColors.map((c) => (
                  <span key={c} className="size-12 rounded-xl border border-black/10" style={{ background: c }} title={c} />
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">{st.identity === 'brand' ? 'Até 5 cores. A geração prioriza essas cores.' : 'Paleta escolhida para o seu segmento e estilo.'}</p>
          </div>
          <div>
            <Label hint="(opcional)">Logo da sua marca</Label>
            {st.logo ?? brand.logo ? (
              <div className="flex h-[100px] items-center gap-4 rounded-xl border border-line p-3">
                <img src={st.logo ?? brand.logo} alt="Logo" className="h-full max-w-[140px] object-contain" />
                <button
                  onClick={() => {
                    set({ logo: undefined })
                    setBrand({ logo: undefined })
                  }}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600"
                >
                  <X className="size-4" /> Remover
                </button>
              </div>
            ) : (
              <label className="flex h-[100px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 text-center hover:border-brand-400 hover:bg-brand-50/40">
                <Upload className="size-5 text-slate-500" />
                <span className="text-[13px] font-semibold">Clique para enviar seu logo</span>
                <span className="text-[11px] text-slate-400">PNG ou SVG (máx. 5MB)</span>
                <input
                  type="file"
                  accept="image/png,image/svg+xml,image/webp,image/jpeg"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    if (f.size > 5 * 1024 * 1024) return toast('O arquivo passa de 5MB', 'info')
                    const url = await readFile(f)
                    set({ logo: url })
                    setBrand({ logo: url })
                    toast('Logo aplicado aos criativos')
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <div className="mt-7" ref={styleRef}>
          <SectionTitle>Estilo visual (layout)</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
            {STYLES.map((s) => {
              const on = st.style === s.id
              return (
                <button key={s.id} onClick={() => set({ style: s.id })} title={s.desc} aria-pressed={on} className={cx('relative overflow-hidden rounded-xl border bg-white text-center transition', on ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:border-slate-300')}>
                  <img src={photoUrl(s.photo)} alt="" className="aspect-[1/0.95] w-full object-cover" />
                  {on && (
                    <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-md bg-brand-600 text-white">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                  <div className={cx('py-1.5 text-[12.5px] font-semibold', on && 'text-brand-800')}>{s.label}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-7">
          <SectionTitle>Tipo de imagem</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {IMAGE_TYPES.map((t) => {
              const on = st.imageType === t.id
              return (
                <button key={t.id} onClick={() => set({ imageType: t.id })} aria-pressed={on} className={cx('flex h-11 items-center gap-2 rounded-xl border px-3 text-[13px] font-medium transition', on ? 'border-brand-400 bg-brand-50/60 text-brand-800' : 'border-line text-slate-600 hover:border-slate-300')}>
                  <t.icon className="size-4" />
                  <span className="flex-1 text-left">{t.label}</span>
                  {on && <CheckBadge on />}
                </button>
              )
            })}
          </div>
          {st.imageType !== 'fotos' && <p className="mt-2 text-xs text-slate-500">Neste protótipo as artes usam fotos reais. Ilustrações e imagens geradas por IA entram no MVP.</p>}
        </div>

        <div className="mt-7">
          <SectionTitle>Linguagem e tom de comunicação</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => {
              const I = TONE_ICON[t.id]
              return (
                <Chip key={t.id} active={st.tones.includes(t.id)} onClick={() => toggleTone(t.id)} icon={<I className="size-4 text-slate-400" />}>
                  {t.label}
                </Chip>
              )
            })}
          </div>
        </div>

        <div className="mt-7">
          <SectionTitle>Formato dos posts</SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {[
              { id: '1:1' as const, label: 'Quadrado (1:1)', icon: Square },
              { id: '4:5' as const, label: 'Vertical (4:5)', icon: Smartphone },
            ].map((f) => {
              const on = st.postFormat === f.id
              return (
                <button key={f.id} onClick={() => set({ postFormat: f.id })} aria-pressed={on} className={cx('flex h-12 items-center gap-2.5 rounded-xl border px-3.5 text-sm font-medium transition', on ? 'border-brand-400 bg-brand-50/60 text-brand-800' : 'border-line text-slate-600 hover:border-slate-300')}>
                  <f.icon className="size-4" />
                  <span className="flex-1 text-left">{f.label}</span>
                  <CheckBadge on={on} />
                </button>
              )
            })}
            <button onClick={() => setContent({ stories: !content.stories })} aria-pressed={content.stories} className={cx('flex h-12 items-center gap-2.5 rounded-xl border px-3.5 text-sm font-medium transition', content.stories ? 'border-brand-400 bg-brand-50/60 text-brand-800' : 'border-line text-slate-600 hover:border-slate-300')}>
              <Smartphone className="size-4" />
              <span className="flex-1 text-left">Stories (9:16)</span>
              <CheckBadge on={content.stories} />
            </button>
          </div>
          {st.postFormat === '4:5' && <p className="mt-2 text-xs text-slate-500">4:5 é o formato recomendado para o feed do Instagram.</p>}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
          <Button variant="secondary" size="lg" onClick={() => nav('/app/criar/2')}>
            <ArrowLeft className="size-5" /> Voltar para conteúdo
          </Button>
          <Button size="lg" onClick={next}>
            Continuar para gerar <ArrowRight className="size-5" />
          </Button>
        </div>
      </Panel>

      <PreviewPanel className="xl:sticky xl:top-[100px] xl:self-start">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Pré-visualização do estilo escolhido</h2>
            <p className="text-[13px] text-slate-500">Veja exemplos de como ficarão os seus posts e stories com este estilo.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              styleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              toast('Escolha outro estilo — a prévia muda na hora', 'info')
            }}
          >
            <RefreshCw className="size-4" /> Trocar estilo
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(['posts', 'stories'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cx('h-10 rounded-lg border-b-2 text-sm font-semibold transition', tab === t ? 'border-brand-600 bg-white text-brand-800 shadow-sm' : 'border-transparent bg-white/60 text-slate-500')}>
              {t === 'posts' ? 'Posts para feed' : 'Stories'}
            </button>
          ))}
        </div>
        <div key={`${st.style}-${st.identity}-${st.postFormat}-${tab}`} className="mt-4 animate-fade-in">
          {tab === 'posts' && (
            <div className="grid grid-cols-3 items-start gap-3">
              {ex.posts.slice(0, 3).map((c) => (
                <div key={c.id} className="overflow-hidden rounded-xl shadow-card">
                  <Creative c={c} style={look.style} palette={look.palette} format={st.postFormat} brand={look.brand} />
                </div>
              ))}
            </div>
          )}
          <div className={tab === 'posts' ? 'mt-6' : ''}>
            {tab === 'posts' && (
              <h3 className="mb-3 text-sm font-bold">
                Exemplo de sequência de Stories <span className="font-normal text-slate-500">{ex.stories.length} telas sugeridas</span>
              </h3>
            )}
            <div className="grid grid-cols-4 gap-2.5">
              {ex.stories.map((c, i) => (
                <div key={c.id} className="relative overflow-hidden rounded-xl shadow-card">
                  <Creative c={c} style={look.style} palette={look.palette} format="4:5" brand={look.brand} />
                  <span className="absolute top-6 left-2 grid size-6 place-items-center rounded-full bg-white text-[11px] font-bold shadow">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PreviewPanel>
    </div>
  )
}
