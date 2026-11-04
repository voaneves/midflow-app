import { ArrowRight, GraduationCap, MoreHorizontal, Plus, RefreshCw, Star, Tag, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../../components/creative/Creative'
import { useLook } from '../../../components/creative/helpers'
import { Button, ChoiceGroup, cx, Field, InstagramIcon, Input, StoriesIcon, TabPanel, Tabs, toast } from '../../../components/ui'
import { OBJECTIVES, segmentDef, THEME_CATS, type ThemeCat } from '../../../lib/data'
import { findTheme, themesFor } from '../../../lib/generator'
import { photoUrl } from '../../../lib/photos'
import { useApp } from '../../../lib/store'
import type { ObjectiveId } from '../../../lib/types'
import { FlowActions, FlowLayout, Panel, SectionTitle } from './shared'
import { useExamples } from './useExamples'

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
  const [draft, setDraft] = useState(content.customTheme)
  const [spinning, setSpinning] = useState(false)

  const segment = briefing.segment || brand.segment
  const seg = segmentDef(segment)
  const themes = cat === 'meus' ? [] : themesFor(segment, cat, cat === 'ia' ? seed : 0)
  const selected = content.themeId === 'custom' ? null : findTheme(segment, content.themeId)
  // A theme left over from another segment (e.g. the beauty demo's "cabelo") must not reach the AI.
  const staleTheme = !!content.themeId && content.themeId !== 'custom' && !selected
  useEffect(() => {
    if (staleTheme) set({ themeId: null })
  }, [staleTheme, set])
  const ex = useExamples({
    segment, themeId: content.themeId, customTheme: content.customTheme, objective: content.objective, tones: briefing.tones,
    style: look.style, palette: look.palette, format: look.format, seed, brandName: brand.name, handle: brand.handle, city: briefing.location || brand.city,
  })

  const applyCustom = () => {
    if (!draft.trim()) return
    set({ themeId: 'custom', customTheme: draft.trim() })
    toast('Tema personalizado selecionado')
  }
  const noFormat = !content.posts && !content.stories

  const next = () => {
    if (!content.themeId || staleTheme) {
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
    <FlowLayout
      previewTitle="Exemplos para este tema"
      previewAction={
        <Button variant="secondary" size="sm" onClick={regen}>
          <RefreshCw className={cx('size-4', spinning && 'animate-spin motion-reduce:animate-none')} aria-hidden /> Gerar novos exemplos
        </Button>
      }
      preview={<ContentPreview ex={ex} look={look} seedKey={`${seed}-${content.themeId}`} />}
    >
      <Panel labelledBy="step2-title" className="grid gap-7">
        <div>
          <h2 id="step2-title" className="text-title font-bold">
            Conteúdo
          </h2>
          <p className="mt-1 text-sm text-fg-subtle">Escolha o que gerar, o tema e o objetivo. Sem tema, a IA sugere um com base no seu briefing.</p>
        </div>

        <ChoiceGroup
          type="checkbox"
          legend="Tipo de conteúdo"
          value={[...(content.posts ? ['posts' as const] : []), ...(content.stories ? ['stories' as const] : [])]}
          onChange={(v) => set({ posts: v.includes('posts'), stories: v.includes('stories') })}
          hint={content.posts && content.stories ? 'Recomendado: posts e Stories a partir do mesmo tema.' : undefined}
          error={noFormat ? 'Escolha posts, Stories ou os dois.' : undefined}
          options={[
            { value: 'posts', label: 'Posts para feed', description: '4 artes com legenda e CTA', icon: <InstagramIcon className="size-8 shrink-0" /> },
            { value: 'stories', label: 'Stories', description: 'Sequência de 4 telas', icon: <StoriesIcon className="size-8 shrink-0" /> },
          ]}
        />

        <div>
          <SectionTitle id="theme-title">Tema</SectionTitle>
          <Tabs idBase="themecat" label="Categorias de tema" variant="chip" scrollable value={cat} onChange={setCat} items={THEME_CATS.map((c) => ({ id: c.id, label: c.label }))} />
          {THEME_CATS.map((c) => (
            <TabPanel key={c.id} idBase="themecat" id={c.id} active={cat === c.id} className="mt-4">
              {c.id === 'meus' ? (
                <div className="rounded-xl border border-dashed border-slate-400 p-4">
                  <Field label="Escreva o seu tema" hint="Ex.: “Lançamento do novo serviço de design de sobrancelhas”">
                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyCustom())} placeholder="Sobre o que você quer falar?" />
                  </Field>
                  <Button onClick={applyCustom} disabled={!draft.trim()} className="mt-3 w-full sm:w-auto">
                    <Plus className="size-4" aria-hidden /> Usar este tema
                  </Button>
                </div>
              ) : themes.length ? (
                <ChoiceGroup
                  legend={`Temas: ${c.label}`}
                  legendHidden
                  variant="media"
                  className="grid grid-cols-2 gap-3 md:grid-cols-4"
                  value={content.themeId}
                  onChange={(id) => set({ themeId: id, customTheme: '' })}
                  options={themes.map((t) => ({
                    value: t.id,
                    label: t.label,
                    description: t.desc,
                    media: <img src={photoUrl(t.photo)} alt="" width={320} height={200} loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover" />,
                  }))}
                />
              ) : (
                <p className="text-sm text-fg-subtle">Nenhuma sugestão nesta categoria para {seg.short.toLowerCase()}.</p>
              )}
            </TabPanel>
          ))}

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-slate-50 p-3" aria-live="polite">
            {selected ? (
              <img src={photoUrl(selected.photos?.[0] ?? selected.photo)} alt="" width={96} height={64} loading="lazy" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-800" aria-hidden>
                {content.customTheme ? 'Meu tema' : 'IA'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-fg-subtle">Tema selecionado</div>
              <div className="truncate font-semibold">{selected?.label ?? (content.customTheme || 'A IA vai escolher para você')}</div>
            </div>
          </div>
        </div>

        <div>
          <ChoiceGroup
            legend="Objetivo deste conteúdo"
            value={content.objective}
            onChange={(v) => set({ objective: v as ObjectiveId })}
            options={OBJECTIVES.map((o) => {
              const I = OBJ_ICON[o.icon]
              return { value: o.id, label: o.label, description: o.desc, icon: <I className="size-6 shrink-0 text-brand-700" strokeWidth={1.75} aria-hidden /> }
            })}
          />
          {content.objective === 'outro' && (
            <Field label="Qual resultado você quer com este conteúdo?" className="mt-3">
              <Input value={content.objectiveOther} onChange={(e) => set({ objectiveOther: e.target.value })} />
            </Field>
          )}
        </div>
      </Panel>

      <FlowActions
        onBack={() => nav('/app/criar/1')}
        primaryLabel="Continuar"
        primaryIcon={<ArrowRight className="size-5" aria-hidden />}
        blockedReason={noFormat ? 'Escolha posts, Stories ou os dois para continuar.' : undefined}
        onBlocked={() => toast('Escolha posts, Stories ou os dois', 'info')}
        onPrimary={next}
      />
    </FlowLayout>
  )
}

function ContentPreview({ ex, look, seedKey }: { ex: ReturnType<typeof useExamples>; look: ReturnType<typeof useLook>; seedKey: string }) {
  const [tab, setTab] = useState<'posts' | 'stories'>('posts')
  return (
    <>
      <Tabs
        idBase="s2prev"
        label="Tipo de exemplo"
        variant="underline"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'posts', label: `Posts (${ex.posts.length})` },
          { id: 'stories', label: `Stories (${ex.stories.length})` },
        ]}
      />
      <div key={`${seedKey}-${tab}`} className="mt-4 animate-fade-in">
        <TabPanel idBase="s2prev" id="posts" active={tab === 'posts'}>
          <div className="grid grid-cols-2 gap-3">
            {ex.posts.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-xl shadow-card">
                <Creative c={c} style={look.style} palette={look.palette} format="4:5" brand={look.brand} />
              </div>
            ))}
          </div>
        </TabPanel>
        <TabPanel idBase="s2prev" id="stories" active={tab === 'stories'}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {ex.stories.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-xl shadow-card">
                <Creative c={c} style={look.style} palette={look.palette} format="4:5" brand={look.brand} />
              </div>
            ))}
          </div>
        </TabPanel>
      </div>
      <p className="mt-4 text-xs text-fg-subtle">Os exemplos são referências. O conteúdo final é criado na etapa Gerar.</p>
    </>
  )
}
