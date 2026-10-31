import { AtSign, Building2, Crown, MapPin, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../components/creative/Creative'
import { ColorSwatches, readFile } from '../../components/creative/parts'
import { Button, Chip, cx, Input, Label, Modal, Select, Textarea, toast } from '../../components/ui'
import { derivePalette } from '../../lib/color'
import { planDef, SEGMENT_OPTIONS, segmentDef, STYLES, TONES } from '../../lib/data'
import { generate } from '../../lib/generator'
import { photoUrl } from '../../lib/photos'
import { briefingFromBrand, useApp } from '../../lib/store'
import type { Brand as BrandType, SegmentId, ToneId } from '../../lib/types'
import { Panel, PreviewPanel, SectionTitle } from './create/shared'
import { TONE_ICON } from './create/Step1Briefing'

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

  const currentPlanDef = planDef(plan)
  const maxProfiles = currentPlanDef.profiles

  const [modalNew, setModalNew] = useState(false)
  const [modalLimit, setModalLimit] = useState(false)
  const [modalDelete, setModalDelete] = useState<BrandType | null>(null)

  const [newBrandForm, setNewBrandForm] = useState({
    name: '',
    handle: '',
    segment: 'beleza' as SegmentId,
    city: '',
  })

  const palette = derivePalette(brand.colors)
  const sample = useMemo(() => {
    const seg = segmentDef(brand.segment)
    return generate(
      {
        segment: brand.segment,
        themeId: seg.themes[0].id,
        objective: 'atrair',
        tones: brand.tones,
        style: brand.style,
        palette,
        postFormat: '4:5',
        posts: true,
        stories: true,
        brandName: brand.name,
        handle: brand.handle,
        city: brand.city,
        seed: 21,
      },
      1,
    )
  }, [brand, palette])

  const mark = { name: brand.name, handle: brand.handle, logo: brand.logo }
  const toggleTone = (t: ToneId) =>
    set({ tones: brand.tones.includes(t) ? brand.tones.filter((x) => x !== t) : [...brand.tones, t] })

  const handleOpenNewBrand = () => {
    if (brands.length >= maxProfiles) {
      setModalLimit(true)
    } else {
      setNewBrandForm({
        name: '',
        handle: '',
        segment: 'beleza',
        city: '',
      })
      setModalNew(true)
    }
  }

  const handleCreateBrand = () => {
    if (!newBrandForm.name.trim()) {
      toast('Digite o nome da empresa', 'error')
      return
    }

    const seg = segmentDef(newBrandForm.segment)
    const newB: BrandType = {
      id: `brand-${Date.now()}`,
      name: newBrandForm.name.trim(),
      handle: (newBrandForm.handle || newBrandForm.name).toLowerCase().replace(/[^a-z0-9._]/g, ''),
      segment: newBrandForm.segment,
      city: newBrandForm.city.trim(),
      about: '',
      audience: '',
      colors: seg.palette,
      tones: ['profissional'],
      style: 'moderno',
    }

    const ok = addBrand(newB)
    if (ok) {
      toast(`Empresa "${newB.name}" adicionada com sucesso!`)
      setModalNew(false)
    } else {
      setModalLimit(true)
    }
  }

  const handleDeleteConfirm = () => {
    if (!modalDelete) return
    if (modalDelete.id) deleteBrand(modalDelete.id)
    toast(`Empresa "${modalDelete.name}" removida.`)
    setModalDelete(null)
  }

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
      <Panel>
        {/* Seletor Multi-Empresa */}
        <div className="mb-6 rounded-2xl border border-line bg-canvas p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <Building2 className="size-4 text-brand-700" /> Suas Empresas & Marcas
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Você está usando {brands.length} de {maxProfiles} perfis de negócio permitidos no Plano {currentPlanDef.name}.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleOpenNewBrand} className="gap-1.5 text-xs">
              <Plus className="size-3.5" /> Nova Empresa
            </Button>
          </div>

          <div className="mt-3.5 flex flex-wrap gap-2">
            {brands.map((b) => {
              const isActive = b.id === brand.id
              return (
                <div
                  key={b.id || b.name}
                  className={cx(
                    'group flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition',
                    isActive
                      ? 'border-brand-500 bg-white text-brand-900 shadow-xs ring-2 ring-brand-100'
                      : 'border-line bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white',
                  )}
                >
                  <button onClick={() => b.id && switchBrand(b.id)} className="flex items-center gap-1.5 text-left">
                    <span className="size-2 rounded-full" style={{ backgroundColor: b.colors?.[0] || '#0B7A5E' }} />
                    <span className="max-w-[140px] truncate">{b.name}</span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500">
                      {segmentDef(b.segment).short}
                    </span>
                  </button>

                  {brands.length > 1 && (
                    <button
                      onClick={() => setModalDelete(b)}
                      className="ml-1 text-slate-300 transition hover:text-red-500"
                      title="Excluir empresa"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Perfil de: {brand.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Essas informações alimentam o briefing automático e mantêm a mesma identidade em todas as gerações.
            </p>
          </div>
        </div>

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
              <Input
                id="br-handle"
                icon={<AtSign className="size-4" />}
                value={brand.handle}
                onChange={(e) => set({ handle: e.target.value.replace(/^@/, '').replace(/\s/g, '') })}
              />
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
              <Label htmlFor="br-city">Cidade / Região</Label>
              <Input
                id="br-city"
                icon={<MapPin className="size-4" />}
                value={brand.city}
                onChange={(e) => set({ city: e.target.value })}
                placeholder="Ex: Palmas - TO"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="br-about">Sobre o negócio</Label>
            <Textarea
              id="br-about"
              max={500}
              value={brand.about}
              onChange={(e) => set({ about: e.target.value })}
              placeholder="O que vocês fazem, diferenciais e diferenciais de atendimento."
            />
          </div>
          <div>
            <Label htmlFor="br-aud">Público-alvo principal</Label>
            <Textarea
              id="br-aud"
              max={300}
              value={brand.audience}
              onChange={(e) => set({ audience: e.target.value })}
              placeholder="Quem é o cliente ideal? O que ele busca ou valoriza?"
            />
          </div>

          <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
            <div>
              <Label hint="(até 5 cores)">Paleta de cores da marca</Label>
              <ColorSwatches colors={brand.colors} onChange={(colors) => set({ colors })} />
            </div>
            <div>
              <Label hint="(PNG ou SVG)">Logo da empresa</Label>
              {brand.logo ? (
                <div className="flex h-[76px] items-center gap-3 rounded-xl border border-line p-3">
                  <img src={brand.logo} alt="Logo" className="h-full max-w-[140px] object-contain" />
                  <button
                    onClick={() => set({ logo: undefined })}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600"
                  >
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
            <SectionTitle>Tom de comunicação preferido</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => {
                const I = TONE_ICON[t.id]
                return (
                  <Chip
                    key={t.id}
                    active={brand.tones.includes(t.id)}
                    onClick={() => toggleTone(t.id)}
                    icon={<I className="size-4 text-slate-400" />}
                  >
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
                <button
                  key={s.id}
                  onClick={() => set({ style: s.id })}
                  className={cx(
                    'overflow-hidden rounded-xl border bg-white text-center text-[12.5px] font-semibold transition',
                    brand.style === s.id ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:border-slate-300',
                  )}
                >
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
              toast('Briefing atualizado com os dados desta empresa')
            }}
          >
            Aplicar dados ao briefing
          </Button>
          <Button
            onClick={() => {
              toast(`Marca "${brand.name}" salva com sucesso!`)
            }}
          >
            <Save className="size-4" /> Salvar alterações
          </Button>
        </div>
      </Panel>

      <PreviewPanel className="xl:sticky xl:top-[100px] xl:self-start">
        <h2 className="text-lg font-bold">Como a marca {brand.name} aparece</h2>
        <p className="text-[13px] text-slate-500">
          A prévia atualiza automaticamente conforme você ajusta cores, estilo e logotipo.
        </p>
        <div className="mt-5 grid grid-cols-[1.25fr_1fr] items-start gap-4">
          <div className="overflow-hidden rounded-xl shadow-card">
            <Creative c={sample.posts[0]} style={brand.style} palette={palette} format="4:5" brand={mark} />
          </div>
          <div className="overflow-hidden rounded-xl shadow-card">
            <Creative c={sample.stories[3]} style={brand.style} palette={palette} format="4:5" brand={mark} />
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-line bg-white p-4">
          <div className="text-xs font-semibold text-slate-500">Exemplo de legenda personalizada no seu tom</div>
          <p className="mt-2 line-clamp-6 text-sm leading-relaxed whitespace-pre-line text-slate-700">
            {sample.posts[0].caption}
          </p>
        </div>
      </PreviewPanel>

      {/* Modal: Nova Empresa */}
      <Modal open={modalNew} onClose={() => setModalNew(false)} title="Cadastrar Nova Empresa">
        <div className="p-6">
          <p className="text-sm text-slate-600">
            Adicione um novo perfil de negócio para gerar conteúdos com identidade, fotos e tom de voz independentes.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="modal-name" required>
                Nome da empresa
              </Label>
              <Input
                id="modal-name"
                placeholder="Ex: Studio Bella, Café Central..."
                value={newBrandForm.name}
                onChange={(e) => setNewBrandForm({ ...newBrandForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="modal-handle">Instagram</Label>
                <Input
                  id="modal-handle"
                  placeholder="@empresa"
                  value={newBrandForm.handle}
                  onChange={(e) => setNewBrandForm({ ...newBrandForm, handle: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="modal-city">Cidade</Label>
                <Input
                  id="modal-city"
                  placeholder="Ex: Palmas - TO"
                  value={newBrandForm.city}
                  onChange={(e) => setNewBrandForm({ ...newBrandForm, city: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="modal-segment" required>
                Segmento de atuação
              </Label>
              <Select
                id="modal-segment"
                value={newBrandForm.segment}
                onChange={(e) => setNewBrandForm({ ...newBrandForm, segment: e.target.value as SegmentId })}
              >
                {SEGMENT_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setModalNew(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateBrand}>Criar Empresa</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Limite de Perfis */}
      <Modal open={modalLimit} onClose={() => setModalLimit(false)} title="Limite de Empresas Atingido">
        <div className="p-6">
          <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4 text-brand-800">
            <Crown className="size-6 shrink-0 text-brand-600" />
            <p className="text-sm">
              O seu plano atual <strong>{currentPlanDef.name}</strong> permite cadastrar até{' '}
              <strong>{maxProfiles} perfis de negócio</strong>.
            </p>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Para gerenciar múltiplos negócios ou clientes de agência em uma só conta, faça o upgrade para o plano Pro
            (até 2 perfis) ou Business (até 5 perfis).
          </p>
          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setModalLimit(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                setModalLimit(false)
                nav('/app/planos')
              }}
            >
              Ver Planos e Fazer Upgrade
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar Exclusão */}
      <Modal open={!!modalDelete} onClose={() => setModalDelete(null)} title="Excluir Empresa?">
        <div className="p-6">
          <p className="text-sm text-slate-600">
            Tem certeza de que deseja remover a empresa <strong>{modalDelete?.name}</strong>?
          </p>
          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setModalDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Sim, Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
