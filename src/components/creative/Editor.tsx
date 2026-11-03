import {
  CheckCircle2,
  ChevronUp,
  DollarSign,
  Download,
  ImageIcon,
  ImagePlus,
  LayoutTemplate,
  List,
  Loader2,
  Palette as PaletteIcon,
  Quote as QuoteIcon,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
  Tag as TagIcon,
  Type,
  Undo2,
  Vote,
  Wand2,
  X,
  FileText,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { derivePalette } from '../../lib/color'
import { DAILY_IMAGE_LIMIT_MESSAGE, DAILY_REWRITE_LIMIT_MESSAGE, generateCustomImageWithAI, rewriteCreativeWithAI } from '../../lib/aiService'
import { ACCOUNT_REQUIRED_MESSAGE, GenerateError } from '../../lib/generation'
import { segmentDef, STYLES } from '../../lib/data'
import { ImageError, preparePhoto } from '../../lib/image'
import { COPY_LIMITS as L } from '../../lib/limits'
import { PHOTOS, photoUrl } from '../../lib/photos'
import { useApp } from '../../lib/store'
import { track } from '../../lib/telemetry'
import type { Creative as CreativeT, Variant } from '../../lib/types'
import { Button, ChoiceGroup, ConfirmDialog, cx, Dialog, Field, IconButton, Input, Select, Textarea, toast, useIsDesktop } from '../ui'
import { Creative } from './Creative'
import { exportCreatives, jobFor, type Look } from './helpers'

interface Props {
  open: boolean
  onClose: () => void
  creative: CreativeT | null
  look: Look
  onSave: (c: CreativeT) => void
}

const photoIds = Object.keys(PHOTOS).filter((k) => !k.startsWith('st-'))

const VARIANTS: { id: Variant; label: string; icon: typeof TagIcon }[] = [
  { id: 'photo', label: 'Foto destaque', icon: TagIcon },
  { id: 'list', label: 'Lista', icon: List },
  { id: 'icons', label: '3 destaques', icon: CheckCircle2 },
  { id: 'beforeafter', label: 'Antes e depois', icon: LayoutTemplate },
  { id: 'offer', label: 'Oferta', icon: DollarSign },
  { id: 'quote', label: 'Depoimento', icon: QuoteIcon },
  { id: 'poll', label: 'Enquete', icon: Vote },
]

type Tool = 'texto' | 'layout' | 'cores' | 'imagem' | 'legenda'
const TOOLS: { id: Tool; label: string; icon: typeof Type }[] = [
  { id: 'texto', label: 'Texto', icon: Type },
  { id: 'layout', label: 'Layout', icon: LayoutTemplate },
  { id: 'cores', label: 'Cores', icon: PaletteIcon },
  { id: 'imagem', label: 'Imagem', icon: ImageIcon },
  { id: 'legenda', label: 'Legenda', icon: FileText },
]

type RewriteMode = 'vendedor' | 'curto' | 'sofisticado' | 'descontraido' | 'educativo'

/** "12/60" under a field; warns from 90% and when the quality-gate limit is exceeded. */
function Limit({ value, max, min, unit = 'caracteres' }: { value: number; max: number; min?: number; unit?: string }) {
  const over = value > max
  const under = min !== undefined && value < min
  const near = !over && value >= max * 0.9
  return (
    <p className={cx('mt-1 text-right text-xs tabular-nums', over || under ? 'font-semibold text-danger' : near ? 'font-semibold text-warning' : 'text-fg-subtle')}>
      {over ? `Acima do limite recomendado (${max} ${unit}) · ` : under ? `Abaixo do mínimo recomendado (${min}) · ` : ''}
      {value}/{max}
    </p>
  )
}

/** Undo/redo history. Typing in the same field within 1 s is merged into one step. */
function useHistory(initial: CreativeT | null) {
  const [state, setState] = useState<{ past: CreativeT[]; cur: CreativeT | null; future: CreativeT[] }>({ past: [], cur: initial, future: [] })
  const last = useRef<{ key: string; t: number }>({ key: '', t: 0 })
  const reset = (c: CreativeT | null) => setState({ past: [], cur: c, future: [] })
  const commit = (next: CreativeT, key = '') => {
    const now = Date.now()
    const merge = key && key === last.current.key && now - last.current.t < 1000
    last.current = { key, t: now }
    setState((s) => (s.cur ? { past: merge ? s.past : [...s.past.slice(-49), s.cur], cur: next, future: [] } : s))
  }
  const undo = () => setState((s) => (s.past.length && s.cur ? { past: s.past.slice(0, -1), cur: s.past[s.past.length - 1], future: [s.cur, ...s.future] } : s))
  const redo = () => setState((s) => (s.future.length && s.cur ? { past: [...s.past, s.cur], cur: s.future[0], future: s.future.slice(1) } : s))
  return { c: state.cur, commit, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 }
}

export function Editor({ open, onClose, creative, look, onSave }: Props) {
  const brand = useApp((s) => s.brand)
  const styleState = useApp((s) => s.style)
  const segment = useApp((s) => s.briefing.segment || s.brand.segment)
  const desktop = useIsDesktop()
  const h = useHistory(creative)
  const c = h.c
  const [tool, setTool] = useState<Tool>('texto')
  const [expanded, setExpanded] = useState(false)
  const [aiMode, setAiMode] = useState<RewriteMode>('vendedor')
  const [seed, setSeed] = useState(1)
  const [rewriting, setRewriting] = useState<AbortController | null>(null)
  const [imgPrompt, setImgPrompt] = useState('')
  const [imgType, setImgType] = useState<'fotos' | 'ilustracoes' | 'render'>(styleState.imageType === 'ilustracoes' || styleState.imageType === 'render' ? styleState.imageType : 'fotos')
  const [generatingImg, setGeneratingImg] = useState<AbortController | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => {
    h.reset(creative)
    setTool('texto')
    setExpanded(false)
    // reset only when another creative is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creative])

  const dirty = !!c && !!creative && JSON.stringify(c) !== JSON.stringify(creative)
  const requestClose = () => {
    rewriting?.abort()
    generatingImg?.abort()
    if (dirty) setConfirmClose(true)
    else onClose()
  }
  const save = () => {
    if (!c) return
    onSave({ ...c, bullets: c.bullets?.map((b) => b.trim()).filter(Boolean) })
    track('edit', { brandName: brand.name })
    toast('Alterações salvas')
    onClose()
  }

  if (!c) return null
  const set = (p: Partial<CreativeT>, key = '') => h.commit({ ...c, ...p }, key)

  const changeVariant = (v: Variant) => {
    const u: Partial<CreativeT> = { variant: v }
    if (v === 'list' && !c.bullets?.length) u.bullets = ['Atendimento exclusivo e individual', 'Produtos e técnicas profissionais', 'Resultados visíveis e duradouros']
    if (v === 'offer' && !c.price) u.price = { label: 'A partir de', value: '89', cents: '90' }
    if (v === 'quote' && !c.quote) u.quote = { text: 'Melhor experiência que já tive! Atendimento impecável e resultado maravilhoso.', author: 'Cliente satisfeita' }
    if (v === 'poll' && !c.poll?.length) u.poll = ['Com certeza!', 'Quero saber mais']
    if (v === 'beforeafter' && !c.photo2) u.photo2 = 'transform'
    set(u)
  }

  const palettes = [
    { label: 'Marca', p: look.palette },
    { label: 'Sugerida', p: derivePalette(segmentDef(segment).palette) },
    { label: 'Neutra', p: derivePalette(['#1B1B1B', '#8C8C8C', '#E6E6E6', '#FAFAFA']) },
    { label: 'Teal', p: derivePalette(['#0B4D3D', '#12B386', '#A8EAD5', '#F3F7F6']) },
  ]
  const activePalette = c.palette ?? look.palette
  const paletteKey = palettes.find((x) => JSON.stringify(x.p) === JSON.stringify(activePalette))?.label ?? ''

  const handleRewrite = async () => {
    if (rewriting) return rewriting.abort()
    const ctl = new AbortController()
    setRewriting(ctl)
    try {
      const res = await rewriteCreativeWithAI({ creative: c, mode: aiMode, brandName: brand.name, segment: segment || 'beleza', city: brand.city, seed, signal: ctl.signal })
      set({
        headline: res.headline || c.headline,
        highlight: res.highlight || c.highlight,
        sub: res.sub !== undefined ? res.sub : c.sub,
        bullets: res.bullets?.length ? res.bullets : c.bullets,
        cta: res.cta || c.cta,
        caption: res.caption || c.caption,
      })
      setSeed(seed + 1)
      const ai = res.engine === 'gemini' || res.engine === 'openai'
      toast(
        ai
          ? 'Texto reescrito com IA'
          : res.code === 'account_required'
            ? `${ACCOUNT_REQUIRED_MESSAGE} Reescrevemos com a versão padrão.`
            : res.aiErrorKind === 'daily_cap'
              ? DAILY_REWRITE_LIMIT_MESSAGE
              : 'Texto reescrito com a versão padrão (IA indisponível no momento)',
        ai ? 'ok' : 'info',
      )
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') toast('Reescrita cancelada', 'info')
      else if (e instanceof GenerateError) toast(e.message, 'error')
      else toast('Não foi possível reescrever agora.', 'error')
    } finally {
      setRewriting(null)
    }
  }

  const handleGenerateAIImage = async () => {
    if (generatingImg) return generatingImg.abort()
    const ctl = new AbortController()
    setGeneratingImg(ctl)
    try {
      const img = await generateCustomImageWithAI({
        prompt: imgPrompt.trim() || undefined,
        headline: c.headline,
        segment: segment || 'beleza',
        themeId: c.themeId,
        imageType: imgType,
        style: c.style ?? look.style,
        kind: c.kind,
        order: c.order,
        seed: Date.now() % 100000,
        palette: activePalette,
        signal: ctl.signal,
      })
      if (img) {
        set({ photo: img.url })
        if (img.notice === 'daily_user_limit') toast(DAILY_IMAGE_LIMIT_MESSAGE, 'info')
        else toast('Nova imagem aplicada')
      } else toast('Não foi possível gerar a imagem agora. As fotos do catálogo continuam disponíveis.', 'error')
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') toast('Geração de imagem cancelada', 'info')
      else if (e instanceof GenerateError) toast(e.message, 'error')
    } finally {
      setGeneratingImg(null)
    }
  }

  const headMax = c.kind === 'story' ? L.storyHeadlineChars : L.headlineChars
  const highlightMissing = !!c.highlight && !c.headline.toLowerCase().includes(c.highlight.toLowerCase())

  const photoPicker = (field: 'photo' | 'photo2', legend: string) => (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-400 text-slate-600 hover:border-brand-500 hover:text-brand-800 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-solid">
          <ImagePlus className="size-5" aria-hidden />
          <span className="sr-only">Enviar foto do dispositivo</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const input = e.target
              const f = input.files?.[0]
              if (!f) return
              try {
                set({ [field]: await preparePhoto(f) })
              } catch (err) {
                toast(err instanceof ImageError ? err.message : 'Não foi possível usar essa foto. Tente outra imagem.', 'error')
              }
              input.value = ''
            }}
          />
        </label>
        {c[field]?.startsWith('data:') && <img src={c[field]} alt="Foto enviada (selecionada)" className="aspect-square rounded-lg object-cover ring-3 ring-brand-600" />}
        {photoIds.map((id, k) => (
          <button
            key={id}
            type="button"
            onClick={() => set({ [field]: id })}
            aria-pressed={c[field] === id}
            aria-label={`Foto ${k + 1} do catálogo`}
            className={cx('overflow-hidden rounded-lg transition', c[field] === id ? 'ring-3 ring-brand-600 ring-offset-1' : 'opacity-90 hover:opacity-100')}
          >
            <img src={photoUrl(id)} alt="" loading="lazy" decoding="async" width={96} height={96} className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
    </fieldset>
  )

  const panels: Record<Tool, ReactNode> = {
    texto: (
      <div className="grid gap-4">
        <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label={<span className="flex items-center gap-1.5"><Sparkles className="size-4 text-brand-700" aria-hidden /> Reescrever com IA</span>}>
                <Select value={aiMode} onChange={(e) => setAiMode(e.target.value as RewriteMode)} disabled={!!rewriting}>
                  <option value="vendedor">Mais vendedor</option>
                  <option value="curto">Mais curto e direto</option>
                  <option value="sofisticado">Mais sofisticado</option>
                  <option value="descontraido">Mais descontraído</option>
                  <option value="educativo">Mais educativo</option>
                </Select>
              </Field>
            </div>
            <Button variant={rewriting ? 'secondary' : 'primary'} onClick={handleRewrite}>
              {rewriting ? (
                <>
                  <X className="size-4" aria-hidden /> Cancelar
                </>
              ) : (
                <>
                  <Wand2 className="size-4" aria-hidden /> Reescrever
                </>
              )}
            </Button>
          </div>
          <p role="status" className="mt-2 flex min-h-5 items-center gap-1.5 text-xs font-medium text-brand-900">
            {rewriting && (
              <>
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> Reescrevendo título, apoio, CTA e legenda…
              </>
            )}
          </p>
        </div>
        <fieldset disabled={!!rewriting} className={cx('grid gap-4 transition', rewriting && 'opacity-60')}>
          <legend className="sr-only">Textos da arte</legend>
          <div>
            <Field label="Etiqueta superior">
              <Input value={c.tag ?? ''} onChange={(e) => set({ tag: e.target.value }, 'tag')} placeholder="Ex.: DICA, NOVIDADE" />
            </Field>
            <Limit value={(c.tag ?? '').length} max={L.tagChars} />
          </div>
          <div>
            <Field label="Título principal">
              <Textarea value={c.headline} onChange={(e) => set({ headline: e.target.value }, 'headline')} className="min-h-[72px]" />
            </Field>
            <Limit value={c.headline.length} max={headMax} />
          </div>
          <div>
            <Field label="Palavra de destaque" hint="Precisa aparecer no título; recebe a tipografia especial." error={highlightMissing ? 'Este trecho não aparece no título.' : undefined}>
              <Input value={c.highlight ?? ''} onChange={(e) => set({ highlight: e.target.value }, 'highlight')} />
            </Field>
            <Limit value={(c.highlight ?? '').length} max={L.highlightChars} />
          </div>
          <div>
            <Field label="Subtítulo / apoio">
              <Input value={c.sub ?? ''} onChange={(e) => set({ sub: e.target.value }, 'sub')} />
            </Field>
            <Limit value={(c.sub ?? '').length} max={L.subChars} />
          </div>
          {(c.variant === 'list' || c.bullets) && (
            <div>
              <Field label="Itens da lista" hint="Um item por linha.">
                <Textarea value={(c.bullets ?? []).join('\n')} onChange={(e) => set({ bullets: e.target.value.split('\n') }, 'bullets')} className="min-h-[88px]" />
              </Field>
              {(c.bullets ?? []).some((b) => b.length > L.bulletChars) && <p className="mt-1 text-xs font-semibold text-danger">Algum item passa de {L.bulletChars} caracteres.</p>}
            </div>
          )}
          {c.variant === 'offer' && (
            <fieldset className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-slate-50 p-3">
              <legend className="sr-only">Preço</legend>
              <Field label="Rótulo">
                <Input value={c.price?.label ?? 'A partir de'} onChange={(e) => set({ price: { ...c.price, label: e.target.value, value: c.price?.value ?? '0' } }, 'pl')} />
              </Field>
              <Field label="Valor (R$)">
                <Input inputMode="numeric" value={c.price?.value ?? '89'} onChange={(e) => set({ price: { ...c.price, value: e.target.value, label: c.price?.label ?? 'R$' } }, 'pv')} />
              </Field>
              <Field label="Centavos">
                <Input inputMode="numeric" value={c.price?.cents ?? '90'} onChange={(e) => set({ price: { ...c.price, cents: e.target.value, label: c.price?.label ?? 'R$', value: c.price?.value ?? '0' } }, 'pc')} />
              </Field>
            </fieldset>
          )}
          {c.variant === 'quote' && (
            <div className="grid gap-3 rounded-xl border border-line bg-slate-50 p-3">
              <Field label="Depoimento">
                <Textarea value={c.quote?.text ?? ''} onChange={(e) => set({ quote: { ...c.quote, text: e.target.value, author: c.quote?.author ?? 'Cliente' } }, 'qt')} />
              </Field>
              <Field label="Autor do depoimento">
                <Input value={c.quote?.author ?? ''} onChange={(e) => set({ quote: { ...c.quote, author: e.target.value, text: c.quote?.text ?? '' } }, 'qa')} />
              </Field>
            </div>
          )}
          {c.variant === 'poll' && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-slate-50 p-3">
              {(c.poll || ['Sim', 'Não']).map((o, i) => (
                <div key={i}>
                  <Field label={`Opção ${i + 1}`}>
                    <Input
                      value={o}
                      onChange={(e) => {
                        const next = [...(c.poll || ['Sim', 'Não'])]
                        next[i] = e.target.value
                        set({ poll: next }, `poll${i}`)
                      }}
                    />
                  </Field>
                  <Limit value={o.length} max={L.pollChars} />
                </div>
              ))}
            </div>
          )}
          <div>
            <Field label="Chamada para ação (botão)">
              <Input value={c.cta} onChange={(e) => set({ cta: e.target.value }, 'cta')} placeholder="Ex.: Agende seu horário" />
            </Field>
            <Limit value={c.cta.length} max={L.ctaChars} />
          </div>
        </fieldset>
      </div>
    ),
    layout: (
      <div className="grid gap-6">
        <ChoiceGroup
          legend="Modelo da arte"
          variant="chip"
          value={c.variant ?? 'photo'}
          onChange={(v) => changeVariant(v)}
          options={VARIANTS.map((v) => ({ value: v.id, label: v.label, icon: <v.icon className="size-4 text-slate-600" aria-hidden /> }))}
        />
        <ChoiceGroup
          legend="Estilo visual"
          variant="media"
          className="grid grid-cols-3 gap-2 xl:grid-cols-6"
          value={c.style ?? look.style}
          onChange={(v) => set({ style: v })}
          options={STYLES.map((s) => ({ value: s.id, label: s.label, media: <img src={photoUrl(s.photo)} alt="" loading="lazy" width={120} height={120} className="aspect-square w-full object-cover" /> }))}
        />
      </div>
    ),
    cores: (
      <ChoiceGroup
        legend="Paleta de cores"
        variant="card"
        className="grid grid-cols-2 gap-2"
        value={paletteKey}
        onChange={(label) => set({ palette: palettes.find((x) => x.label === label)!.p })}
        options={palettes.map(({ label, p }) => ({
          value: label,
          label,
          icon: (
            <span className="flex shrink-0" aria-hidden>
              {[p.dark, p.mid, p.soft, p.light].map((x, k) => (
                <i key={k} className="-ml-1.5 size-6 rounded-full border-2 border-white first:ml-0" style={{ background: x }} />
              ))}
            </span>
          ),
        }))}
      />
    ),
    imagem: (
      <div className="grid gap-6">
        <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-brand-900">
            <Sparkles className="size-4 text-brand-700" aria-hidden /> Gerar imagem exclusiva com IA
          </h3>
          <div className="mt-3">
            <ChoiceGroup
              legend="Tipo de imagem"
              legendHidden
              variant="segmented"
              value={imgType}
              onChange={setImgType}
              options={[
                { value: 'fotos', label: 'Foto' },
                { value: 'ilustracoes', label: 'Ilustração' },
                { value: 'render', label: '3D' },
              ]}
            />
          </div>
          <Field label="Descreva a cena" hint="Opcional. Em branco, a IA usa o título do post." className="mt-3">
            <Input value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} placeholder={`Ex.: ${c.headline.slice(0, 40)}…`} disabled={!!generatingImg} />
          </Field>
          <Button className="mt-3 w-full sm:w-auto" variant={generatingImg ? 'secondary' : 'primary'} onClick={handleGenerateAIImage}>
            {generatingImg ? (
              <>
                <X className="size-4" aria-hidden /> Cancelar geração
              </>
            ) : (
              <>
                <Wand2 className="size-4" aria-hidden /> Gerar imagem
              </>
            )}
          </Button>
        </div>
        {photoPicker('photo', c.variant === 'beforeafter' ? 'Foto “antes”' : 'Catálogo e upload')}
        {c.variant === 'beforeafter' && photoPicker('photo2', 'Foto “depois”')}
        <p className="text-xs text-slate-600">
          Fotos de reserva:{' '}
          <a href="https://pixabay.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-800">
            Pixabay
          </a>
        </p>
        {(c.style || c.palette) && (
          <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => set({ style: undefined, palette: undefined })}>
            <RotateCcw className="size-4" aria-hidden /> Voltar ao visual da geração
          </Button>
        )}
      </div>
    ),
    legenda: (
      <div className="grid gap-4">
        <div>
          <Field label="Legenda para o Instagram">
            <Textarea value={c.caption} onChange={(e) => set({ caption: e.target.value }, 'caption')} className="min-h-[220px]" />
          </Field>
          <Limit value={c.caption.length} max={L.captionMax} min={c.kind === 'post' ? L.captionMin : undefined} />
        </div>
        <div>
          <Field label="Hashtags" hint="Separadas por espaço.">
            <Input value={c.hashtags.join(' ')} onChange={(e) => set({ hashtags: e.target.value.split(/\s+/).filter(Boolean) }, 'tags')} autoCapitalize="none" spellCheck={false} />
          </Field>
          <Limit value={c.hashtags.length} max={L.hashtagsMax} min={L.hashtagsMin} unit="hashtags" />
        </div>
      </div>
    ),
  }

  const title = c.kind === 'story' ? `Editar story ${c.order}` : `Editar post ${c.order}`
  const canvas = (
    <div className="relative mx-auto h-full w-full" style={{ maxWidth: desktop ? 420 : undefined }}>
      <div className={cx('mx-auto overflow-hidden rounded-2xl shadow-card', !desktop && 'h-full w-auto')} style={!desktop ? { aspectRatio: c.kind === 'story' ? '9/16' : look.format === '1:1' ? '1/1' : '4/5', maxWidth: '100%' } : undefined}>
        <Creative c={c} style={c.style ?? look.style} palette={c.palette ?? look.palette} format={look.format} brand={look.brand} chrome={false} />
      </div>
      {generatingImg && (
        <div role="status" className="absolute inset-0 grid place-items-center rounded-2xl bg-ink/50 text-sm font-semibold text-white">
          <span className="flex items-center gap-2">
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> Gerando imagem…
          </span>
        </div>
      )}
    </div>
  )
  const historyBtns = (
    <div className="flex items-center gap-1">
      <IconButton label="Desfazer (Ctrl+Z)" onClick={h.undo} disabled={!h.canUndo}>
        <Undo2 className="size-5" aria-hidden />
      </IconButton>
      <IconButton label="Refazer (Ctrl+Shift+Z)" onClick={h.redo} disabled={!h.canRedo}>
        <Redo2 className="size-5" aria-hidden />
      </IconButton>
      <IconButton label="Restaurar original" onClick={() => creative && h.commit(creative)} disabled={!dirty}>
        <RotateCcw className="size-5" aria-hidden />
      </IconButton>
    </div>
  )
  const toolTabs = (
    <div role="tablist" aria-label="Ferramentas" className={cx('flex', desktop ? 'gap-1 rounded-xl bg-slate-100 p-1' : 'justify-around border-t border-line bg-white pb-[var(--safe-bottom)]')}>
      {TOOLS.map((t) => {
        const on = tool === t.id
        return (
          <button
            key={t.id}
            id={`ed-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls="ed-panel"
            tabIndex={on ? 0 : -1}
            onClick={() => {
              setTool(t.id)
              if (!desktop) setExpanded(true)
            }}
            onKeyDown={(e) => {
              const i = TOOLS.findIndex((x) => x.id === tool)
              const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null
              if (n === null) return
              e.preventDefault()
              const nt = TOOLS[(n + TOOLS.length) % TOOLS.length]
              setTool(nt.id)
              document.getElementById(`ed-tab-${nt.id}`)?.focus()
            }}
            className={cx(
              'flex items-center justify-center text-sm font-semibold transition',
              desktop ? cx('min-h-10 flex-1 gap-2 rounded-lg', on ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-ink') : cx('min-h-14 flex-1 flex-col gap-0.5 text-xs', on ? 'text-brand-800' : 'text-slate-600'),
            )}
          >
            <t.icon className={cx('size-5', !desktop && on && 'rounded-full')} aria-hidden />
            {t.label}
          </button>
        )
      })}
    </div>
  )
  const panel = (
    <div id="ed-panel" role="tabpanel" aria-labelledby={`ed-tab-${tool}`} tabIndex={0} className="outline-none">
      {panels[tool]}
    </div>
  )

  return (
    <>
      <Dialog open={open} onClose={requestClose} label={title} size="full" mobile="fullscreen" bare className="md:h-[min(780px,90dvh)]" bodyClassName="flex flex-col overflow-hidden">
        <div
          className="flex h-full min-h-0 flex-col"
          onKeyDown={(e) => {
            const mod = e.ctrlKey || e.metaKey
            if (!mod) return
            const k = e.key.toLowerCase()
            if (k === 's') {
              e.preventDefault()
              save()
            } else if (k === 'z' && !e.shiftKey) {
              e.preventDefault()
              h.undo()
            } else if ((k === 'z' && e.shiftKey) || k === 'y') {
              e.preventDefault()
              h.redo()
            }
          }}
        >
          {/* header: Cancelar · title · Salvar */}
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-2 pt-[max(0.25rem,var(--safe-top))] pb-1 md:px-4 md:py-2.5">
            <Button variant="ghost" onClick={requestClose} className="px-3">
              Cancelar
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-center text-base font-bold md:text-left md:text-title-sm">
              {title}
              {dirty && <span className="sr-only"> (alterações não salvas)</span>}
              {dirty && <span className="ml-2 inline-block size-2 rounded-full bg-warning align-middle" aria-hidden />}
            </h2>
            {desktop && historyBtns}
            {desktop && (
              <Button variant="secondary" onClick={() => exportCreatives([jobFor(c, look, c.order - 1, c.headline)])}>
                <Download className="size-4" aria-hidden /> Baixar PNG
              </Button>
            )}
            <Button onClick={save} className="px-4" aria-keyshortcuts="Control+S">
              <Save className="size-4" aria-hidden /> Salvar
            </Button>
          </div>

          {desktop ? (
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,420px)_1fr] gap-8 overflow-hidden p-6">
              <div className="overflow-y-auto scroll-thin" tabIndex={0} role="region" aria-label="Prévia do criativo">
                {canvas}
                <p className="mt-3 text-center text-xs text-fg-subtle">Ctrl+S salva · Ctrl+Z desfaz · Esc fecha</p>
              </div>
              <div className="flex min-h-0 flex-col gap-4">
                {toolTabs}
                <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-6 scroll-thin">{panel}</div>
              </div>
            </div>
          ) : (
            <>
              <div className={cx('shrink-0 bg-slate-100 px-4 py-3 transition-[height] duration-300', expanded ? 'h-[26dvh]' : 'h-[50dvh]')}>{canvas}</div>
              <div className="flex min-h-0 flex-1 flex-col rounded-t-2xl bg-white shadow-[0_-8px_24px_-12px_rgb(11_26_36/0.25)]">
                <div className="flex shrink-0 items-center gap-1 px-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    aria-expanded={expanded}
                    className="flex min-h-11 flex-1 items-center gap-2 px-2 text-sm font-semibold text-slate-700"
                  >
                    <ChevronUp className={cx('size-5 transition', expanded && 'rotate-180')} aria-hidden />
                    {expanded ? 'Ver arte maior' : 'Expandir painel'}
                  </button>
                  {historyBtns}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 scroll-thin">{panel}</div>
                {toolTabs}
              </div>
            </>
          )}
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false)
          onClose()
        }}
        title="Descartar alterações?"
        confirmLabel="Descartar"
        danger
      >
        Você editou este criativo e ainda não salvou. Se sair agora, as mudanças serão perdidas.
      </ConfirmDialog>
    </>
  )
}
