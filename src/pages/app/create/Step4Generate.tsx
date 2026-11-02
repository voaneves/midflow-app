import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  FolderPlus,
  Hash,
  ListChecks,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
  WifiOff,
  X,
  ZoomIn,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HeaderAction } from '../../../components/AppLayout'
import { Creative } from '../../../components/creative/Creative'
import { CreativeViewer } from '../../../components/creative/CreativeViewer'
import { LazyEditor as Editor } from '../../../components/creative/LazyEditor'
import { CreativeTile, exportCreatives, jobFor, PhoneMockup, tileMenu, useLook, type Look } from '../../../components/creative/parts'
import { SocialPublishModal } from '../../../components/creative/SocialPublishModal'
import { StoryPlayer } from '../../../components/creative/StoryPlayer'
import {
  ActionBar,
  Button,
  ChoiceGroup,
  cx,
  Dialog,
  ErrorState,
  Field,
  IconButton,
  InstagramIcon,
  Input,
  Menu,
  Select,
  Skeleton,
  StoriesIcon,
  TabPanel,
  Tabs,
  toast,
  type MenuItem,
} from '../../../components/ui'
import { generateCustomImageWithAI } from '../../../lib/aiService'
import { copyText } from '../../../lib/export'
import { getSocialTips } from '../../../lib/social'
import { paramsFrom, useActiveGen, useApp } from '../../../lib/store'
import { engineLabel, sendFeedback, track } from '../../../lib/telemetry'
import type { Creative as CreativeT, Generation } from '../../../lib/types'

/**
 * Real stages only. The server writes the copy and runs the quality gate in one request, so the middle
 * stage stays active until the response arrives; nothing is marked done before it actually is.
 */
const STAGES = [
  { done: 'Briefing enviado', active: 'Enviando briefing' },
  { done: 'Textos criados e revisados', active: 'A IA está escrevendo e revisando textos, legendas e hashtags' },
  { done: 'Artes montadas', active: 'Montar as artes com as cores da sua marca' },
]

/** Progress tied to the real request: elapsed time, the current stage, and a Cancel button. */
function Generating({ version, onCancel }: { version: number; onCancel: () => void }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const s = setInterval(() => setSecs((x) => x + 1), 1000)
    return () => clearInterval(s)
  }, [])
  const current = 1 // request sent; waiting for the server
  return (
    <section aria-labelledby="gen-title" className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <div className="relative mx-auto grid size-20 place-items-center" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-brand-200/60 motion-reduce:hidden" />
            <span className="relative grid size-20 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-cta">
              <Sparkles className="size-9" />
            </span>
          </div>
          <h2 id="gen-title" className="mt-6 text-title font-bold">
            {version > 1 ? `Criando a versão ${version}…` : 'Criando seu conteúdo…'}
          </h2>
          <p role="status" className="sr-only">
            Gerando conteúdo. Isso pode levar alguns segundos.
          </p>
        </div>
        <ol className="mt-6 grid gap-3 text-sm">
          {STAGES.map((st, i) => {
            const state = i < current ? 'done' : i === current ? 'active' : 'todo'
            return (
              <li key={st.done} className="flex items-start gap-3" aria-current={state === 'active' ? 'step' : undefined}>
                {state === 'done' ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
                ) : state === 'active' ? (
                  <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-brand-700 motion-reduce:animate-none" aria-hidden />
                ) : (
                  <span className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-slate-300" aria-hidden />
                )}
                <span className={cx(state === 'done' && 'text-fg-muted', state === 'active' && 'font-semibold text-ink', state === 'todo' && 'text-fg-subtle')}>
                  {state === 'done' ? st.done : st.active}
                  <span className="sr-only">{state === 'done' ? ' (concluído)' : state === 'active' ? ' (em andamento)' : ' (a seguir)'}</span>
                </span>
              </li>
            )
          })}
        </ol>
        <p className="mt-5 text-center text-xs text-fg-subtle tabular-nums">
          {secs < 20 ? `${secs} s · costuma levar de 10 a 30 segundos.` : `Ainda trabalhando (${secs} s). Conexões lentas podem demorar mais.`}
        </p>
        <div className="mt-5 text-center">
          <Button variant="secondary" onClick={onCancel}>
            <X className="size-4" aria-hidden /> Cancelar
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Placeholder in the exact geometry of the results grid (no layout shift when cards arrive). */
function ResultsSkeleton({ ratio }: { ratio: '1:1' | '4:5' }) {
  return (
    <div className="mt-5" aria-hidden>
      <Skeleton className="h-11 w-full max-w-md" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        {[0, 1, 2, 3].map((k) => (
          <div key={k}>
            <Skeleton className={cx('w-full', ratio === '1:1' ? 'aspect-square' : 'aspect-[4/5]')} />
            <Skeleton className="mt-2 h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ScheduleDialog({ open, onClose, items, themeLabel }: { open: boolean; onClose: () => void; items: CreativeT[]; themeLabel: string }) {
  const brand = useApp((s) => s.brand)
  const scheduleCreative = useApp((s) => s.scheduleCreative)
  const tips = getSocialTips(brand.segment)
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  const [date, setDate] = useState(tomorrow)
  const [time, setTime] = useState(tips.bestHours[0] || '11:30')
  const [notes, setNotes] = useState('')
  const [network, setNetwork] = useState<'instagram' | 'whatsapp' | 'facebook' | 'todas'>('instagram')

  const confirm = () => {
    items.forEach((c) => scheduleCreative({ creative: c, date, time, status: 'agendado', notes: notes || `Agendado via MIDFLOW — ${themeLabel}`, network, themeLabel }))
    toast(items.length === 1 ? 'Conteúdo agendado no Calendário' : `${items.length} conteúdos agendados no Calendário`)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Agendar no Calendário"
      description={`${items.length} ${items.length === 1 ? 'criativo' : 'criativos'}`}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={!items.length || !date || !time}>
            <CalendarClock className="size-4" aria-hidden /> Confirmar agendamento
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 px-5 py-4 md:px-6">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Horário" required>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <ChoiceGroup
          legend="Melhores horários do seu segmento"
          variant="chip"
          value={tips.bestHours.includes(time) ? time : ''}
          onChange={setTime}
          options={tips.bestHours.map((h) => ({ value: h, label: h }))}
        />
        <Field label="Rede social principal">
          <Select value={network} onChange={(e) => setNetwork(e.target.value as typeof network)}>
            <option value="instagram">Instagram (Feed e Stories)</option>
            <option value="whatsapp">WhatsApp Business (Status)</option>
            <option value="facebook">Facebook</option>
            <option value="todas">Todas as redes</option>
          </Select>
        </Field>
        <Field label="Notas ou lembretes" hint="Opcional. Ex.: impulsionar com R$ 20.">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

function sameParams(a: Generation['params'], b: Generation['params']) {
  const pick = (p: Generation['params']) => JSON.stringify([p.segment, p.themeId, p.customTheme, p.objective, p.tones, p.style, p.palette, p.postFormat, p.posts, p.stories, p.brandName])
  return pick(a) === pick(b)
}

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'cancelled' }
type TabId = 'posts' | 'stories' | 'legendas'

export function Step4Generate() {
  const nav = useNavigate()
  const loc = useLocation()
  const state = useApp()
  const gen = useActiveGen()
  const { generations, runGeneration, setActiveGen, updateCreative, removeCreative, duplicateCreative, reorderStories, saveToLibrary } = state
  const base = useLook()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [selecting, setSelecting] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'feed' | 'story'>('feed')
  const [editing, setEditing] = useState<CreativeT | null>(null)
  const [viewer, setViewer] = useState<{ list: 'posts' | 'stories'; index: number } | null>(null)
  const [publishing, setPublishing] = useState<CreativeT | null>(null)
  const [seqOpen, setSeqOpen] = useState(false)
  const [schedOpen, setSchedOpen] = useState(false)
  const [qualityOpen, setQualityOpen] = useState(false)
  const [tab, setTab] = useState<TabId>('posts')
  const started = useRef(false)

  const start = async (opts: { offline?: boolean } = {}) => {
    const ctl = new AbortController()
    abort.current = ctl
    setStatus({ kind: 'loading' })
    try {
      const g = await runGeneration(undefined, { signal: ctl.signal, offline: opts.offline })
      setSel(new Set())
      setSelecting(false)
      setFocus(g.posts[0]?.id ?? g.stories[0]?.id ?? null)
      setTab(g.posts.length ? 'posts' : 'stories')
      setStatus({ kind: 'idle' })
      if (g.version > 1) track('new_version', { generationId: g.id, brandName: g.params.brandName })
      const { label, isAI } = engineLabel(g.engine)
      toast(isAI ? (g.version > 1 ? `Versão ${g.version} criada com IA` : 'Conteúdo pronto, criado com IA') : `Conteúdo criado com ${label.toLowerCase()}. Revise os textos antes de publicar.`, isAI ? 'ok' : 'info')
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setStatus(gen ? { kind: 'idle' } : { kind: 'cancelled' })
        toast('Geração cancelada', 'info')
      } else {
        console.error(err)
        setStatus({ kind: 'error', message: (err as Error)?.message || 'Houve um problema ao gerar o conteúdo.' })
      }
    } finally {
      abort.current = null
    }
  }

  useEffect(() => {
    const auto = (loc.state as { autoGenerate?: boolean } | null)?.autoGenerate || generations.length === 0
    if (!started.current && auto) {
      started.current = true
      // drop the flag so a page refresh does not generate (and spend) again
      if ((loc.state as { autoGenerate?: boolean } | null)?.autoGenerate) nav(loc.pathname, { replace: true, state: null })
      start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const look: Look = useMemo(() => (gen ? { palette: gen.params.palette, style: gen.params.style, format: gen.params.postFormat, brand: base.brand } : base), [gen, base])
  const all = useMemo(() => (gen ? [...gen.posts, ...gen.stories] : []), [gen])
  const changed = gen && !sameParams(gen.params, paramsFrom(state, 0))
  const loading = status.kind === 'loading'

  /* ---------- states without results ---------- */
  if (loading && !gen)
    return (
      <div>
        <Generating version={generations.length + 1} onCancel={() => abort.current?.abort()} />
        <ResultsSkeleton ratio={base.format} />
      </div>
    )
  if (!gen)
    return status.kind === 'cancelled' ? (
      <ErrorState
        title="Geração cancelada"
        text="Nada foi gerado. Quando quiser, é só começar de novo — seu briefing continua salvo."
        onRetry={() => start()}
        retryLabel="Gerar agora"
        secondary={
          <Button variant="secondary" onClick={() => nav('/app/criar/3')}>
            <ChevronLeft className="size-4" aria-hidden /> Voltar ao estilo
          </Button>
        }
      />
    ) : (
      <ErrorState
        title="Não foi possível gerar agora"
        text={status.kind === 'error' ? status.message : 'Tente novamente em instantes.'}
        onRetry={() => start()}
        secondary={
          <Button variant="secondary" onClick={() => start({ offline: true })}>
            <WifiOff className="size-4" aria-hidden /> Usar modelo offline
          </Button>
        }
      />
    )

  /* ---------- results ---------- */
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      if (n.size && !selecting) setSelecting(true)
      return n
    })
  const exitSelection = () => {
    setSelecting(false)
    setSel(new Set())
  }
  const selected = all.filter((c) => sel.has(c.id))
  const save = (list: CreativeT[]) => {
    const n = saveToLibrary(list.map((creative) => ({ creative, gen })))
    toast(n ? `${n} ${n === 1 ? 'conteúdo salvo' : 'conteúdos salvos'} na biblioteca` : 'Esses conteúdos já estão na biblioteca')
  }
  const download = (list: CreativeT[]) => exportCreatives(list.map((c, i) => jobFor(c, look, i, `${gen.themeLabel}-${c.kind}-${c.order}`)))
  const open = (c: CreativeT) => {
    setFocus(c.id)
    setPreviewMode(c.kind === 'story' ? 'story' : 'feed')
    const list = c.kind === 'story' ? 'stories' : 'posts'
    setViewer({ list, index: (list === 'stories' ? gen.stories : gen.posts).findIndex((x) => x.id === c.id) })
  }
  const moveStory = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= gen.stories.length) return
    reorderStories(gen.id, idx, target)
    toast(`Story movido para a posição ${target + 1}`)
  }
  const regenerateImage = async (c: CreativeT) => {
    toast('Gerando nova imagem com IA…', 'info')
    const url = await generateCustomImageWithAI({
      headline: c.headline, segment: gen.params.segment, themeId: c.themeId || gen.params.themeId, imageType: gen.params.imageType || 'fotos',
      style: c.style ?? look.style, kind: c.kind, order: c.order, seed: Date.now() % 100000, palette: c.palette ?? look.palette,
    }).catch(() => null)
    if (url) {
      updateCreative(gen.id, { ...c, photo: url })
      toast('Nova imagem aplicada')
    } else toast('Não foi possível gerar a imagem agora.', 'error')
  }
  const menuFor = (c: CreativeT): MenuItem[] => [
    { label: 'Gerar nova imagem com IA', icon: <Wand2 className="size-4 text-brand-700" />, onClick: () => regenerateImage(c) },
    { label: 'Auxiliar postagem', icon: <Send className="size-4" />, onClick: () => setPublishing(c) },
    { label: 'Ver em tela cheia', icon: <ZoomIn className="size-4" />, onClick: () => open(c) },
    ...tileMenu({ caption: `${c.caption}\n\n${c.hashtags.join(' ')}`, onDuplicate: () => duplicateCreative(gen.id, c.id), onDelete: () => removeCreative(gen.id, c.id) }),
  ]
  const headerMenu: MenuItem[] = [
    { label: 'Editar briefing', icon: <Pencil className="size-4" />, onClick: () => nav('/app/criar/1') },
    { label: 'Gerar nova versão', icon: <RefreshCw className="size-4" />, onClick: () => start() },
    { label: 'Salvar tudo na biblioteca', icon: <FolderPlus className="size-4" />, onClick: () => save(all) },
    { label: 'Agendar no calendário', icon: <CalendarClock className="size-4" />, onClick: () => setSchedOpen(true) },
    { label: 'Selecionar criativos', icon: <ListChecks className="size-4" />, onClick: () => setSelecting(true) },
  ]
  const previewC = previewMode === 'story' ? (all.find((c) => c.id === focus && c.kind === 'story') ?? gen.stories[0]) : (all.find((c) => c.id === focus && c.kind === 'post') ?? gen.posts[0])
  const viewerItems = viewer ? (viewer.list === 'stories' ? gen.stories : gen.posts) : []
  const tabs = [
    gen.posts.length > 0 && { id: 'posts' as const, label: `Posts (${gen.posts.length})`, icon: <InstagramIcon className="size-4" /> },
    gen.stories.length > 0 && { id: 'stories' as const, label: `Stories (${gen.stories.length})`, icon: <StoriesIcon className="size-4" /> },
    { id: 'legendas' as const, label: 'Legendas', icon: <FileText className="size-4" aria-hidden /> },
  ].filter(Boolean) as { id: TabId; label: string; icon: React.ReactNode }[]

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <HeaderAction>
        <span className="lg:hidden">
          <Menu
            label="Ações da geração"
            items={headerMenu}
            trigger={(p) => (
              <IconButton {...p} label="Ações da geração">
                <MoreVertical className="size-5" aria-hidden />
              </IconButton>
            )}
          />
        </span>
      </HeaderAction>

      <div className="min-w-0">
        {loading && (
          <div className="mb-5">
            <Generating version={generations.length + 1} onCancel={() => abort.current?.abort()} />
          </div>
        )}
        {status.kind === 'error' && (
          <div role="alert" className="mb-5 flex flex-col gap-3 rounded-2xl border border-red-200 bg-danger-soft p-4 text-sm sm:flex-row sm:items-center">
            <span className="flex-1 font-medium text-danger">Não foi possível gerar a nova versão: {status.message}</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => start()}>
                Tentar novamente
              </Button>
              <Button size="sm" variant="secondary" onClick={() => start({ offline: true })}>
                <WifiOff className="size-4" aria-hidden /> Usar modelo offline
              </Button>
            </div>
          </div>
        )}

        {/* heading + actions */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-title font-bold">Seus criativos</h2>
            <p className="mt-1 text-sm text-fg-subtle">
              Criados para a <b className="text-ink">{base.brand.name}</b> a partir do seu briefing.
            </p>
          </div>
          <div className="hidden flex-wrap gap-2 lg:flex">
            <Button variant="secondary" onClick={() => nav('/app/criar/1')}>
              <Pencil className="size-4" aria-hidden /> Editar briefing
            </Button>
            <Button variant="secondary" onClick={() => start()} disabled={loading}>
              <RefreshCw className="size-4" aria-hidden /> Nova versão
            </Button>
            <Button onClick={() => save(all)}>
              <Save className="size-4" aria-hidden /> Salvar tudo
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-white px-3 py-1.5 font-medium text-slate-700 ring-1 ring-line">
            Tema: <b>{gen.themeLabel}</b>
          </span>
          <EngineBadge gen={gen} onExplain={() => setQualityOpen(true)} />
          {generations.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="sr-only">Versão exibida</span>
              <select
                value={gen.id}
                onChange={(e) => {
                  setActiveGen(e.target.value)
                  exitSelection()
                  setFocus(null)
                }}
                className="h-10 rounded-full border border-line bg-white px-3 text-sm font-semibold"
              >
                {generations.map((g) => (
                  <option key={g.id} value={g.id}>
                    Versão {g.version} de {generations.length}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <FeedbackBar key={gen.id} gen={gen} />

        {changed && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-warning-soft px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <Wand2 className="size-4 shrink-0" aria-hidden /> Você mudou o briefing, tema ou estilo depois desta versão.
            </span>
            <Button size="sm" variant="dark" onClick={() => start()} disabled={loading}>
              Gerar com as novas escolhas
            </Button>
          </div>
        )}

        {/* sticky tabs + selection toggle */}
        <div className="sticky top-[var(--header-offset)] z-10 -mx-4 mt-5 flex items-center gap-2 bg-canvas/95 px-4 py-2 blur-surface backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="min-w-0 flex-1">
            <Tabs idBase="results" label="Resultados" variant="pill" value={tab} onChange={setTab} className="bg-white ring-1 ring-line" items={tabs} />
          </div>
          {tab !== 'legendas' && (
            <Button variant={selecting ? 'dark' : 'secondary'} size="sm" onClick={() => (selecting ? exitSelection() : setSelecting(true))} aria-pressed={selecting} className="h-12">
              {selecting ? 'Concluir' : 'Selecionar'}
            </Button>
          )}
        </div>
        {selecting && (
          <div className="mt-2 hidden items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm text-white lg:flex" role="region" aria-label="Seleção">
            <span className="mr-auto font-semibold" aria-live="polite">
              {selected.length} {selected.length === 1 ? 'selecionado' : 'selecionados'}
            </span>
            <Button size="sm" variant="glass" onClick={() => download(selected)} disabled={!selected.length}>
              <Download className="size-4" aria-hidden /> Baixar
            </Button>
            <Button size="sm" variant="glass" onClick={() => save(selected)} disabled={!selected.length}>
              <FolderPlus className="size-4" aria-hidden /> Salvar
            </Button>
            <Button size="sm" variant="glass" onClick={() => setSchedOpen(true)} disabled={!selected.length}>
              <CalendarClock className="size-4" aria-hidden /> Agendar
            </Button>
          </div>
        )}
        {selecting && <p className="mt-2 text-sm text-fg-subtle lg:hidden">Toque nos criativos para selecionar. Dica: segure um card para entrar na seleção.</p>}

        <TabPanel idBase="results" id="posts" active={tab === 'posts'} className="mt-3">
          <h3 className="sr-only">Posts para feed</h3>
          <ul className="grid grid-cols-2 items-start gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            {gen.posts.map((c, i) => (
              <li key={c.id}>
                <CreativeTile
                  c={c}
                  n={i + 1}
                  look={look}
                  index={i}
                  selecting={selecting}
                  selected={sel.has(c.id)}
                  onSelect={() => toggle(c.id)}
                  onOpen={() => open(c)}
                  onEdit={() => setEditing(c)}
                  onDownload={() => download([c])}
                  menu={menuFor(c)}
                />
              </li>
            ))}
          </ul>
        </TabPanel>

        <TabPanel idBase="results" id="stories" active={tab === 'stories'} className="mt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-fg-subtle">Gancho → problema → solução → CTA. Reordene com as setas.</p>
            <Button variant="secondary" size="sm" onClick={() => setSeqOpen(true)}>
              <Play className="size-4" aria-hidden /> Reproduzir sequência
            </Button>
          </div>
          <ol className="no-scrollbar snap-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {gen.stories.map((c, i) => (
              <li key={c.id} className="w-[44%] shrink-0 sm:w-[30%] md:w-auto">
                <CreativeTile
                  c={c}
                  n={i + 1}
                  look={look}
                  index={i + 4}
                  compact
                  selecting={selecting}
                  selected={sel.has(c.id)}
                  onSelect={() => toggle(c.id)}
                  onOpen={() => open(c)}
                  onEdit={() => setEditing(c)}
                  menu={menuFor(c)}
                />
                {!selecting && (
                  <div className="mt-1.5 flex items-center justify-between">
                    <IconButton size="sm" variant="secondary" label={`Mover story ${i + 1} para a esquerda`} disabled={i === 0} onClick={() => moveStory(i, -1)}>
                      <ChevronLeft className="size-4" aria-hidden />
                    </IconButton>
                    <span className="text-xs font-semibold text-slate-700">Tela {i + 1}</span>
                    <IconButton size="sm" variant="secondary" label={`Mover story ${i + 1} para a direita`} disabled={i === gen.stories.length - 1} onClick={() => moveStory(i, 1)}>
                      <ChevronRight className="size-4" aria-hidden />
                    </IconButton>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </TabPanel>

        <TabPanel idBase="results" id="legendas" active={tab === 'legendas'} className="mt-3">
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {all.map((c) => (
              <li key={c.id} className="flex gap-4 rounded-2xl border border-line bg-white p-4">
                <div className="w-20 shrink-0 overflow-hidden rounded-lg">
                  <Creative c={c} style={look.style} palette={look.palette} format={look.format} brand={look.brand} label="" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-semibold text-fg-subtle">{c.kind === 'story' ? `Story ${c.order}` : `Post ${c.order}`}</h3>
                  <p className="mt-1 line-clamp-5 text-sm leading-relaxed whitespace-pre-line text-slate-800">{c.caption}</p>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-brand-800">{c.hashtags.join(' ')}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={async () => (await copyText(c.caption)) && toast('Legenda copiada')}>
                      <Copy className="size-4" aria-hidden /> Legenda
                    </Button>
                    <Button size="sm" variant="ghost" onClick={async () => (await copyText(c.hashtags.join(' '))) && toast('Hashtags copiadas')}>
                      <Hash className="size-4" aria-hidden /> Hashtags
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                      <Pencil className="size-4" aria-hidden /> Editar
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </TabPanel>
      </div>

      {/* desktop aside: Instagram phone + batch actions (redundant on a real phone) */}
      <aside className="hidden content-start gap-5 xl:sticky xl:top-[calc(var(--header-offset)+16px)] xl:grid xl:self-start" aria-label="Prévia e ações">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-ink">Prévia no Instagram</h3>
          </div>
          <div className="mt-3">
            <ChoiceGroup
              legend="Modo da prévia"
              legendHidden
              variant="segmented"
              value={previewMode}
              onChange={setPreviewMode}
              options={[
                { value: 'feed', label: 'Feed', disabled: !gen.posts.length },
                { value: 'story', label: 'Stories', disabled: !gen.stories.length },
              ]}
            />
          </div>
          <div className="mt-4">
            <PhoneMockup c={previewC} style={look.style} palette={look.palette} format={look.format} brand={look.brand} mode={previewMode} city={gen.params.city} className="max-w-[260px]" />
          </div>
          <p className="mt-3 text-center text-xs text-fg-subtle">Abra um criativo para vê-lo aqui.</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <h3 className="font-bold text-ink">Ações em lote</h3>
          <p className="text-sm text-fg-subtle">{selected.length ? `${selected.length} selecionado(s)` : 'Sem seleção: as ações valem para todos.'}</p>
          <div className="mt-3 grid gap-2">
            <Button onClick={() => download(selected.length ? selected : all)}>
              <Download className="size-4" aria-hidden /> Baixar {selected.length ? 'selecionados' : 'todos'} (.zip)
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setSchedOpen(true)}>
                <CalendarClock className="size-4" aria-hidden /> Agendar
              </Button>
              <Button variant="secondary" onClick={() => save(selected.length ? selected : all)}>
                <FolderPlus className="size-4" aria-hidden /> Salvar
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* thumb-zone actions (phones/tablets) */}
      <ActionBar className="lg:hidden">
        {selecting ? (
          <>
            <span className="mr-auto text-sm font-semibold" aria-live="polite">
              {selected.length} {selected.length === 1 ? 'selecionado' : 'selecionados'}
            </span>
            <IconButton variant="secondary" label="Salvar selecionados" onClick={() => save(selected)} disabled={!selected.length}>
              <FolderPlus className="size-5" aria-hidden />
            </IconButton>
            <IconButton variant="secondary" label="Agendar selecionados" onClick={() => setSchedOpen(true)} disabled={!selected.length}>
              <CalendarClock className="size-5" aria-hidden />
            </IconButton>
            <Button onClick={() => download(selected)} disabled={!selected.length}>
              <Download className="size-4" aria-hidden /> Baixar
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => save(all)}>
              <Save className="size-5" aria-hidden /> Salvar tudo
            </Button>
            <Button size="lg" className="flex-1" onClick={() => download(all)}>
              <Download className="size-5" aria-hidden /> Baixar
            </Button>
          </>
        )}
      </ActionBar>

      <Editor open={!!editing} creative={editing} look={look} onClose={() => setEditing(null)} onSave={(c) => updateCreative(gen.id, c)} />
      <CreativeViewer
        items={viewerItems}
        index={viewer?.index ?? null}
        onIndex={(i) => {
          setViewer((v) => (v ? { ...v, index: i } : v))
          const c = viewerItems[i]
          if (c) setFocus(c.id)
        }}
        onClose={() => setViewer(null)}
        look={look}
        onEdit={(c) => {
          setViewer(null)
          setEditing(c)
        }}
        onSave={(c) => save([c])}
        onPublish={(c) => {
          setViewer(null)
          setPublishing(c)
        }}
      />
      <SocialPublishModal
        open={!!publishing}
        onClose={() => setPublishing(null)}
        creative={publishing}
        look={look}
        themeLabel={gen.themeLabel}
        onOpenSchedule={() => {
          setPublishing(null)
          setSchedOpen(true)
        }}
      />
      <StoryPlayer open={seqOpen} onClose={() => setSeqOpen(false)} stories={gen.stories} look={look} />
      <ScheduleDialog open={schedOpen} onClose={() => setSchedOpen(false)} items={selected.length ? selected : all} themeLabel={gen.themeLabel} />
      <QualityDialog open={qualityOpen} onClose={() => setQualityOpen(false)} gen={gen} />
    </div>
  )
}

type Verdict = 'approved' | 'ai' | 'review' | 'fallback'

/** One verdict for the badge and the dialog. Only AI output that passed the quality check is "approved". */
function verdictOf(gen: Generation): Verdict {
  const { isAI } = engineLabel(gen.engine)
  if (!isAI) return 'fallback'
  if (!gen.quality) return 'ai'
  return gen.quality.passed ? 'approved' : 'review'
}

const VERDICT = {
  approved: {
    text: 'Qualidade aprovada',
    Icon: ShieldCheck,
    tone: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
    box: 'bg-emerald-50 text-emerald-950',
    icon: 'text-emerald-700',
    detail: 'Criado com IA e revisado automaticamente antes de chegar até você.',
  },
  ai: {
    text: 'Criado com IA',
    Icon: Sparkles,
    tone: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
    box: 'bg-emerald-50 text-emerald-950',
    icon: 'text-emerald-700',
    detail: 'Criado com IA. Confira os textos antes de publicar.',
  },
  review: {
    text: 'Revise antes de postar',
    Icon: AlertTriangle,
    tone: 'bg-warning-soft text-amber-950 ring-amber-300',
    box: 'bg-warning-soft text-amber-950',
    icon: 'text-amber-700',
    detail: 'Criado com IA, mas alguns textos podem precisar de ajustes. Confira títulos e legendas antes de publicar.',
  },
  fallback: {
    text: 'Modelo de reserva',
    Icon: AlertTriangle,
    tone: 'bg-warning-soft text-amber-950 ring-amber-300',
    box: 'bg-warning-soft text-amber-950',
    icon: 'text-amber-700',
    detail: 'Nossa IA estava indisponível, então usamos modelos prontos para você não ficar esperando. Revise os textos antes de publicar ou crie uma nova versão.',
  },
} satisfies Record<Verdict, unknown>

/** Short verdict, never the provider name. Templates are never presented as AI. Tap explains. */
function EngineBadge({ gen, onExplain }: { gen: Generation; onExplain: () => void }) {
  const v = VERDICT[verdictOf(gen)]
  return (
    <button
      type="button"
      onClick={onExplain}
      aria-haspopup="dialog"
      className={cx('inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-1.5 font-medium ring-1 transition hover:brightness-95', v.tone)}
    >
      <v.Icon className={cx('size-4', v.icon)} aria-hidden />
      {v.text}
      <span className="sr-only">. Ver detalhes</span>
    </button>
  )
}

/** What the customer gets, not how we check it (the quality method stays internal). */
function QualityDialog({ open, onClose, gen }: { open: boolean; onClose: () => void; gen: Generation }) {
  const verdict = verdictOf(gen)
  const v = VERDICT[verdict]
  const showPromises = verdict === 'approved' || verdict === 'review'
  return (
    <Dialog open={open} onClose={onClose} title="Sobre este conteúdo" size="sm">
      <div className="grid gap-4 px-5 py-4 md:px-6">
        <div className={cx('flex gap-3 rounded-xl p-4 text-sm', v.box)}>
          <v.Icon className={cx('mt-0.5 size-5 shrink-0', v.icon)} aria-hidden />
          <div>
            <p className="font-semibold">{v.text}</p>
            <p className="mt-1">{v.detail}</p>
          </div>
        </div>
        {gen.quality && verdict !== 'fallback' && (
          <p className="text-sm">
            Nota de qualidade: <b className="text-title-sm">{gen.quality.score}/100</b>
          </p>
        )}
        {showPromises && (
          <div>
            <h3 className="mb-2 text-sm font-bold">Em cada versão, você recebe</h3>
            <ul className="grid gap-2 text-sm text-slate-800">
              {['Textos no tamanho certo para o Instagram', 'O nome da sua marca e uma chamada para ação', 'Hashtags pensadas para o seu negócio', 'Nenhum preço que você não informou'].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  )
}

/** 1–5 rating + optional comment per version: the main quality signal of the POC. */
function FeedbackBar({ gen }: { gen: Generation }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (r: number, text = comment) => {
    setRating(r)
    const ok = await sendFeedback({ generationId: gen.id, rating: r, comment: text.trim() || undefined, brandName: gen.params.brandName, engine: gen.engine })
    if (text.trim()) {
      setSent(true)
      toast(ok ? 'Obrigado! Sua avaliação ajuda a melhorar a MIDFLOW.' : 'Não foi possível enviar agora.', ok ? 'ok' : 'error')
    }
  }

  if (sent) return <p className="mt-3 text-sm text-fg-subtle">Avaliação enviada. Obrigado!</p>

  return (
    <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-line">
      <ChoiceGroup
        legend="Esses conteúdos estão prontos para postar? (nota de 1 a 5)"
        variant="chip"
        value={rating ? String(rating) : ''}
        onChange={(v) => submit(Number(v), '')}
        options={['1', '2', '3', '4', '5'].map((n) => ({ value: n, label: n }))}
        optionClassName="min-w-11 justify-center"
      />
      {rating > 0 && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (comment.trim()) submit(rating)
          }}
        >
          <div className="flex-1">
            <Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder={rating <= 3 ? 'O que faltou ou ficou errado?' : 'Algum comentário? (opcional)'} aria-label="Comentário sobre esta versão" />
          </div>
          <Button type="submit" disabled={!comment.trim()}>
            Enviar
          </Button>
        </form>
      )}
    </div>
  )
}
