import { AtSign, MapPin, Save, Upload, X } from 'lucide-react'
import { useMemo } from 'react'
import { Creative } from '../../components/creative/Creative'
import { ColorSwatches, readFile } from '../../components/creative/parts'
import { Button, Chip, cx, Input, Label, Select, Textarea, toast } from '../../components/ui'
import { derivePalette } from '../../lib/color'
import { SEGMENT_OPTIONS, segmentDef, STYLES, TONES } from '../../lib/data'
import { generate } from '../../lib/generator'
import { photoUrl } from '../../lib/photos'
import { briefingFromBrand, useApp } from '../../lib/store'
import type { SegmentId, ToneId } from '../../lib/types'
import { Panel, PreviewPanel, SectionTitle } from './create/shared'
import { TONE_ICON } from './create/Step1Briefing'

export function Brand() {
  const brand = useApp((s) => s.brand)
  const set = useApp((s) => s.setBrand)
  const setBriefing = useApp((s) => s.setBriefing)
  const palette = derivePalette(brand.colors)
  const sample = useMemo(() => {
    const seg = segmentDef(brand.segment)
    return generate({ segment: brand.segment, themeId: seg.themes[0].id, objective: 'atrair', tones: brand.tones, style: brand.style, palette, postFormat: '4:5', posts: true, stories: true, brandName: brand.name, handle: brand.handle, city: brand.city, seed: 21 }, 1)
  }, [brand, palette])
  const mark = { name: brand.name, handle: brand.handle, logo: brand.logo }
  const toggleTone = (t: ToneId) => set({ tones: brand.tones.includes(t) ? brand.tones.filter((x) => x !== t) : [...brand.tones, t] })

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
      <Panel>
        <h2 className="text-xl font-bold">Perfil do negócio</h2>
        <p className="mt-1 text-sm text-slate-500">Essas informações preenchem o briefing e mantêm a mesma identidade em todas as gerações.</p>

        <div className="mt-6 grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="br-name" required>
                Nome da empresa
              </Label>
              <Input id="br-name" value={brand.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="br-handle">Instagram</Label>
              <Input id="br-handle" icon={<AtSign className="size-4" />} value={brand.handle} onChange={(e) => set({ handle: e.target.value.replace(/^@/, '').replace(/\s/g, '') })} />
            </div>
            <div>
              <Label htmlFor="br-seg" required>
                Segmento
              </Label>
              <Select id="br-seg" value={brand.segment} onChange={(e) => set({ segment: e.target.value as SegmentId })}>
                {SEGMENT_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="br-city">Cidade</Label>
              <Input id="br-city" icon={<MapPin className="size-4" />} value={brand.city} onChange={(e) => set({ city: e.target.value })} placeholder="Ex: Palmas - TO" />
            </div>
          </div>
          <div>
            <Label htmlFor="br-about">Sobre o negócio</Label>
            <Textarea id="br-about" max={500} value={brand.about} onChange={(e) => set({ about: e.target.value })} placeholder="O que vocês fazem, diferenciais e para quem." />
          </div>
          <div>
            <Label htmlFor="br-aud">Público-alvo</Label>
            <Textarea id="br-aud" max={300} value={brand.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="Quem é o cliente ideal?" />
          </div>

          <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
            <div>
              <Label hint="(até 5)">Cores da marca</Label>
              <ColorSwatches colors={brand.colors} onChange={(colors) => set({ colors })} />
            </div>
            <div>
              <Label hint="(PNG ou SVG)">Logo</Label>
              {brand.logo ? (
                <div className="flex h-[76px] items-center gap-3 rounded-xl border border-line p-3">
                  <img src={brand.logo} alt="Logo" className="h-full max-w-[140px] object-contain" />
                  <button onClick={() => set({ logo: undefined })} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600">
                    <X className="size-4" /> Remover
                  </button>
                </div>
              ) : (
                <label className="flex h-[76px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:border-brand-400">
                  <Upload className="size-4" /> Enviar logo
                  <input
                    type="file"
                    accept="image/png,image/svg+xml,image/webp,image/jpeg"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (f) set({ logo: await readFile(f) })
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <div>
            <SectionTitle>Tom de comunicação</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => {
                const I = TONE_ICON[t.id]
                return (
                  <Chip key={t.id} active={brand.tones.includes(t.id)} onClick={() => toggleTone(t.id)} icon={<I className="size-4 text-slate-400" />}>
                    {t.label}
                  </Chip>
                )
              })}
            </div>
          </div>

          <div>
            <SectionTitle>Estilo visual padrão</SectionTitle>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {STYLES.map((s) => (
                <button key={s.id} onClick={() => set({ style: s.id })} className={cx('overflow-hidden rounded-xl border bg-white text-center text-[12.5px] font-semibold transition', brand.style === s.id ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:border-slate-300')}>
                  <img src={photoUrl(s.photo)} alt="" className="aspect-square w-full object-cover" />
                  <div className="py-1.5">{s.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-2 border-t border-line pt-5">
          <Button
            variant="secondary"
            onClick={() => {
              setBriefing(briefingFromBrand(brand))
              toast('Briefing atualizado com os dados da marca')
            }}
          >
            Aplicar ao briefing
          </Button>
          <Button onClick={() => toast('Marca salva')}>
            <Save className="size-4" /> Salvar marca
          </Button>
        </div>
      </Panel>

      <PreviewPanel className="xl:sticky xl:top-[100px] xl:self-start">
        <h2 className="text-lg font-bold">Como sua marca aparece</h2>
        <p className="text-[13px] text-slate-500">A prévia muda conforme você edita cores, logo, tom e estilo.</p>
        <div className="mt-5 grid grid-cols-[1.25fr_1fr] items-start gap-4">
          <div className="overflow-hidden rounded-xl shadow-card">
            <Creative c={sample.posts[0]} style={brand.style} palette={palette} format="4:5" brand={mark} />
          </div>
          <div className="overflow-hidden rounded-xl shadow-card">
            <Creative c={sample.stories[3]} style={brand.style} palette={palette} format="4:5" brand={mark} />
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-line bg-white p-4">
          <div className="text-xs font-semibold text-slate-500">Exemplo de legenda no seu tom</div>
          <p className="mt-2 line-clamp-6 text-sm leading-relaxed whitespace-pre-line text-slate-700">{sample.posts[0].caption}</p>
        </div>
      </PreviewPanel>
    </div>
  )
}
