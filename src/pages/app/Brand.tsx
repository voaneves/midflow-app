import { AtSign, Check, Crown, MapPin, PenSquare, Plus, Trash2, Upload, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../components/creative/Creative'
import { ColorSwatches } from '../../components/creative/parts'
import { ActionBar, Badge, Button, ChoiceGroup, ConfirmDialog, cx, Dialog, Field, IconButton, Input, Select, Textarea, toast, useSavedIndicator } from '../../components/ui'
import { derivePalette } from '../../lib/color'
import { planDef, SEGMENT_OPTIONS, segmentDef, STYLES, TONES } from '../../lib/data'
import { generate } from '../../lib/generator'
import { ImageError, prepareLogo } from '../../lib/image'
import { photoUrl } from '../../lib/photos'
import { briefingFromBrand, useApp } from '../../lib/store'
import type { Brand as BrandType, SegmentId, StyleId, ToneId } from '../../lib/types'
import { FlowLayout, Panel } from './create/shared'
import { TONE_ICON } from './create/icons'

const EMPTY_FORM = { name: '', handle: '', segment: 'beleza' as SegmentId, city: '' }

function Avatar({ b }: { b: BrandType }) {
  const color = b.colors?.[0] || '#0B7A5E'
  return (
    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-bold text-white" style={{ backgroundColor: color }} aria-hidden>
      {b.logo ? <img src={b.logo} alt="" className="size-full bg-white object-contain p-1" /> : b.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

export function Brand() {
  const nav = useNavigate()
  const brand = useApp((s) => s.brand)
  const brands = useApp((s) => s.brands) || [brand]
  const plan = useApp((s) => s.plan)
  const set = useApp((s) => s.setBrand)
  const switchBrand = useApp((s) => s.switchBrand)
  const addBrand = useApp((s) => s.addBrand)
  const deleteBrand = useApp((s) => s.deleteBrand)
  const setBriefing = useApp((s) => s.setBriefing)

  const currentPlan = planDef(plan)
  const maxProfiles = currentPlan.profiles

  const [newOpen, setNewOpen] = useState(false)
  const [limitOpen, setLimitOpen] = useState(false)
  const [toDelete, setToDelete] = useState<BrandType | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const saved = useSavedIndicator(JSON.stringify(brand))

  const palette = derivePalette(brand.colors)
  const sample = useMemo(() => {
    const seg = segmentDef(brand.segment)
    return generate(
      { segment: brand.segment, themeId: seg.themes[0].id, objective: 'atrair', tones: brand.tones, style: brand.style, palette, postFormat: '4:5', posts: true, stories: true, brandName: brand.name, handle: brand.handle, city: brand.city, seed: 21 },
      1,
    )
  }, [brand, palette])
  const mark = { name: brand.name, handle: brand.handle, logo: brand.logo }

  const openNew = () => {
    if (brands.length >= maxProfiles) return setLimitOpen(true)
    setForm(EMPTY_FORM)
    setFormError('')
    setNewOpen(true)
  }

  const createBrand = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('Digite o nome da empresa.')
      document.getElementById('nb-name')?.focus()
      return
    }
    const seg = segmentDef(form.segment)
    const b: BrandType = {
      id: `brand-${Date.now()}`,
      name: form.name.trim(),
      handle: (form.handle || form.name).toLowerCase().replace(/[^a-z0-9._]/g, ''),
      segment: form.segment,
      city: form.city.trim(),
      about: '',
      audience: '',
      colors: seg.palette,
      tones: ['profissional'],
      style: 'moderno',
    }
    if (addBrand(b)) {
      toast(`Empresa "${b.name}" adicionada`)
      setNewOpen(false)
    } else {
      setNewOpen(false)
      setLimitOpen(true)
    }
  }

  const preview = (
    <>
      <div className="grid grid-cols-[1.25fr_1fr] items-start gap-3 sm:gap-4">
        <div className="overflow-hidden rounded-xl shadow-card">
          <Creative c={sample.posts[0]} style={brand.style} palette={palette} format="4:5" brand={mark} label={`Exemplo de post: ${sample.posts[0].headline}`} />
        </div>
        <div className="overflow-hidden rounded-xl shadow-card">
          <Creative c={sample.stories[3]} style={brand.style} palette={palette} format="4:5" brand={mark} label={`Exemplo de story: ${sample.stories[3].headline}`} />
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        <h3 className="text-caption font-semibold text-fg-subtle">Exemplo de legenda no seu tom</h3>
        <p className="mt-2 line-clamp-6 text-sm leading-relaxed whitespace-pre-line text-fg-muted">{sample.posts[0].caption}</p>
      </div>
    </>
  )

  return (
    <>
      <FlowLayout preview={preview} previewTitle={`Como a marca ${brand.name} aparece`}>
        <div className="grid gap-4 sm:gap-6">
          {/* Brand switcher */}
          <Panel labelledBy="br-list">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="br-list" className="text-title-sm font-bold">
                  Suas empresas
                </h2>
                <p className="mt-0.5 text-sm text-fg-subtle">
                  {brands.length} de {maxProfiles} perfis do plano {currentPlan.name}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={openNew}>
                <Plus className="size-4" aria-hidden /> Nova empresa
              </Button>
            </div>
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {brands.map((b) => {
                const active = b.id === brand.id
                return (
                  <li key={b.id || b.name} className={cx('flex items-center gap-3 px-3 py-2.5', active && 'bg-brand-50/60')}>
                    <Avatar b={b} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{b.name}</p>
                      <p className="truncate text-caption text-fg-subtle">
                        {segmentDef(b.segment).short}
                        {b.handle && ` · @${b.handle}`}
                      </p>
                    </div>
                    {active ? (
                      <Badge className="bg-brand-100 text-brand-900">
                        <Check className="size-3.5" aria-hidden /> Em uso
                      </Badge>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => b.id && (switchBrand(b.id), toast(`Usando ${b.name}`))}>
                        Usar<span className="sr-only"> {b.name}</span>
                      </Button>
                    )}
                    {brands.length > 1 && (
                      <IconButton label={`Excluir ${b.name}`} onClick={() => setToDelete(b)} className="text-fg-subtle hover:text-danger">
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    )}
                  </li>
                )
              })}
            </ul>
          </Panel>

          {/* Identity */}
          <Panel labelledBy="br-id">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="br-id" className="text-title-sm font-bold">
                Identificação
              </h2>
              <p role="status" className="text-caption text-fg-subtle">
                {saved === 'saving' ? 'Salvando…' : saved === 'saved' ? 'Alterações salvas' : 'Salvo automaticamente'}
              </p>
            </div>
            <p className="mt-0.5 text-sm text-fg-subtle">Esses dados alimentam o briefing e mantêm a mesma identidade em todas as gerações.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Nome da empresa" id="br-name" required error={brand.name.trim() ? undefined : 'O nome não pode ficar vazio.'}>
                <Input autoComplete="organization" value={brand.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field label="Instagram" id="br-handle">
                <Input icon={<AtSign className="size-4" aria-hidden />} autoCapitalize="none" autoCorrect="off" value={brand.handle} onChange={(e) => set({ handle: e.target.value.replace(/^@/, '').replace(/\s/g, '') })} />
              </Field>
              <Field label="Segmento" id="br-seg" required>
                <Select value={brand.segment} onChange={(e) => set({ segment: e.target.value as SegmentId })}>
                  {SEGMENT_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cidade / região" id="br-city">
                <Input icon={<MapPin className="size-4" aria-hidden />} autoComplete="address-level2" value={brand.city} onChange={(e) => set({ city: e.target.value })} placeholder="Ex: Palmas - TO" />
              </Field>
            </div>
          </Panel>

          {/* About */}
          <Panel labelledBy="br-about-h">
            <h2 id="br-about-h" className="text-title-sm font-bold">
              Negócio e público
            </h2>
            <div className="mt-4 grid gap-4">
              <Field label="Sobre o negócio" id="br-about">
                <Textarea max={500} value={brand.about} onChange={(e) => set({ about: e.target.value })} placeholder="O que vocês fazem, diferenciais e forma de atendimento." />
              </Field>
              <Field label="Público-alvo principal" id="br-aud">
                <Textarea max={300} value={brand.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="Quem é o cliente ideal? O que ele busca ou valoriza?" />
              </Field>
            </div>
          </Panel>

          {/* Visual identity */}
          <Panel labelledBy="br-visual">
            <h2 id="br-visual" className="text-title-sm font-bold">
              Identidade visual
            </h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <p id="br-colors" className="mb-2 text-sm font-semibold">
                  Cores da marca <span className="font-normal text-fg-subtle">(até 5)</span>
                </p>
                <ColorSwatches colors={brand.colors} onChange={(colors) => set({ colors })} labelledBy="br-colors" />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">
                  Logo <span className="font-normal text-fg-subtle">(PNG ou SVG)</span>
                </p>
                {brand.logo ? (
                  <div className="flex h-[76px] items-center gap-3 rounded-xl border border-line p-3">
                    <img src={brand.logo} alt={`Logo de ${brand.name}`} className="h-full max-w-[140px] object-contain" />
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={() => set({ logo: undefined })}>
                      <X className="size-4" aria-hidden /> Remover
                    </Button>
                  </div>
                ) : (
                  <label className="flex h-[76px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-400 text-sm font-semibold text-fg-muted focus-within:ring-2 focus-within:ring-focus hover:border-brand-500">
                    <Upload className="size-4" aria-hidden /> Enviar logo
                    <input
                      type="file"
                      accept="image/png,image/svg+xml,image/webp,image/jpeg"
                      className="sr-only"
                      onChange={async (e) => {
                        const input = e.target
                        const f = input.files?.[0]
                        if (!f) return
                        try {
                          set({ logo: await prepareLogo(f) })
                        } catch (err) {
                          toast(err instanceof ImageError ? err.message : 'Não foi possível usar esse arquivo. Tente outra imagem.', 'error')
                        }
                        input.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            <ChoiceGroup
              legend="Estilo visual padrão"
              variant="media"
              className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-6"
              value={brand.style}
              onChange={(style: StyleId) => set({ style })}
              options={STYLES.map((s) => ({ value: s.id, label: s.label, media: <img src={photoUrl(s.photo)} alt="" className="aspect-square w-full object-cover" /> }))}
            />
          </Panel>

          {/* Tone */}
          <Panel labelledBy="br-tone">
            <h2 id="br-tone" className="sr-only">
              Tom de voz
            </h2>
            <ChoiceGroup
              type="checkbox"
              legend="Tom de comunicação preferido"
              hint="Escolha um ou mais."
              variant="chip"
              value={brand.tones}
              onChange={(tones: ToneId[]) => set({ tones })}
              options={TONES.map((t) => {
                const I = TONE_ICON[t.id]
                return { value: t.id, label: t.label, icon: <I className="size-4" aria-hidden /> }
              })}
            />
          </Panel>
        </div>

        <ActionBar>
          <Button
            variant="secondary"
            className="flex-1 lg:flex-none"
            onClick={() => {
              setBriefing(briefingFromBrand(brand))
              toast('Briefing atualizado com os dados desta empresa')
            }}
          >
            Aplicar ao briefing
          </Button>
          <Button
            className="flex-1 lg:flex-none"
            onClick={() => {
              setBriefing(briefingFromBrand(brand))
              nav('/app/criar/1')
            }}
          >
            <PenSquare className="size-4" aria-hidden /> Criar conteúdo
          </Button>
        </ActionBar>
      </FlowLayout>

      <Dialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nova empresa"
        description="Cada empresa tem identidade, fotos e tom de voz próprios."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="nb-form">
              Criar empresa
            </Button>
          </div>
        }
      >
        <form id="nb-form" onSubmit={createBrand} noValidate className="grid gap-4 px-5 py-4 md:px-6">
          <Field label="Nome da empresa" id="nb-name" required error={formError}>
            <Input autoComplete="organization" placeholder="Ex: Studio Bella, Café Central…" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Instagram" id="nb-handle">
              <Input icon={<AtSign className="size-4" aria-hidden />} autoCapitalize="none" placeholder="empresa" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
            </Field>
            <Field label="Cidade" id="nb-city">
              <Input autoComplete="address-level2" placeholder="Ex: Palmas - TO" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
          </div>
          <Field label="Segmento de atuação" id="nb-seg" required>
            <Select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value as SegmentId })}>
              {SEGMENT_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        title="Limite de empresas atingido"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setLimitOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                setLimitOpen(false)
                nav('/app/planos')
              }}
            >
              Ver planos
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 px-5 py-4 md:px-6">
          <p className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
            <Crown className="size-6 shrink-0 text-brand-700" aria-hidden />
            <span>
              O plano <strong>{currentPlan.name}</strong> permite até <strong>{maxProfiles} perfis de negócio</strong>.
            </span>
          </p>
          <p className="text-sm text-fg-muted">Para gerenciar mais negócios ou clientes de agência na mesma conta, faça upgrade para o Pro (até 2 perfis) ou Business (até 5 perfis).</p>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir empresa?"
        confirmLabel="Excluir"
        danger
        onConfirm={() => {
          if (toDelete?.id) deleteBrand(toDelete.id)
          toast(`Empresa "${toDelete?.name}" removida`)
          setToDelete(null)
        }}
      >
        <p className="text-sm text-fg-muted">
          A empresa <strong>{toDelete?.name}</strong> e suas configurações serão removidas deste navegador.
        </p>
      </ConfirmDialog>
    </>
  )
}
