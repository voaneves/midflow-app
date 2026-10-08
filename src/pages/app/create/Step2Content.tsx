import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, GraduationCap, MoreHorizontal, Plus, RefreshCw, Star, Tag, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../../components/creative/Creative'
import { useLook } from '../../../components/creative/parts'
import { Button, CheckBadge, cx, InstagramIcon, Input, StoriesIcon, toast } from '../../../components/ui'
import { OBJECTIVES, segmentDef, THEME_CATS, type ThemeCat } from '../../../lib/data'
import { findTheme, themesFor } from '../../../lib/generator'
import { photoUrl } from '../../../lib/photos'
import { useApp } from '../../../lib/store'
import type { ObjectiveId } from '../../../lib/types'
import { Panel, PreviewPanel, SectionTitle, useExamples } from './shared'

const OBJ_ICON: Record<string, typeof Users> = { users: Users, tag: Tag, graduation: GraduationCap, star: Star, more: MoreHorizontal }

export function Step2Content() {
  const nav = useNavigate()
  const content = useApp((s) => s.content)
  const set = useApp((s) => s.setContent)
  const briefing = useApp((s) => s.briefing)
  const brand = useApp((s) => s.brand)
  const markDone = useApp((s) => s.markDone)
  const seed = useApp((s) => s.exampleSeed)
  const newExamples = useApp((s) => s.newExamples)
  const look = useLook()
  const [cat, setCat] = useState<ThemeCat | 'meus'>('ia')
  const [tab, setTab] = useState<'posts' | 'stories'>('posts')
  const [draft, setDraft] = useState(content.customTheme)
  const [spinning, setSpinning] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  const segment = briefing.segment || brand.segment
  const seg = segmentDef(segment)
  const themes = cat === 'meus' ? [] : themesFor(segment, cat, cat === 'ia' ? seed : 0)
  const selected = content.themeId === 'custom' ? null : findTheme(segment, content.themeId)
  const ex = useExamples({
    segment, themeId: content.themeId, customTheme: content.customTheme, objective: content.objective, tones: briefing.tones,
    style: look.style, palette: look.palette, format: look.format, seed, brandName: brand.name, handle: brand.handle, city: briefing.location || brand.city,
  })

  const choose = (id: string) => set({ themeId: id, customTheme: '' })
  const applyCustom = () => {
    if (!draft.trim()) return
    set({ themeId: 'custom', customTheme: draft.trim() })
    toast('Tema personalizado selecionado')
  }

  const next = () => {
    if (!content.posts && !content.stories) return toast('Escolha posts, Stories ou os dois', 'info')
    if (!content.themeId) {
      const pickT = themesFor(segment, 'ia', seed)[0]
      set({ themeId: pickT.id })
      toast(`A IA escolheu o tema “${pickT.label}” para você`, 'info')
    }
    markDone(2)
    nav('/app/criar/3')
  }

  const regen = () => {
    setSpinning(true)
    newExamples()
    setTimeout(() => setSpinning(false), 500)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">2. Conteúdo</h2>
            <p className="mt-1 text-sm text-slate-500">Defina os tipos de conteúdo, escolha um tema ou use nossas sugestões com base no seu briefing.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => nav('/app/criar/1')}>
            <ArrowLeft className="size-4" /> Voltar para o briefing
          </Button>
        </div>

        <SectionTitle>Selecione o tipo de conteúdo</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { k: 'posts' as const, title: 'Posts para feed', sub: 'Imagens com legenda, design e CTA', icon: <InstagramIcon className="size-8" /> },
            { k: 'stories' as const, title: 'Stories', sub: 'Sequência de stories estratégicos', icon: <StoriesIcon className="size-8" /> },
          ].map((f) => (
            <button key={f.k} type="button" onClick={() => set({ [f.k]: !content[f.k] })} aria-pressed={content[f.k]} className={cx('flex items-center gap-3.5 rounded-xl border p-4 text-left transition', content[f.k] ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-200' : 'border-line hover:border-slate-300')}>
              {f.icon}
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-semibold">{f.title}</span>
                <span className="block text-xs text-slate-500">{f.sub}</span>
              </span>
              <CheckBadge on={content[f.k]} />
            </button>
          ))}
        </div>
        {content.posts && content.stories && <p className="mt-2 text-xs font-medium text-brand-700">Recomendado: posts e Stories a partir do mesmo tema.</p>}

        <div className="mt-7" ref={gridRef}>
          <SectionTitle>Escolha um tema ou deixe a IA sugerir</SectionTitle>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {THEME_CATS.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={cx('h-9 shrink-0 rounded-lg px-3.5 text-[13px] font-semibold transition', cat === c.id ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {c.label}
              </button>
            ))}
          </div>

          {cat === 'meus' ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4">
              <label htmlFor="my-theme" className="text-sm font-semibold">
                Escreva o seu tema
              </label>
              <p className="mb-3 text-xs text-slate-500">Ex.: “Lançamento do novo serviço de design de sobrancelhas”</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="my-theme" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyCustom()} placeholder="Sobre o que você quer falar?" className="flex-1" />
                <Button onClick={applyCustom} disabled={!draft.trim()}>
                  <Plus className="size-4" /> Usar este tema
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {themes.map((t) => {
                const on = content.themeId === t.id
                return (
                  <button key={t.id} onClick={() => choose(t.id)} className={cx('group relative overflow-hidden rounded-xl border bg-white text-left transition duration-300', on ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:-translate-y-1 hover:shadow-pop')} aria-pressed={on}>
                    <span className="block overflow-hidden"><img src={photoUrl(t.photo)} alt="" className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-105" /></span>
                    {on && (
                      <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-brand-600 text-white shadow animate-pop">
                        <Check className="size-4" strokeWidth={3} />
                      </span>
                    )}
                    <div className="p-2.5">
                      <div className="text-[13px] leading-tight font-semibold">{t.label}</div>
                      <div className="mt-0.5 truncate text-[11.5px] text-slate-500">{t.desc}</div>
                    </div>
                  </button>
                )
              })}
              {!themes.length && <p className="col-span-full text-sm text-slate-500">Nenhuma sugestão nesta categoria para {seg.short.toLowerCase()}.</p>}
            </div>
          )}
        </div>

        <div className="mt-7">
          <SectionTitle>Tema selecionado</SectionTitle>
          <div className="flex items-center gap-3 rounded-xl border border-line p-3 sm:gap-4">
            {selected ? <img src={photoUrl(selected.photos?.[0] ?? selected.photo)} alt="" className="h-14 w-16 shrink-0 rounded-lg object-cover sm:h-16 sm:w-24" /> : <div className="grid h-14 w-16 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700 sm:h-16 sm:w-24">{content.customTheme ? 'Meu tema' : 'IA'}</div>}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{selected?.label ?? (content.customTheme || 'A IA vai escolher para você')}</div>
              <div className="truncate text-sm text-slate-500">{selected?.desc ?? (content.customTheme ? 'Tema personalizado' : 'Com base no seu briefing')}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <ArrowLeftRight className="size-4" /> <span className="hidden sm:inline">Alterar</span>
            </Button>
          </div>
        </div>

        <div className="mt-7">
          <SectionTitle>Objetivo deste conteúdo</SectionTitle>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-2.5">
            {OBJECTIVES.map((o) => {
              const I = OBJ_ICON[o.icon]
              const on = content.objective === o.id
              return (
                <button key={o.id} onClick={() => set({ objective: o.id as ObjectiveId })} title={o.desc} aria-pressed={on} className={cx('relative flex flex-col items-center gap-2 rounded-xl border px-1.5 py-3.5 text-center text-[12px] leading-tight font-semibold transition sm:px-2 sm:py-4 sm:text-[12.5px]', on ? 'border-brand-500 bg-brand-50/60 text-brand-800' : 'border-line text-slate-600 hover:border-slate-300')}>
                  {on && <span className="absolute top-2 right-2"><CheckBadge on /></span>}
                  <I className={cx('size-6', on ? 'text-brand-700' : 'text-slate-500')} strokeWidth={1.7} />
                  {o.label}
                </button>
              )
            })}
          </div>
          {content.objective === 'outro' && (
            <Input id="obj-other" className="mt-3" placeholder="Qual resultado você quer com este conteúdo?" value={content.objectiveOther} onChange={(e) => set({ objectiveOther: e.target.value })} />
          )}
        </div>

        <div className="mt-8">
          <Button size="lg" onClick={next} className="w-full sm:w-auto">
            Continuar para o estilo <ArrowRight className="size-5" />
          </Button>
        </div>
      </Panel>

      <PreviewPanel className="xl:sticky xl:top-[100px] xl:self-start">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Exemplos gerados para este tema</h2>
            <p className="text-[13px] text-slate-500">Veja como podem ficar seus posts e stories. Na próxima etapa você pode ajustar o estilo.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={regen}>
            <RefreshCw className={cx('size-4', spinning && 'animate-spin')} /> Gerar novos exemplos
          </Button>
        </div>
        <div className="mt-4 flex gap-6 border-b border-line">
          {(['posts', 'stories'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cx('-mb-px border-b-2 pb-2.5 text-sm font-semibold transition', tab === t ? 'border-brand-600 text-brand-800' : 'border-transparent text-slate-500')}>
              {t === 'posts' ? `Posts para feed (${ex.posts.length})` : `Stories (${ex.stories.length})`}
            </button>
          ))}
        </div>
        <div key={`${seed}-${tab}-${content.themeId}`} className="mt-4 animate-fade-in">
          {tab === 'posts' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ex.posts.map((c) => (
                <div key={c.id} className="overflow-hidden rounded-xl shadow-card">
                  <Creative c={c} style={look.style} palette={look.palette} format="4:5" brand={look.brand} />
                </div>
              ))}
            </div>
          ) : null}
          <div className={cx(tab === 'posts' ? 'mt-6' : '')}>
            {tab === 'posts' && <h3 className="mb-3 text-sm font-bold">Sequência de Stories sugerida ({ex.stories.length} telas)</h3>}
            <div className="grid grid-cols-4 gap-2.5">
              {ex.stories.map((c) => (
                <div key={c.id} className="relative overflow-hidden rounded-xl shadow-card">
                  <Creative c={c} style={look.style} palette={look.palette} format="4:5" brand={look.brand} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">Os exemplos são referências. O conteúdo final é criado na etapa Gerar.</p>
      </PreviewPanel>
    </div>
  )
}
