import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileText,
  FolderPlus,
  MoveLeft,
  MoveRight,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Wand2,
  X,
  ZoomIn,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Creative } from '../../../components/creative/Creative'
import { Editor } from '../../../components/creative/Editor'
import {
  CreativeTile,
  exportCreatives,
  jobFor,
  PhoneMockup,
  tileMenu,
  useLook,
} from '../../../components/creative/parts'
import { SocialPublishModal } from '../../../components/creative/SocialPublishModal'
import { Button, Checkbox, cx, InstagramIcon, Input, Label, Modal, StoriesIcon, toast } from '../../../components/ui'
import { generateCustomImageWithAI } from '../../../lib/aiService'
import { copyText } from '../../../lib/export'
import { getSocialTips } from '../../../lib/social'
import { paramsFrom, useActiveGen, useApp } from '../../../lib/store'
import { engineLabel, sendFeedback, track } from '../../../lib/telemetry'
import type { Creative as CreativeT, Generation } from '../../../lib/types'

const PHASES = [
  'Analisando seu briefing estratégico',
  'Pesquisando ganchos de alta conversão',
  'Escrevendo títulos e chamadas para ação',
  'Criando as artes com as cores e logo da sua marca',
  'Estruturando a sequência narrativa de Stories',
  'Formatando legendas e hashtags recomendadas',
]

function Generating({ version }: { version: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, PHASES.length - 1)), 520)
    return () => clearInterval(t)
  }, [])
  const pct = Math.round(((i + 1) / PHASES.length) * 100)
  return (
    <div className="grid min-h-[60vh] place-items-center rounded-2xl border border-line bg-white p-8 shadow-card">
      <div className="w-full max-w-md text-center">
        <div className="relative mx-auto grid size-20 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand-200/60" />
          {[0, 1, 2].map((k) => (
            <span
              key={k}
              className="absolute top-1/2 left-1/2 -mt-1 -ml-1 size-2 rounded-full bg-mint"
              style={{
                animation: `orbit ${2.4 + k * 0.6}s linear infinite`,
                animationDelay: `${-k * 0.8}s`,
              }}
            />
          ))}
          <span className="relative grid size-20 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-cta">
            <Sparkles className="size-9" />
          </span>
        </div>
        <h2 className="mt-6 text-2xl font-bold">
          {version > 1 ? `Criando a versão ${version}…` : 'A MIDFLOW está criando seu conteúdo…'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Isso leva poucos segundos. Seu briefing e suas escolhas estão sendo transformados em posts e stories prontos.
        </p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-mint transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="mt-6 space-y-2.5 text-left text-sm">
          {PHASES.map((p, k) => (
            <li
              key={p}
              className={cx(
                'flex items-center gap-3 transition',
                k > i ? 'text-slate-300' : k === i ? 'font-semibold text-ink' : 'text-slate-500',
              )}
            >
              <span
                className={cx(
                  'grid size-5 place-items-center rounded-full text-[10px] font-bold',
                  k < i ? 'bg-brand-600 text-white' : k === i ? 'border-2 border-brand-500' : 'border border-slate-200',
                )}
              >
                {k < i ? '✓' : ''}
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function SequencePlayer({
  open,
  onClose,
  stories,
  look,
}: {
  open: boolean
  onClose: () => void
  stories: CreativeT[]
  look: ReturnType<typeof useLook>
}) {
  const [i, setI] = useState(0)
  const [play, setPlay] = useState(true)
  useEffect(() => {
    if (!open) return
    setI(0)
    setPlay(true)
  }, [open])
  useEffect(() => {
    if (!open || !play) return
    const t = setTimeout(() => setI((x) => (x + 1 < stories.length ? x + 1 : (setPlay(false), x))), 3200)
    return () => clearInterval(t)
  }, [open, play, i, stories.length])
  if (!stories.length) return null
  return (
    <Modal open={open} onClose={onClose} className="max-w-[420px] bg-ink">
      <div className="relative p-4">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 grid size-9 place-items-center rounded-full bg-black/40 text-white"
          aria-label="Fechar"
        >
          <X className="size-5" />
        </button>
        <div className="overflow-hidden rounded-2xl">
          <Creative
            key={stories[i].id}
            c={stories[i]}
            style={look.style}
            palette={look.palette}
            format={look.format}
            brand={look.brand}
            className="animate-fade-in"
          />
        </div>
        <div className="mt-4 flex items-center justify-between text-white">
          <button
            onClick={() => setI(Math.max(0, i - 1))}
            className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Anterior"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() => setPlay(!play)}
              className="grid size-10 place-items-center rounded-full bg-white text-ink"
              aria-label={play ? 'Pausar' : 'Reproduzir'}
            >
              {play ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <span className="tabular-nums">
              {i + 1} / {stories.length}
            </span>
          </div>
          <button
            onClick={() => setI(Math.min(stories.length - 1, i + 1))}
            className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Próximo"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Viewer({
  c,
  onClose,
  look,
  onEdit,
  onSave,
  onPublish,
}: {
  c: CreativeT | null
  onClose: () => void
  look: ReturnType<typeof useLook>
  onEdit: () => void
  onSave: () => void
  onPublish: () => void
}) {
  if (!c) return null
  return (
    <Modal open={!!c} onClose={onClose} wide title={c.kind === 'story' ? `Story ${c.order}` : `Post ${c.order}`}>
      <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,380px)_1fr]">
        <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-2xl shadow-card">
          <Creative c={c} style={look.style} palette={look.palette} format={look.format} brand={look.brand} chrome={false} />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold">Legenda</h4>
          <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed whitespace-pre-line text-slate-700">
            {c.caption}
          </p>
          <h4 className="mt-5 text-sm font-bold">Hashtags</h4>
          <p className="mt-2 text-sm font-medium text-brand-700">{c.hashtags.join(' ')}</p>
          <h4 className="mt-5 text-sm font-bold">CTA</h4>
          <p className="mt-1 text-sm text-slate-600">{c.cta}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" onClick={onPublish}>
              <Send className="size-4" /> Auxiliar postagem
            </Button>
            <Button onClick={onEdit}>
              <Pencil className="size-4" /> Editar
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportCreatives([jobFor(c, look, c.order - 1, c.headline)])}
            >
              <Download className="size-4" /> Baixar
            </Button>
            <Button
              variant="secondary"
              onClick={async () => (await copyText(`${c.caption}\n\n${c.hashtags.join(' ')}`)) && toast('Legenda copiada')}
            >
              <Copy className="size-4" /> Copiar legenda
            </Button>
            <Button variant="secondary" onClick={onSave}>
              <FolderPlus className="size-4" /> Salvar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ScheduleModal({
  open,
  onClose,
  items,
  themeLabel,
}: {
  open: boolean
  onClose: () => void
  items: CreativeT[]
  themeLabel: string
}) {
  const brand = useApp((s) => s.brand)
  const scheduleCreative = useApp((s) => s.scheduleCreative)
  const tips = getSocialTips(brand.segment)
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  const [date, setDate] = useState(tomorrow)
  const [time, setTime] = useState(tips.bestHours[0] || '11:30')
  const [notes, setNotes] = useState('')
  const [network, setNetwork] = useState<'instagram' | 'whatsapp' | 'facebook' | 'todas'>('instagram')

  const handleConfirm = () => {
    if (!items.length) {
      toast('Selecione ao menos um criativo para agendar', 'info')
      return
    }
    items.forEach((c) => {
      scheduleCreative({
        creative: c,
        date,
        time,
        status: 'agendado',
        notes: notes || `Agendado via MIDFLOW — ${themeLabel}`,
        network,
        themeLabel,
      })
    })
    toast(
      items.length === 1
        ? 'Conteúdo agendado com sucesso no seu Calendário!'
        : `${items.length} conteúdos agendados no seu Calendário!`,
    )
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Agendar no Calendário Editorial">
      <div className="p-6">
        <div className="flex items-start gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-brand-700" />
          <p>
            O conteúdo ficará salvo no seu <b>Calendário Editorial</b> com alertas e horários ideais para postar nas
            redes da <b>{brand.name}</b>.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sch-date" required>
              Data de Publicação
            </Label>
            <Input id="sch-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sch-time" required>
              Horário
            </Label>
            <Input id="sch-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        {/* Sugestões de horários de pico */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span>Melhores horários para {brand.segment}:</span>
          {tips.bestHours.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setTime(h)}
              className={cx(
                'rounded-md border px-2 py-0.5 font-semibold transition',
                time === h ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line hover:bg-slate-50',
              )}
            >
              {h}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Label htmlFor="sch-net">Rede Social Principal</Label>
          <select
            id="sch-net"
            value={network}
            onChange={(e) => setNetwork(e.target.value as typeof network)}
            className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink focus:border-brand-500 focus:outline-none"
          >
            <option value="instagram">Instagram (Feed & Stories)</option>
            <option value="whatsapp">WhatsApp Business (Status & Lista)</option>
            <option value="facebook">Facebook / Meta</option>
            <option value="todas">Todas as redes</option>
          </select>
        </div>

        <div className="mt-4">
          <Label htmlFor="sch-notes">Notas ou Lembretes (opcional)</Label>
          <Input
            id="sch-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Avisar no grupo da loja, impulsionar R$ 20"
          />
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Total: <b>{items.length}</b> criativo(s) selecionado(s) para este agendamento.
        </p>

        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            <CalendarClock className="size-4" /> Confirmar agendamento
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function sameParams(a: Generation['params'], b: Generation['params']) {
  const pick = (p: Generation['params']) =>
    JSON.stringify([
      p.segment,
      p.themeId,
      p.customTheme,
      p.objective,
      p.tones,
      p.style,
      p.palette,
      p.postFormat,
      p.posts,
      p.stories,
      p.brandName,
    ])
  return pick(a) === pick(b)
}

export function Step4Generate() {
  const nav = useNavigate()
  const state = useApp()
  const gen = useActiveGen()
  const {
    generations,
    runGeneration,
    setActiveGen,
    updateCreative,
    removeCreative,
    duplicateCreative,
    reorderStories,
    saveToLibrary,
  } = state
  const base = useLook()
  const [loading, setLoading] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'feed' | 'story'>('feed')
  const [capIdx, setCapIdx] = useState(0)
  const [editing, setEditing] = useState<CreativeT | null>(null)
  const [viewing, setViewing] = useState<CreativeT | null>(null)
  const [publishing, setPublishing] = useState<CreativeT | null>(null)
  const [seqOpen, setSeqOpen] = useState(false)
  const [schedOpen, setSchedOpen] = useState(false)
  const [tab, setTab] = useState<'posts' | 'stories' | 'legendas'>('posts')
  const postsRef = useRef<HTMLDivElement>(null)
  const storiesRef = useRef<HTMLDivElement>(null)
  const loc = useLocation()
  const started = useRef(false)

  const start = async () => {
    setLoading(true)
    try {
      const g = await runGeneration()
      setSel(new Set())
      setFocus(g.posts[0]?.id ?? g.stories[0]?.id ?? null)
      setCapIdx(0)
      if (g.version > 1) track('new_version', { generationId: g.id, brandName: g.params.brandName })
      const { label, isAI } = engineLabel(g.engine)
      toast(
        isAI
          ? g.version > 1
            ? `Versão ${g.version} criada com IA!`
            : 'Conteúdo gerado com IA!'
          : `Conteúdo criado com ${label.toLowerCase()}. Revise os textos antes de publicar.`,
        isAI ? 'ok' : 'info',
      )
    } catch (err) {
      console.error(err)
      toast((err as Error)?.message || 'Houve um problema ao gerar o conteúdo. Tente novamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const shouldAutoGenerate = (loc.state as any)?.autoGenerate || generations.length === 0
    if (!started.current && shouldAutoGenerate) {
      started.current = true
      start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const look = useMemo(
    () =>
      gen
        ? { palette: gen.params.palette, style: gen.params.style, format: gen.params.postFormat, brand: base.brand }
        : base,
    [gen, base],
  )
  const all = useMemo(() => (gen ? [...gen.posts, ...gen.stories] : []), [gen])
  const focused = all.find((c) => c.id === focus) ?? gen?.posts[0] ?? gen?.stories[0]
  const changed = gen && !sameParams(gen.params, paramsFrom(state, 0))

  if (loading || !gen) return <Generating version={generations.length + 1} />

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allSel = (list: CreativeT[]) => list.length > 0 && list.every((c) => sel.has(c.id))
  const setAll = (list: CreativeT[], on: boolean) =>
    setSel((s) => {
      const n = new Set(s)
      list.forEach((c) => (on ? n.add(c.id) : n.delete(c.id)))
      return n
    })
  const selected = all.filter((c) => sel.has(c.id))

  const save = (list: CreativeT[]) => {
    const n = saveToLibrary(list.map((creative) => ({ creative, gen })))
    toast(n ? `${n} ${n === 1 ? 'conteúdo salvo' : 'conteúdos salvos'} na biblioteca!` : 'Esses conteúdos já estão na biblioteca')
  }

  const download = (list: CreativeT[]) =>
    exportCreatives(list.map((c, i) => jobFor(c, look, i, `${gen.themeLabel}-${c.kind}-${c.order}`)))

  // Clique no card foca no celular WYSIWYG
  const handleCardClick = (c: CreativeT) => {
    setFocus(c.id)
    setPreviewMode(c.kind === 'story' ? 'story' : 'feed')
    toast(`Visualizando ${c.kind === 'story' ? `Story ${c.order}` : `Post ${c.order}`} no celular`, 'info')
  }

  const cap = all[capIdx % Math.max(1, all.length)]
  const previewC =
    previewMode === 'story'
      ? focused?.kind === 'story'
        ? focused
        : gen.stories[0]
      : focused?.kind === 'post'
        ? focused
        : gen.posts[0]

  const goTab = (t: typeof tab) => {
    setTab(t)
    if (t === 'posts') postsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (t === 'stories') storiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleMoveStory = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= gen.stories.length) return
    reorderStories(gen.id, idx, target)
    toast('Ordem dos Stories atualizada!')
  }

  const handleRegenerateImage = async (c: CreativeT) => {
    toast('Gerando nova imagem exclusiva com IA…', 'info')
    const url = await generateCustomImageWithAI({
      headline: c.headline,
      segment: gen.params.segment,
      themeId: c.themeId || gen.params.themeId,
      imageType: gen.params.imageType || 'fotos',
      style: c.style ?? look.style,
      kind: c.kind,
      order: c.order,
      seed: Date.now() % 100000,
      palette: c.palette ?? look.palette,
    })
    if (url) {
      updateCreative(gen.id, { ...c, photo: url })
      toast('Nova imagem aplicada com sucesso!')
    } else {
      toast('Não foi possível regenerar a imagem agora.', 'error')
    }
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">4. Gerar conteúdo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Pronto! A MIDFLOW criou seus posts e stories alinhados com o briefing da <b>{base.brand.name}</b>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => nav('/app/criar/1')}>
              <Pencil className="size-4" /> Editar briefing
            </Button>
            <Button variant="secondary" onClick={start}>
              <RefreshCw className="size-4" /> Gerar nova versão
            </Button>
            <Button onClick={() => save(all)}>
              <Save className="size-4" /> Salvar tudo na biblioteca
            </Button>
          </div>
        </div>

        {/* Versões & Tema */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-white px-3 py-1.5 font-medium text-slate-600 ring-1 ring-line">
            Tema: <b>{gen.themeLabel}</b>
          </span>
          <EngineBadge gen={gen} />
          {generations.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ml-1 text-slate-500">Versões disponíveis:</span>
              {generations.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setActiveGen(g.id)
                    setSel(new Set())
                    setFocus(null)
                  }}
                  className={cx(
                    'h-8 rounded-full px-3 text-[13px] font-semibold transition',
                    g.id === gen.id ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-line hover:ring-slate-300',
                  )}
                >
                  V{g.version}
                </button>
              ))}
            </div>
          )}
        </div>
        <FeedbackBar key={gen.id} gen={gen} />

        {changed && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="flex items-center gap-2">
              <Wand2 className="size-4" /> Você alterou o briefing, tema ou estilo depois desta versão.
            </span>
            <Button size="sm" variant="dark" onClick={start}>
              Gerar com as novas escolhas
            </Button>
          </div>
        )}

        {/* Abas */}
        <div className="sticky top-[76px] z-10 -mx-1 mt-5 bg-canvas/90 px-1 py-2 backdrop-blur">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {[
              {
                id: 'posts' as const,
                label: `Posts para feed (${gen.posts.length})`,
                icon: <InstagramIcon className="size-4" />,
                show: gen.posts.length > 0,
              },
              {
                id: 'stories' as const,
                label: `Stories (${gen.stories.length})`,
                icon: <StoriesIcon className="size-4" />,
                show: gen.stories.length > 0,
              },
              {
                id: 'legendas' as const,
                label: 'Legendas e hashtags',
                icon: <FileText className="size-4" />,
                show: true,
              },
            ]
              .filter((t) => t.show)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => goTab(t.id)}
                  className={cx(
                    'flex h-11 shrink-0 items-center gap-2 rounded-xl border-b-2 bg-white px-4 text-sm font-semibold ring-1 ring-line transition',
                    tab === t.id ? 'border-b-brand-600 text-brand-800' : 'border-b-transparent text-slate-600 hover:text-ink',
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
          </div>
        </div>

        {tab === 'legendas' ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {all.map((c) => (
              <div key={c.id} className="flex gap-4 rounded-2xl border border-line bg-white p-4">
                <div className="w-20 shrink-0 overflow-hidden rounded-lg">
                  <Creative c={c} style={look.style} palette={look.palette} format={look.format} brand={look.brand} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-500">
                    {c.kind === 'story' ? `Story ${c.order}` : `Post ${c.order}`}
                  </div>
                  <p className="mt-1 line-clamp-5 text-[13px] leading-relaxed whitespace-pre-line text-slate-700">
                    {c.caption}
                  </p>
                  <p className="mt-2 line-clamp-2 text-[13px] font-medium text-brand-700">{c.hashtags.join(' ')}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="soft" onClick={() => setPublishing(c)}>
                      <Send className="size-3.5" /> Auxiliar postagem
                    </Button>
                    <button
                      onClick={async () => (await copyText(`${c.caption}\n\n${c.hashtags.join(' ')}`)) && toast('Legenda copiada')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-ink"
                    >
                      <Copy className="size-3.5" /> Copiar
                    </button>
                    <button
                      onClick={() => setEditing(c)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-ink"
                    >
                      <Pencil className="size-3.5" /> Editar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {gen.posts.length > 0 && (
              <section ref={postsRef} className="mt-3 scroll-mt-40 rounded-2xl border border-line bg-white p-5 shadow-card">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Posts para feed</h3>
                    <p className="text-[13px] text-slate-500">
                      {gen.posts.length} artes criadas com legendas prontas. Toque para pré-visualizar no celular ou use
                      o assistente de postagem.
                    </p>
                  </div>
                  <Checkbox
                    id="sel-posts"
                    checked={allSel(gen.posts)}
                    onChange={(v) => setAll(gen.posts, v)}
                    label="Selecionar todos"
                  />
                </div>
                <div className="grid grid-cols-2 items-start gap-4 lg:grid-cols-4">
                  {gen.posts.map((c, i) => (
                    <div key={c.id} className="relative">
                      <CreativeTile
                        c={c}
                        n={i + 1}
                        look={look}
                        index={i}
                        selected={sel.has(c.id)}
                        onSelect={() => toggle(c.id)}
                        onOpen={() => handleCardClick(c)}
                        onEdit={() => setEditing(c)}
                        onDownload={() => download([c])}
                        menu={[
                          {
                            label: 'Gerar nova imagem IA',
                            icon: <Wand2 className="size-4 text-brand-600" />,
                            onClick: () => handleRegenerateImage(c),
                          },
                          {
                            label: 'Auxiliar postagem',
                            icon: <Send className="size-4" />,
                            onClick: () => setPublishing(c),
                          },
                          {
                            label: 'Ver em tamanho maior',
                            icon: <ZoomIn className="size-4" />,
                            onClick: () => setViewing(c),
                          },
                          ...tileMenu({
                            caption: `${c.caption}\n\n${c.hashtags.join(' ')}`,
                            onDuplicate: () => duplicateCreative(gen.id, c.id),
                            onDelete: () => removeCreative(gen.id, c.id),
                          }),
                        ]}
                      />
                      {focus === c.id && (
                        <div className="mt-1 flex items-center justify-center gap-1 text-[11px] font-bold text-brand-700">
                          <Eye className="size-3" /> No celular ao lado
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {gen.stories.length > 0 && (
              <section
                ref={storiesRef}
                className="mt-5 scroll-mt-40 rounded-2xl border border-line bg-white p-5 shadow-card"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Stories (Sequência Narrativa)</h3>
                    <p className="text-[13px] text-slate-500">
                      {gen.stories.length} telas em ordem estratégica: gancho → problema → solução → CTA. Você pode
                      reordenar as telas com as setas.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" onClick={() => setSeqOpen(true)}>
                      <Eye className="size-4" /> Reproduzir sequência
                    </Button>
                    <Checkbox
                      id="sel-stories"
                      checked={allSel(gen.stories)}
                      onChange={(v) => setAll(gen.stories, v)}
                      label="Selecionar todos"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-4">
                  {gen.stories.map((c, i) => (
                    <div key={c.id} className="relative">
                      <CreativeTile
                        c={c}
                        n={i + 1}
                        look={look}
                        index={i + 4}
                        compact
                        selected={sel.has(c.id)}
                        onSelect={() => toggle(c.id)}
                        onOpen={() => handleCardClick(c)}
                        onEdit={() => setEditing(c)}
                        onDownload={() => download([c])}
                        menu={[
                          {
                            label: 'Gerar nova imagem IA',
                            icon: <Wand2 className="size-4 text-brand-600" />,
                            onClick: () => handleRegenerateImage(c),
                          },
                          {
                            label: 'Auxiliar postagem',
                            icon: <Send className="size-4" />,
                            onClick: () => setPublishing(c),
                          },
                          {
                            label: 'Ver em tamanho maior',
                            icon: <ZoomIn className="size-4" />,
                            onClick: () => setViewing(c),
                          },
                          ...tileMenu({
                            caption: `${c.caption}\n\n${c.hashtags.join(' ')}`,
                            onDuplicate: () => duplicateCreative(gen.id, c.id),
                            onDelete: () => removeCreative(gen.id, c.id),
                          }),
                        ]}
                      />
                      {/* Controles de reordenação */}
                      <div className="mt-1.5 flex items-center justify-between px-1 text-xs text-slate-500">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => handleMoveStory(i, -1)}
                          className="grid size-6 place-items-center rounded border border-line bg-white hover:bg-slate-50 disabled:opacity-30"
                          title="Mover para esquerda"
                        >
                          <MoveLeft className="size-3" />
                        </button>
                        <span className="font-semibold text-slate-600">Tela {i + 1}</span>
                        <button
                          type="button"
                          disabled={i === gen.stories.length - 1}
                          onClick={() => handleMoveStory(i, 1)}
                          className="grid size-6 place-items-center rounded border border-line bg-white hover:bg-slate-50 disabled:opacity-30"
                          title="Mover para direita"
                        >
                          <MoveRight className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Coluna Direita: Mockup do Instagram & Ações */}
      <aside className="grid content-start gap-5 xl:sticky xl:top-[100px] xl:self-start">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink">Pré-visualização no Instagram</h3>
            {focused && (
              <Button size="sm" variant="ghost" onClick={() => setViewing(focused)}>
                <ZoomIn className="size-3.5" /> Ampliar
              </Button>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(['feed', 'story'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPreviewMode(m)}
                disabled={m === 'story' ? !gen.stories.length : !gen.posts.length}
                className={cx(
                  'h-8 rounded-lg text-[13px] font-semibold transition disabled:opacity-40',
                  previewMode === m ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-500',
                )}
              >
                {m === 'feed' ? 'Feed' : 'Stories'}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <PhoneMockup
              c={previewC}
              style={look.style}
              palette={look.palette}
              format={look.format}
              brand={look.brand}
              mode={previewMode}
              city={gen.params.city}
              className="max-w-[260px]"
            />
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            Clique em qualquer post ou story da esquerda para refletir no celular.
          </p>
        </div>

        {/* Legenda em Foco */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-ink">Legendas e hashtags</h3>
              <p className="text-xs text-slate-500">Textos prontos para copiar e publicar.</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="mr-1 text-xs font-medium text-slate-500 tabular-nums">
                {cap?.kind === 'story' ? 'Story' : 'Post'} {cap?.order} · {(capIdx % all.length) + 1}/{all.length}
              </span>
              <button
                onClick={() => setCapIdx((i) => (i + all.length - 1) % all.length)}
                className="grid size-7 place-items-center rounded-lg border border-line hover:bg-slate-50"
                aria-label="Anterior"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => setCapIdx((i) => (i + 1) % all.length)}
                className="grid size-7 place-items-center rounded-lg border border-line hover:bg-slate-50"
                aria-label="Próxima"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          {cap && (
            <div className="relative mt-3 rounded-xl border border-line p-3.5 pr-10">
              <button
                onClick={async () => (await copyText(`${cap.caption}\n\n${cap.hashtags.join(' ')}`)) && toast('Legenda copiada')}
                className="absolute top-3 right-3 text-slate-400 hover:text-ink"
                aria-label="Copiar legenda"
              >
                <Copy className="size-4" />
              </button>
              <p className="line-clamp-4 text-[13px] leading-relaxed whitespace-pre-line text-slate-700">
                {cap.caption}
              </p>
              <p className="mt-2 text-[13px] font-medium text-brand-700">{cap.hashtags.join(' ')}</p>
            </div>
          )}
        </div>

        {/* Ações em Lote */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <h3 className="font-bold text-ink">Ações em lote</h3>
          <p className="text-xs text-slate-500">
            {selected.length ? `${selected.length} selecionado(s)` : 'Selecione criativos ou aplique a todos.'}
          </p>
          <div className="mt-3 grid gap-2">
            <Button onClick={() => download(selected.length ? selected : all)}>
              <Download className="size-4" /> Baixar {selected.length ? 'selecionados' : 'todos'}{' '}
              <span className="font-normal opacity-80">(.zip)</span>
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setSchedOpen(true)}>
                <CalendarClock className="size-4" /> Agendar
              </Button>
              <Button variant="secondary" onClick={() => save(selected.length ? selected : all)}>
                <FolderPlus className="size-4" /> Salvar
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Barra de Ações Flutuante Mobile */}
      {selected.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between gap-2 rounded-2xl bg-ink p-3 text-white shadow-pop sm:hidden">
          <span className="text-xs font-bold">{selected.length} selecionado(s)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => download(selected)}>
              <Download className="size-3.5" /> Baixar
            </Button>
            <Button size="sm" onClick={() => setSchedOpen(true)}>
              <CalendarClock className="size-3.5" /> Agendar
            </Button>
          </div>
        </div>
      )}

      {/* Modais */}
      <Editor
        open={!!editing}
        creative={editing}
        look={look}
        onClose={() => setEditing(null)}
        onSave={(c) => updateCreative(gen.id, c)}
      />
      <Viewer
        c={viewing ? all.find((x) => x.id === viewing.id) ?? null : null}
        onClose={() => setViewing(null)}
        look={look}
        onEdit={() => {
          setEditing(viewing)
          setViewing(null)
        }}
        onSave={() => viewing && save([viewing])}
        onPublish={() => {
          setPublishing(viewing)
          setViewing(null)
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
      <SequencePlayer open={seqOpen} onClose={() => setSeqOpen(false)} stories={gen.stories} look={look} />
      <ScheduleModal
        open={schedOpen}
        onClose={() => setSchedOpen(false)}
        items={selected.length ? selected : all}
        themeLabel={gen.themeLabel}
      />
    </div>
  )
}

/** Which engine wrote this version, and its quality score. Templates are never presented as AI. */
function EngineBadge({ gen }: { gen: Generation }) {
  const { label, isAI } = engineLabel(gen.engine)
  return (
    <span
      title={gen.aiError ? `Motivo: ${gen.aiError}` : undefined}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium ring-1',
        isAI ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200',
      )}
    >
      <Sparkles className={cx('size-3.5', isAI ? 'text-emerald-600' : 'text-amber-600')} />
      {label}
      {gen.quality && <span className="opacity-70">· qualidade {gen.quality.score}/100</span>}
    </span>
  )
}

/** 1–5 rating + optional comment per version: the main quality signal of the POC. */
function FeedbackBar({ gen }: { gen: Generation }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (r: number, text = comment) => {
    setRating(r)
    const ok = await sendFeedback({
      generationId: gen.id,
      rating: r,
      comment: text.trim() || undefined,
      brandName: gen.params.brandName,
      engine: gen.engine,
    })
    if (text.trim()) {
      setSent(true)
      toast(ok ? 'Obrigado! Sua avaliação ajuda a melhorar a MIDFLOW.' : 'Não foi possível enviar agora.', ok ? 'ok' : 'error')
    }
  }

  if (sent) {
    return <p className="mt-3 text-sm text-slate-500">Avaliação enviada. Obrigado!</p>
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-line">
      <span className="font-medium text-slate-700">Esses conteúdos estão prontos para postar?</span>
      <div className="flex gap-1" role="radiogroup" aria-label="Nota de 1 a 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={`Nota ${n}`}
            onClick={() => submit(n, '')}
            className={cx(
              'size-8 rounded-full text-[13px] font-semibold transition',
              rating >= n ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {rating > 0 && (
        <form
          className="flex min-w-[240px] flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (comment.trim()) submit(rating)
          }}
        >
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            placeholder={rating <= 3 ? 'O que faltou ou ficou errado?' : 'Algum comentário? (opcional)'}
            aria-label="Comentário"
          />
          <Button size="sm" type="submit" disabled={!comment.trim()}>
            Enviar
          </Button>
        </form>
      )}
    </div>
  )
}
