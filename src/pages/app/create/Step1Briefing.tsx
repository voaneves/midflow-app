import { ArrowRight, BookOpen, Briefcase, CheckCircle2, ChevronLeft, ChevronRight, Copy, FileText, Gem, Link2, MapPin, Minus, PartyPopper, Save, Smile, Sparkles, Tag, Wand2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../../components/creative/Creative'
import { ColorSwatches, useLook } from '../../../components/creative/parts'
import { Button, Checkbox, Chip, cx, InstagramIcon, Input, Label, Select, StoriesIcon, Tabs, Textarea, toast, Toggle } from '../../../components/ui'
import { derivePalette } from '../../../lib/color'
import { BRIEFING_OBJECTIVES, SEGMENT_OPTIONS, segmentDef, STYLES, TONES } from '../../../lib/data'
import { copyText } from '../../../lib/export'
import { useApp } from '../../../lib/store'
import type { SegmentId, StyleId, ToneId } from '../../../lib/types'
import { Panel, PreviewPanel, useExamples } from './shared'

export const TONE_ICON: Record<string, typeof Smile> = {
  profissional: Briefcase, descontraido: Smile, inspirador: Sparkles, educativo: BookOpen, vendedor: Tag, divertido: PartyPopper, minimalista: Minus, luxuoso: Gem,
}

export function Step1Briefing() {
  const nav = useNavigate()
  const b = useApp((s) => s.briefing)
  const brand = useApp((s) => s.brand)
  const set = useApp((s) => s.setBriefing)
  const save = useApp((s) => s.saveBriefingToBrand)
  const markDone = useApp((s) => s.markDone)
  const look = useLook()
  const [tried, setTried] = useState(false)
  const [tab, setTab] = useState<'posts' | 'stories' | 'legendas'>('posts')
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const palette = derivePalette(b.colors)
  const ex = useExamples({ segment: b.segment, tones: b.tones, style: b.visualStyle, palette, brandName: brand.name, handle: brand.handle, city: b.location || brand.city })
  const mark = look.brand

  const errors = {
    about: !b.about.trim(),
    segment: !b.segment,
    objectives: b.objectives.length === 0,
    audience: !b.audience.trim(),
    topics: !b.topics.trim(),
    tones: b.tones.length === 0,
    formats: !b.posts && !b.stories,
  }
  const invalid = Object.values(errors).some(Boolean)
  const err = (k: keyof typeof errors) => tried && errors[k]

  const fillExample = () => {
    const seg = segmentDef((b.segment || brand.segment || 'beleza') as SegmentId)
    set({
      about: b.about || seg.example,
      segment: b.segment || seg.id,
      location: b.location || brand.city || 'Palmas - TO',
      objectives: b.objectives.length ? b.objectives : ['Atrair novos clientes', 'Fortalecer a marca'],
      audience: b.audience || 'Adultos de 25 a 45 anos da região, que valorizam qualidade, atendimento próximo e praticidade.',
      topics: b.topics || 'Dicas, bastidores, depoimentos de clientes, novidades e promoções.',
    })
    toast('Exemplo preenchido. Ajuste o que quiser.', 'info')
  }

  const submit = () => {
    setTried(true)
    if (invalid) {
      toast('Preencha os campos obrigatórios marcados com *', 'info')
      formRef.current?.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setBusy(true)
    setTimeout(() => {
      save()
      markDone(1)
      nav('/app/criar/2')
    }, 450)
  }

  const toggleObjective = (o: string) => set({ objectives: b.objectives.includes(o) ? b.objectives.filter((x) => x !== o) : [...b.objectives, o] })
  const toggleTone = (t: ToneId) => set({ tones: b.tones.includes(t) ? b.tones.filter((x) => x !== t) : [...b.tones, t] })

  const captions = [...ex.posts, ex.stories[0]].filter(Boolean)
  const cap = captions[page % captions.length]

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <Panel>
        <form ref={formRef} onSubmit={(e) => (e.preventDefault(), submit())} noValidate>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">1. Briefing estratégico</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={fillExample} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-800">
                <Wand2 className="size-3.5" /> Preencher com exemplo
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[13px] font-semibold text-brand-700">
                <CheckCircle2 className="size-3.5" /> Preencha para melhores resultados
              </span>
            </div>
          </div>

          <div className="grid gap-5">
            <div>
              <Label htmlFor="b-about" required>
                Sobre o seu negócio
              </Label>
              <Textarea
                id="b-about"
                aria-invalid={err('about')}
                max={500}
                value={b.about}
                onChange={(e) => set({ about: e.target.value })}
                placeholder="Descreva o que sua empresa faz, seus produtos ou serviços, diferencial e público que atende."
                className={cx(err('about') && 'border-red-300')}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="b-seg" required>
                  Segmento
                </Label>
                <Select id="b-seg" aria-invalid={err('segment')} value={b.segment} onChange={(e) => set({ segment: e.target.value as SegmentId })} className={cx(err('segment') && 'border-red-300')}>
                  <option value="">Selecione o segmento</option>
                  {SEGMENT_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                {b.segment === 'outro' && <Input id="b-seg-other" className="mt-2" placeholder="Qual é o seu segmento?" value={b.segmentOther} onChange={(e) => set({ segmentOther: e.target.value })} />}
              </div>
              <div>
                <Label htmlFor="b-loc">Localização</Label>
                <Input id="b-loc" icon={<MapPin className="size-4" />} placeholder="Ex: Palmas - TO" value={b.location} onChange={(e) => set({ location: e.target.value })} />
              </div>
            </div>

            <div aria-invalid={err('objectives')}>
              <Label required>Seus objetivos com este conteúdo</Label>
              <div className={cx('flex flex-wrap gap-x-6 gap-y-3 rounded-xl', err('objectives') && 'ring-2 ring-red-200 ring-offset-4')}>
                {BRIEFING_OBJECTIVES.map((o, i) => (
                  <Checkbox key={o} id={`b-obj-${i}`} checked={b.objectives.includes(o)} onChange={() => toggleObjective(o)} label={o} />
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="b-aud" required>
                Público-alvo
              </Label>
              <Textarea
                id="b-aud"
                aria-invalid={err('audience')}
                max={300}
                value={b.audience}
                onChange={(e) => set({ audience: e.target.value })}
                placeholder="Descreva o perfil do seu cliente ideal (idade, interesses, comportamentos, etc)."
                className={cx(err('audience') && 'border-red-300')}
              />
            </div>

            <div>
              <Label htmlFor="b-top" required>
                Temas que deseja abordar
              </Label>
              <Textarea
                id="b-top"
                aria-invalid={err('topics')}
                max={300}
                value={b.topics}
                onChange={(e) => set({ topics: e.target.value })}
                placeholder="Ex: dicas, curiosidades, depoimentos, bastidores, promoções, etc."
                className={cx('min-h-[70px]', err('topics') && 'border-red-300')}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div aria-invalid={err('tones')}>
                <Label required>Tom de comunicação</Label>
                <div className={cx('flex flex-wrap gap-2 rounded-xl', err('tones') && 'ring-2 ring-red-200 ring-offset-4')}>
                  {TONES.map((t) => {
                    const I = TONE_ICON[t.id]
                    return (
                      <Chip key={t.id} active={b.tones.includes(t.id)} onClick={() => toggleTone(t.id)} icon={<I className="size-4 text-slate-400" />}>
                        {t.label}
                      </Chip>
                    )
                  })}
                </div>
              </div>
              <div>
                <Label htmlFor="b-style">Estilo visual preferido</Label>
                <Select id="b-style" value={b.visualStyle} onChange={(e) => set({ visualStyle: e.target.value as StyleId })}>
                  {STYLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} — {s.desc.toLowerCase()}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <Label hint="(até 5, toque para editar o HEX)">Cores da sua marca</Label>
                <ColorSwatches colors={b.colors} onChange={(colors) => set({ colors })} />
              </div>
              <div>
                <Label htmlFor="b-ref" hint="(opcional)">
                  Referências
                </Label>
                <Input id="b-ref" icon={<Link2 className="size-4" />} placeholder="Cole links do Instagram, sites ou marcas que você gosta." value={b.references} onChange={(e) => set({ references: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="mt-7 border-t border-line pt-5">
            <Toggle on={b.posts && b.stories} onChange={(v) => set({ posts: v || b.posts, stories: v })} label="Gerar posts e stories" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-[1fr_1fr_1.15fr]">
              {[
                { k: 'posts' as const, title: 'Posts para feed', sub: 'Artes, legendas e hashtags', icon: <InstagramIcon className="size-7" /> },
                { k: 'stories' as const, title: 'Stories', sub: 'Sequência de stories', icon: <StoriesIcon className="size-7 text-ink" /> },
              ].map((f) => (
                <button
                  key={f.k}
                  type="button"
                  onClick={() => set({ [f.k]: !b[f.k] })}
                  className={cx('flex items-center gap-3 rounded-xl border p-3.5 text-left transition', b[f.k] ? 'border-brand-400 bg-brand-50/50' : 'border-line hover:border-slate-300', err('formats') && 'border-red-300')}
                  aria-pressed={b[f.k]}
                >
                  {f.icon}
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-sm font-semibold">{f.title}</span>
                    <span className="block truncate text-xs text-slate-500">{f.sub}</span>
                  </span>
                  <span className={cx('grid size-5 place-items-center rounded-md border', b[f.k] ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300')}>
                    {b[f.k] && <CheckCircle2 className="size-4" />}
                  </span>
                </button>
              ))}
              <Button type="submit" size="lg" loading={busy} className="h-auto min-h-14 sm:col-span-2 2xl:col-span-1">
                Gerar conteúdo com IA <Sparkles className="size-5 text-amber-300" /> <ArrowRight className="size-5" />
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Campos com * são obrigatórios. O briefing fica salvo na sua marca.</span>
              <button
                type="button"
                onClick={() => {
                  save()
                  toast('Briefing salvo em Minha marca')
                }}
                className="inline-flex items-center gap-1.5 font-semibold text-brand-700"
              >
                <Save className="size-3.5" /> Salvar briefing
              </button>
            </div>
          </div>
        </form>
      </Panel>

      <PreviewPanel className="xl:sticky xl:top-[100px] xl:self-start">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Pré-visualização do que será gerado</h2>
          {!b.segment && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-line">Exemplo</span>}
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          className="bg-white ring-1 ring-line"
          items={[
            { id: 'posts', label: 'Posts para feed', icon: <InstagramIcon className="size-4" /> },
            { id: 'stories', label: 'Stories', icon: <StoriesIcon className="size-4" /> },
            { id: 'legendas', label: 'Legendas', icon: <FileText className="size-4" /> },
          ]}
        />
        <div className="mt-4">
          {tab === 'posts' && (
            <div className="grid grid-cols-3 gap-3">
              {ex.posts.slice(0, 3).map((c) => (
                <div key={c.id} className="overflow-hidden rounded-xl shadow-card">
                  <Creative c={c} style={b.visualStyle} palette={palette} format="4:5" brand={mark} />
                </div>
              ))}
            </div>
          )}
          {tab === 'stories' && (
            <div className="grid grid-cols-4 gap-2.5">
              {ex.stories.map((c) => (
                <div key={c.id} className="overflow-hidden rounded-xl shadow-card">
                  <Creative c={c} style={b.visualStyle} palette={palette} format="4:5" brand={mark} />
                </div>
              ))}
            </div>
          )}
          {tab === 'legendas' && cap && (
            <div className="rounded-xl border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  {cap.kind === 'story' ? 'Stories' : `Post ${(page % captions.length) + 1}`} de {captions.length}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => (p + captions.length - 1) % captions.length)} className="grid size-8 place-items-center rounded-lg border border-line" aria-label="Anterior">
                    <ChevronLeft className="size-4" />
                  </button>
                  <button onClick={() => setPage((p) => p + 1)} className="grid size-8 place-items-center rounded-lg border border-line" aria-label="Próxima">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{cap.caption}</p>
              <p className="mt-3 text-sm font-medium text-brand-700">{cap.hashtags.join(' ')}</p>
              <button onClick={async () => (await copyText(`${cap.caption}\n\n${cap.hashtags.join(' ')}`)) && toast('Legenda copiada')} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-ink">
                <Copy className="size-3.5" /> Copiar
              </button>
            </div>
          )}
        </div>
        <div className="mt-5 rounded-xl border border-line bg-white p-5">
          <h3 className="flex items-center gap-2 font-bold">
            <Sparkles className="size-5 text-brand-600" /> O que você receberá
          </h3>
          <ul className="mt-3 grid gap-x-6 gap-y-2 text-[13.5px] text-slate-600 sm:grid-cols-2">
            {['Artes personalizadas para feed', 'Sequência de stories estratégicos', 'Legendas prontas', 'Hashtags relevantes', 'Sugestões de CTA', 'Conteúdo alinhado com seu objetivo', 'Visual seguindo sua identidade de marca', 'Tudo pronto para usar ou editar'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-brand-600" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </PreviewPanel>
    </div>
  )
}
