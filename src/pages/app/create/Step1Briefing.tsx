import {
  AlertCircle,
  ArrowRight,
  AtSign,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dog,
  Dumbbell,
  FileText,
  Gem,
  HeartPulse,
  Home,
  Link2,
  MapPin,
  Minus,
  MoreHorizontal,
  PartyPopper,
  Save,
  Scissors,
  Shirt,
  Smile,
  Sparkles,
  Store,
  Tag,
  UtensilsCrossed,
  Wand2,
  Wrench,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../../components/creative/Creative'
import { ColorSwatches, useLook } from '../../../components/creative/parts'
import { Button, ChoiceGroup, cx, Field, IconButton, InstagramIcon, Input, StoriesIcon, TabPanel, Tabs, Textarea, toast, useIsDesktop } from '../../../components/ui'
import { derivePalette } from '../../../lib/color'
import { BRIEFING_OBJECTIVES, SEGMENT_OPTIONS, segmentDef, STYLES, TONES } from '../../../lib/data'
import { copyText } from '../../../lib/export'
import { useApp } from '../../../lib/store'
import type { Palette, SegmentId, StyleId, ToneId } from '../../../lib/types'
import { FlowActions, FlowLayout, useExamples } from './shared'

export const TONE_ICON: Record<string, typeof Smile> = {
  profissional: Briefcase, descontraido: Smile, inspirador: Sparkles, educativo: BookOpen, vendedor: Tag, divertido: PartyPopper, minimalista: Minus, luxuoso: Gem,
}
const SEGMENT_ICON: Record<string, typeof Smile> = {
  beleza: Scissors, alimentacao: UtensilsCrossed, fitness: Dumbbell, saude: HeartPulse, imoveis: Home, pet: Dog, servicos: Wrench, moda: Shirt, outro: MoreHorizontal,
}

type SectionId = 'negocio' | 'publico' | 'voz'
type ErrKey = 'about' | 'segment' | 'objectives' | 'audience' | 'topics' | 'tones' | 'formats'

/** Where each error lives (section + element to focus) and its message. */
const ERR: Record<ErrKey, { section: SectionId; target: string; label: string; msg: string }> = {
  about: { section: 'negocio', target: 'b-about', label: 'Sobre o seu negócio', msg: 'Conte em poucas linhas o que sua empresa faz.' },
  segment: { section: 'negocio', target: 'b-seg', label: 'Segmento', msg: 'Escolha o segmento do seu negócio.' },
  objectives: { section: 'publico', target: 'b-obj', label: 'Objetivos', msg: 'Marque pelo menos um objetivo.' },
  audience: { section: 'publico', target: 'b-aud', label: 'Público-alvo', msg: 'Descreva quem é o seu cliente ideal.' },
  topics: { section: 'publico', target: 'b-top', label: 'Temas', msg: 'Liste alguns temas que você quer abordar.' },
  tones: { section: 'voz', target: 'b-tone', label: 'Tom de comunicação', msg: 'Escolha pelo menos um tom.' },
  formats: { section: 'voz', target: 'b-fmt', label: 'Formatos', msg: 'Escolha posts, Stories ou os dois.' },
}

function Section({
  id,
  title,
  status,
  open,
  collapsible,
  onToggle,
  children,
}: {
  id: SectionId
  title: string
  status: { done: boolean; text: string }
  open: boolean
  collapsible: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const head = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-ink">{title}</span>
        <span className={cx('mt-0.5 flex items-center gap-1 text-xs font-medium', status.done ? 'text-brand-800' : 'text-fg-subtle')}>
          {status.done && <CheckCircle2 className="size-3.5" aria-hidden />} {status.text}
        </span>
      </span>
      {collapsible && <ChevronDown className={cx('size-5 shrink-0 text-slate-600 transition', open && 'rotate-180')} aria-hidden />}
    </>
  )
  return (
    <section className="rounded-2xl border border-line bg-white shadow-card">
      <h3 className="text-base">
        {collapsible ? (
          <button type="button" id={`sec-${id}-h`} aria-expanded={open} aria-controls={`sec-${id}`} onClick={onToggle} className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 text-left sm:px-6">
            {head}
          </button>
        ) : (
          <span id={`sec-${id}-h`} className="flex min-h-16 items-center gap-3 px-4 pt-2 sm:px-6">
            {head}
          </span>
        )}
      </h3>
      <div id={`sec-${id}`} role="region" aria-labelledby={`sec-${id}-h`} hidden={!open} className="grid gap-5 px-4 pt-1 pb-5 sm:px-6 sm:pb-6">
        {children}
      </div>
    </section>
  )
}

export function Step1Briefing() {
  const nav = useNavigate()
  const b = useApp((s) => s.briefing)
  const brand = useApp((s) => s.brand)
  const set = useApp((s) => s.setBriefing)
  const setBrand = useApp((s) => s.setBrand)
  const save = useApp((s) => s.saveBriefingToBrand)
  const markDone = useApp((s) => s.markDone)
  const look = useLook()
  const desktop = useIsDesktop()
  const [tried, setTried] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [touched, setTouched] = useState<Partial<Record<ErrKey, boolean>>>({})
  const [openSec, setOpenSec] = useState<SectionId>('negocio')
  const [busy, setBusy] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  const palette = derivePalette(b.colors)
  const errors: Record<ErrKey, boolean> = {
    about: !b.about.trim(),
    segment: !b.segment,
    objectives: b.objectives.length === 0,
    audience: !b.audience.trim(),
    topics: !b.topics.trim(),
    tones: b.tones.length === 0,
    formats: !b.posts && !b.stories,
  }
  const invalid = (Object.keys(errors) as ErrKey[]).filter((k) => errors[k])
  const err = (k: ErrKey) => ((tried || touched[k]) && errors[k] ? ERR[k].msg : undefined)
  const blur = (k: ErrKey) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }))
  const groupBlur = (k: ErrKey) => (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) blur(k)()
  }

  const secStatus = (id: SectionId) => {
    const pending = invalid.filter((k) => ERR[k].section === id).length
    return pending ? { done: false, text: pending === 1 ? '1 campo obrigatório pendente' : `${pending} campos obrigatórios pendentes` } : { done: true, text: 'Completo' }
  }
  const isOpen = (id: SectionId) => desktop || openSec === id

  const focusField = (k: ErrKey) => {
    setOpenSec(ERR[k].section)
    requestAnimationFrame(() => {
      const el = document.getElementById(ERR[k].target)
      const target = el?.matches('fieldset') ? el.querySelector<HTMLElement>('input') : el
      target?.focus()
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  // Each failed submit moves focus to the error summary.
  useEffect(() => {
    if (attempt) summaryRef.current?.focus()
  }, [attempt])

  const fillExample = () => {
    const seg = segmentDef((b.segment || brand.segment || 'beleza') as SegmentId)
    set({
      about: b.about || seg.example,
      segment: b.segment || seg.id,
      location: b.location || brand.city || 'Palmas - TO',
      objectives: b.objectives.length ? b.objectives : ['Atrair novos clientes', 'Fortalecer a marca'],
      audience: b.audience || 'Adultos de 25 a 45 anos da região, que valorizam qualidade, atendimento próximo e praticidade.',
      topics: b.topics || 'Dicas, bastidores, depoimentos de clientes, novidades e promoções.',
      tones: b.tones.length ? b.tones : ['profissional'],
    })
    toast('Dados de exemplo preenchidos. Ajuste o que quiser.', 'info')
  }

  const submit = () => {
    setTried(true)
    if (invalid.length) {
      setAttempt((a) => a + 1)
      return
    }
    setBusy(true)
    save()
    markDone(1)
    nav('/app/criar/2')
  }

  const ex = useExamples({ segment: b.segment, tones: b.tones, style: b.visualStyle, palette, brandName: brand.name, handle: brand.handle, city: b.location || brand.city })

  return (
    <FlowLayout
      previewTitle="Prévia do que será gerado"
      previewAction={!b.segment ? <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-fg-subtle ring-1 ring-line">Exemplo</span> : undefined}
      preview={<BriefingPreview ex={ex} style={b.visualStyle} palette={palette} brand={look.brand} />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        noValidate
        aria-labelledby="step1-title"
        className="grid gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="step1-title" className="text-title font-bold">
              Briefing estratégico
            </h2>
            <p className="mt-0.5 text-sm text-fg-subtle">Três blocos rápidos. Campos com * são obrigatórios.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={fillExample}>
            <Wand2 className="size-4" aria-hidden /> Preencher com dados de exemplo
          </Button>
        </div>

        {tried && invalid.length > 0 && (
          <div ref={summaryRef} tabIndex={-1} aria-labelledby="err-summary-title" className="rounded-2xl border-2 border-danger bg-danger-soft p-4 outline-none">
            <h3 id="err-summary-title" className="flex items-center gap-2 font-bold text-danger">
              <AlertCircle className="size-5" aria-hidden /> {invalid.length === 1 ? 'Falta 1 item para continuar' : `Faltam ${invalid.length} itens para continuar`}
            </h3>
            <ul className="mt-2 grid gap-1 text-sm">
              {invalid.map((k) => (
                <li key={k}>
                  <button type="button" onClick={() => focusField(k)} className="min-h-10 text-left font-semibold text-danger underline underline-offset-2">
                    {ERR[k].label}: {ERR[k].msg}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Section id="negocio" title="1. Seu negócio" status={secStatus('negocio')} open={isOpen('negocio')} collapsible={!desktop} onToggle={() => setOpenSec('negocio')}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nome do negócio">
              <Input value={brand.name} onChange={(e) => setBrand({ name: e.target.value })} icon={<Store className="size-4" />} autoComplete="organization" />
            </Field>
            <Field label="Instagram" hint="Sem o @">
              <Input
                value={brand.handle}
                onChange={(e) => setBrand({ handle: e.target.value.replace(/^@/, '').replace(/\s/g, '') })}
                icon={<AtSign className="size-4" />}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>
          </div>
          <div onBlur={groupBlur('segment')}>
            <ChoiceGroup
              id="b-seg"
              legend="Segmento"
              required
              variant="chip"
              value={b.segment}
              onChange={(v) => set({ segment: v as SegmentId })}
              error={err('segment')}
              options={SEGMENT_OPTIONS.map((s) => {
                const I = SEGMENT_ICON[s.id] ?? MoreHorizontal
                return { value: s.id, label: s.label, icon: <I className="size-4 text-slate-600" aria-hidden /> }
              })}
            />
            {b.segment === 'outro' && (
              <Field label="Qual é o seu segmento?" className="mt-3">
                <Input value={b.segmentOther} onChange={(e) => set({ segmentOther: e.target.value })} />
              </Field>
            )}
          </div>
          <Field label="Cidade / região" hint="Ajuda a IA a falar com quem está perto de você.">
            <Input icon={<MapPin className="size-4" />} placeholder="Ex.: Palmas - TO" autoComplete="address-level2" value={b.location} onChange={(e) => set({ location: e.target.value })} />
          </Field>
          <Field id="b-about" label="Sobre o seu negócio" required error={err('about')}>
            <Textarea
              max={500}
              value={b.about}
              onBlur={blur('about')}
              onChange={(e) => set({ about: e.target.value })}
              placeholder="O que sua empresa faz, produtos ou serviços, diferenciais e quem você atende."
            />
          </Field>
          {!desktop && (
            <Button variant="soft" onClick={() => setOpenSec('publico')} className="justify-self-start">
              Próximo bloco: público <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </Section>

        <Section id="publico" title="2. Público e objetivos" status={secStatus('publico')} open={isOpen('publico')} collapsible={!desktop} onToggle={() => setOpenSec('publico')}>
          <div onBlur={groupBlur('objectives')}>
            <ChoiceGroup
              id="b-obj"
              type="checkbox"
              legend="Seus objetivos com este conteúdo"
              required
              variant="chip"
              value={b.objectives}
              onChange={(v) => set({ objectives: v })}
              error={err('objectives')}
              options={BRIEFING_OBJECTIVES.map((o) => ({ value: o, label: o }))}
            />
          </div>
          <Field id="b-aud" label="Público-alvo" required error={err('audience')}>
            <Textarea max={300} value={b.audience} onBlur={blur('audience')} onChange={(e) => set({ audience: e.target.value })} placeholder="Idade, interesses, comportamentos do seu cliente ideal." />
          </Field>
          <Field id="b-top" label="Temas que deseja abordar" required error={err('topics')}>
            <Textarea max={300} value={b.topics} onBlur={blur('topics')} onChange={(e) => set({ topics: e.target.value })} placeholder="Ex.: dicas, curiosidades, depoimentos, bastidores, promoções." className="min-h-[80px]" />
          </Field>
          {!desktop && (
            <Button variant="soft" onClick={() => setOpenSec('voz')} className="justify-self-start">
              Próximo bloco: voz e marca <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </Section>

        <Section id="voz" title="3. Voz e marca" status={secStatus('voz')} open={isOpen('voz')} collapsible={!desktop} onToggle={() => setOpenSec('voz')}>
          <div onBlur={groupBlur('tones')}>
            <ChoiceGroup
              id="b-tone"
              type="checkbox"
              legend="Tom de comunicação"
              required
              variant="chip"
              value={b.tones}
              onChange={(v) => set({ tones: v as ToneId[] })}
              error={err('tones')}
              options={TONES.map((t) => {
                const I = TONE_ICON[t.id]
                return { value: t.id, label: t.label, icon: <I className="size-4 text-slate-600" aria-hidden /> }
              })}
            />
          </div>
          <ChoiceGroup
            legend="Estilo visual preferido"
            hint="Você pode trocar e ver a prévia na etapa Estilo."
            variant="chip"
            value={b.visualStyle}
            onChange={(v) => set({ visualStyle: v as StyleId })}
            options={STYLES.map((s) => ({ value: s.id, label: s.label }))}
          />
          <div>
            <p id="b-colors" className="mb-2 text-sm font-semibold text-ink">
              Cores da sua marca <span className="font-normal text-fg-subtle">(até 5)</span>
            </p>
            <ColorSwatches colors={b.colors} onChange={(colors) => set({ colors })} labelledBy="b-colors" />
          </div>
          <Field label="Referências" hint="Opcional: links do Instagram, sites ou marcas que você admira.">
            <Input icon={<Link2 className="size-4" />} inputMode="url" value={b.references} onChange={(e) => set({ references: e.target.value })} />
          </Field>
          <div onBlur={groupBlur('formats')}>
            <ChoiceGroup
              id="b-fmt"
              type="checkbox"
              legend="O que gerar"
              required
              value={[...(b.posts ? ['posts' as const] : []), ...(b.stories ? ['stories' as const] : [])]}
              onChange={(v) => set({ posts: v.includes('posts'), stories: v.includes('stories') })}
              error={err('formats')}
              options={[
                { value: 'posts', label: 'Posts para feed', description: 'Artes, legendas e hashtags', icon: <InstagramIcon className="size-7 shrink-0" /> },
                { value: 'stories', label: 'Stories', description: 'Sequência de 4 telas', icon: <StoriesIcon className="size-7 shrink-0 text-ink" /> },
              ]}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() => {
              save()
              toast('Briefing salvo em Minha marca')
            }}
          >
            <Save className="size-4" aria-hidden /> Salvar briefing na marca
          </Button>
        </Section>

        <FlowActions
          onBack={() => nav('/app')}
          backLabel="Sair"
          primaryLabel="Continuar"
          primaryIcon={<ArrowRight className="size-5" aria-hidden />}
          loading={busy}
          blockedReason={tried && invalid.length ? (invalid.length === 1 ? 'Falta 1 item obrigatório' : `Faltam ${invalid.length} itens obrigatórios`) : undefined}
          onBlocked={submit}
          onPrimary={submit}
        />
      </form>
    </FlowLayout>
  )
}

function BriefingPreview({ ex, style, palette, brand }: { ex: ReturnType<typeof useExamples>; style: StyleId; palette: Palette; brand: ReturnType<typeof useLook>['brand'] }) {
  const [tab, setTab] = useState<'posts' | 'stories' | 'legendas'>('posts')
  const [page, setPage] = useState(0)
  const captions = [...ex.posts, ex.stories[0]].filter(Boolean)
  const cap = captions[page % captions.length]
  return (
    <>
      <Tabs
        idBase="b1prev"
        label="Tipo de prévia"
        value={tab}
        onChange={setTab}
        className="bg-white ring-1 ring-line"
        items={[
          { id: 'posts', label: 'Posts', icon: <InstagramIcon className="size-4" /> },
          { id: 'stories', label: 'Stories', icon: <StoriesIcon className="size-4" /> },
          { id: 'legendas', label: 'Legendas', icon: <FileText className="size-4" aria-hidden /> },
        ]}
      />
      <TabPanel idBase="b1prev" id="posts" active={tab === 'posts'} className="mt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ex.posts.slice(0, 3).map((c) => (
            <div key={c.id} className="overflow-hidden rounded-xl shadow-card">
              <Creative c={c} style={style} palette={palette} format="4:5" brand={brand} />
            </div>
          ))}
        </div>
      </TabPanel>
      <TabPanel idBase="b1prev" id="stories" active={tab === 'stories'} className="mt-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {ex.stories.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-xl shadow-card">
              <Creative c={c} style={style} palette={palette} format="4:5" brand={brand} />
            </div>
          ))}
        </div>
      </TabPanel>
      <TabPanel idBase="b1prev" id="legendas" active={tab === 'legendas'} className="mt-4">
        {cap && (
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-fg-subtle" aria-live="polite">
                {cap.kind === 'story' ? 'Stories' : `Post ${(page % captions.length) + 1}`} de {captions.length}
              </span>
              <div className="flex gap-1">
                <IconButton size="sm" variant="secondary" label="Legenda anterior" onClick={() => setPage((p) => (p + captions.length - 1) % captions.length)}>
                  <ChevronLeft className="size-4" aria-hidden />
                </IconButton>
                <IconButton size="sm" variant="secondary" label="Próxima legenda" onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="size-4" aria-hidden />
                </IconButton>
              </div>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{cap.caption}</p>
            <p className="mt-3 text-sm font-medium text-brand-800">{cap.hashtags.join(' ')}</p>
            <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={async () => (await copyText(`${cap.caption}\n\n${cap.hashtags.join(' ')}`)) && toast('Legenda copiada')}>
              <Copy className="size-4" aria-hidden /> Copiar legenda
            </Button>
          </div>
        )}
      </TabPanel>
      <div className="mt-5 rounded-xl border border-line bg-white p-4">
        <h3 className="flex items-center gap-2 font-bold">
          <Sparkles className="size-5 text-brand-700" aria-hidden /> O que você vai receber
        </h3>
        <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm text-slate-700 sm:grid-cols-2">
          {['4 artes para o feed', 'Sequência de 4 Stories', 'Legendas prontas', 'Hashtags relevantes', 'Chamadas para ação', 'Visual com a sua identidade'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-brand-700" aria-hidden /> {t}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
