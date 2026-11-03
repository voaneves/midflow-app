import { Box, ImageIcon, Images, Palette as PaletteIcon, Shapes, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../../components/creative/Creative'
import { ColorSwatches } from '../../../components/creative/parts'
import { useLook } from '../../../components/creative/helpers'
import { Button, ChoiceGroup, cx, StoriesIcon, TabPanel, Tabs, Toggle, toast } from '../../../components/ui'
import { suggestedColors } from '../../../lib/color'
import { STYLES, TONES } from '../../../lib/data'
import { ImageError, prepareLogo } from '../../../lib/image'
import { photoUrl } from '../../../lib/photos'
import { useApp } from '../../../lib/store'
import type { ImageType, ToneId } from '../../../lib/types'
import { FlowActions, FlowLayout, Panel } from './shared'
import { useExamples } from './useExamples'
import { TONE_ICON } from './icons'

const IMAGE_TYPES: { id: ImageType; label: string; icon: typeof ImageIcon; desc: string }[] = [
  { id: 'fotos', label: 'Fotos reais', icon: ImageIcon, desc: 'Fotografia editorial realista escolhida pelo tema de cada post.' },
  { id: 'ilustracoes', label: 'Ilustrações', icon: Shapes, desc: 'Arte vetorial com formas orgânicas e a paleta da sua marca.' },
  { id: 'render', label: 'Render 3D', icon: Box, desc: 'Composição 3D moderna com iluminação suave.' },
  { id: 'misto', label: 'Misto', icon: Images, desc: 'Fotografia realista combinada com composições gráficas 3D.' },
]

/** Mini frame icon for the aspect-ratio control. */
const Frame = ({ w, h }: { w: number; h: number }) => <span aria-hidden className="inline-block rounded-[3px] border-2 border-current" style={{ width: w, height: h }} />

function LogoUpload({ logo, onChange }: { logo?: string; onChange: (url: string | undefined) => void }) {
  const [over, setOver] = useState(false)
  const take = async (f?: File) => {
    if (!f) return
    try {
      onChange(await prepareLogo(f)) // validates type and the 5 MB limit, then downscales to <= 1024 px
      toast('Logo aplicado aos criativos')
    } catch (e) {
      toast(e instanceof ImageError ? e.message : 'Não foi possível usar esse arquivo. Tente outra imagem.', 'error')
    }
  }
  if (logo)
    return (
      <div className="flex h-24 items-center gap-4 rounded-xl border border-line p-3">
        <img src={logo} alt="Logo atual" className="h-full max-w-[140px] object-contain" />
        <Button variant="danger" size="sm" className="ml-auto" onClick={() => onChange(undefined)}>
          <Trash2 className="size-4" aria-hidden /> Remover logo
        </Button>
      </div>
    )
  return (
    <label
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files?.[0])
      }}
      className={cx(
        'flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-solid',
        over ? 'border-brand-600 bg-brand-50' : 'border-slate-400 hover:border-brand-500 hover:bg-brand-50/40',
      )}
    >
      <Upload className="size-5 text-slate-600" aria-hidden />
      <span className="text-sm font-semibold">
        <span className="lg:hidden">Escolher da galeria ou câmera</span>
        <span className="hidden lg:inline">Arraste o logo ou clique para enviar</span>
      </span>
      <span className="text-xs text-fg-subtle">PNG, SVG, JPG ou WebP · até 5 MB</span>
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => take(e.target.files?.[0])} />
    </label>
  )
}

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
  const segment = briefing.segment || brand.segment
  const ex = useExamples({
    segment, themeId: content.themeId, customTheme: content.customTheme, objective: content.objective, tones: st.tones,
    style: look.style, palette: look.palette, seed, brandName: brand.name, handle: brand.handle, city: briefing.location || brand.city,
  })
  const aiColors = suggestedColors(segment, st.style)
  const imgDesc = IMAGE_TYPES.find((t) => t.id === st.imageType)?.desc
  const noFormat = !content.posts && !content.stories

  const next = () => {
    markDone(3)
    nav('/app/criar/4', { state: { autoGenerate: true } })
  }

  return (
    <FlowLayout previewTitle="Prévia do estilo" preview={<StylePreview ex={ex} look={look} format={st.postFormat} styleKey={`${st.style}-${st.identity}-${st.postFormat}`} />}>
      <Panel labelledBy="step3-title" className="grid gap-7">
        <div>
          <h2 id="step3-title" className="text-title font-bold">
            Estilo
          </h2>
          <p className="mt-1 text-sm text-fg-subtle">Visual, linguagem e formato. A prévia muda na hora.</p>
        </div>

        <div className="grid gap-4">
          <ChoiceGroup
            legend="Identidade visual"
            variant="segmented"
            value={st.identity}
            onChange={(v) => set({ identity: v as 'brand' | 'ai' })}
            options={[
              { value: 'brand', label: 'Minha marca', icon: <PaletteIcon className="size-4" aria-hidden /> },
              { value: 'ai', label: 'Sugestão da IA', icon: <Wand2 className="size-4" aria-hidden /> },
            ]}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p id="s3-colors" className="mb-2 text-sm font-semibold text-ink">
                {st.identity === 'brand' ? 'Cores da marca' : 'Cores sugeridas pela IA'}
              </p>
              {st.identity === 'brand' ? (
                <ColorSwatches
                  labelledBy="s3-colors"
                  colors={st.colors}
                  onChange={(colors) => {
                    set({ colors })
                    setBrand({ colors })
                  }}
                />
              ) : (
                <ul aria-labelledby="s3-colors" className="flex flex-wrap gap-2.5">
                  {aiColors.map((c) => (
                    <li key={c} className="size-12 rounded-xl border border-black/15" style={{ background: c }}>
                      <span className="sr-only">{c}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-fg-subtle">{st.identity === 'brand' ? 'Até 5 cores. A geração prioriza essas cores.' : 'Paleta escolhida para o seu segmento e estilo.'}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">
                Logo <span className="font-normal text-fg-subtle">(opcional)</span>
              </p>
              <LogoUpload
                logo={st.logo ?? brand.logo}
                onChange={(url) => {
                  set({ logo: url })
                  setBrand({ logo: url })
                }}
              />
            </div>
          </div>
        </div>

        <ChoiceGroup
          legend="Estilo visual"
          variant="media"
          className="no-scrollbar snap-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0"
          optionClassName="w-[40%] shrink-0 sm:w-[28%] lg:w-auto"
          value={st.style}
          onChange={(v) => set({ style: v })}
          options={STYLES.map((s) => ({
            value: s.id,
            label: s.label,
            description: <span className="line-clamp-2">{s.desc}</span>,
            media: <img src={photoUrl(s.photo)} alt="" width={200} height={190} loading="lazy" decoding="async" className="aspect-[1/0.95] w-full object-cover" />,
          }))}
        />

        <div>
          <ChoiceGroup
            legend="Tipo de imagem"
            variant="chip"
            value={st.imageType}
            onChange={(v) => set({ imageType: v })}
            options={IMAGE_TYPES.map((t) => ({ value: t.id, label: t.label, icon: <t.icon className="size-4 text-slate-600" aria-hidden /> }))}
          />
          <p className="mt-2 text-xs text-fg-subtle" aria-live="polite">
            {imgDesc}
          </p>
        </div>

        <ChoiceGroup
          type="checkbox"
          legend="Linguagem e tom"
          variant="chip"
          value={st.tones}
          onChange={(v) => set({ tones: v as ToneId[] })}
          options={TONES.map((t) => {
            const I = TONE_ICON[t.id]
            return { value: t.id, label: t.label, icon: <I className="size-4 text-slate-600" aria-hidden /> }
          })}
        />

        <div className="grid gap-3">
          <ChoiceGroup
            legend="Formato dos posts"
            hint="4:5 ocupa mais espaço no feed e é o recomendado."
            variant="segmented"
            className="max-w-md"
            value={st.postFormat}
            onChange={(v) => set({ postFormat: v })}
            options={[
              { value: '1:1', label: 'Quadrado 1:1', icon: <Frame w={14} h={14} /> },
              { value: '4:5', label: 'Vertical 4:5', icon: <Frame w={13} h={16} /> },
            ]}
          />
          <div className="max-w-md rounded-xl border border-line px-3.5 py-1">
            <Toggle
              on={content.stories}
              onChange={(v) => setContent({ stories: v })}
              label={
                <span className="flex items-center gap-2">
                  <StoriesIcon className="size-5" /> Gerar Stories (9:16)
                </span>
              }
            />
          </div>
        </div>
      </Panel>

      <FlowActions
        onBack={() => nav('/app/criar/2')}
        primaryLabel="Gerar criativos"
        primaryIcon={<Sparkles className="size-5" aria-hidden />}
        blockedReason={noFormat ? 'Escolha ao menos um formato (posts ou Stories).' : undefined}
        onBlocked={() => toast('Escolha ao menos um formato', 'info')}
        onPrimary={next}
      />
    </FlowLayout>
  )
}

function StylePreview({ ex, look, format, styleKey }: { ex: ReturnType<typeof useExamples>; look: ReturnType<typeof useLook>; format: '1:1' | '4:5'; styleKey: string }) {
  const [tab, setTab] = useState<'posts' | 'stories'>('posts')
  return (
    <>
      <Tabs
        idBase="s3prev"
        label="Tipo de prévia"
        value={tab}
        onChange={setTab}
        className="bg-white ring-1 ring-line"
        items={[
          { id: 'posts', label: 'Posts' },
          { id: 'stories', label: 'Stories' },
        ]}
      />
      <div key={`${styleKey}-${tab}`} className="mt-4 animate-fade-in">
        <TabPanel idBase="s3prev" id="posts" active={tab === 'posts'}>
          <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {ex.posts.slice(0, 3).map((c) => (
              <div key={c.id} className="overflow-hidden rounded-xl shadow-card">
                <Creative c={c} style={look.style} palette={look.palette} format={format} brand={look.brand} />
              </div>
            ))}
          </div>
        </TabPanel>
        <TabPanel idBase="s3prev" id="stories" active={tab === 'stories'}>
          <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {ex.stories.map((c, i) => (
              <li key={c.id} className="relative overflow-hidden rounded-xl shadow-card">
                <Creative c={c} style={look.style} palette={look.palette} format="4:5" brand={look.brand} />
                <span className="absolute top-6 left-2 grid size-6 place-items-center rounded-full bg-white text-xs font-bold shadow" aria-hidden>
                  {i + 1}
                </span>
              </li>
            ))}
          </ol>
        </TabPanel>
      </div>
    </>
  )
}
