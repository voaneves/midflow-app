import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { derivePalette, suggestedColors } from './color'
import { segmentDef } from './data'
import { generate, handleFrom, uid } from './generator'
import type { Brand, Briefing, ContentSel, Creative, Generation, GenParams, LibraryItem, Palette, PlanId, SegmentId, StyleSel } from './types'

/* localStorage can be missing or throw (private mode, sandboxed previews) — never let that break the app */
const memory = new Map<string, string>()
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return memory.get(k) ?? null
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      memory.set(k, v)
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      memory.delete(k)
    }
  },
}

/* ------------------------------------------------------------------ */
/* Defaults & demo                                                     */
/* ------------------------------------------------------------------ */

export const DEMO_BRAND: Brand = {
  name: 'Studio Aurora',
  handle: 'studioaurora',
  segment: 'beleza',
  city: 'Palmas - TO',
  about: 'Salão de beleza e estética com foco em tratamentos capilares, limpeza de pele e manicure. Atendimento personalizado, produtos profissionais e ambiente acolhedor.',
  audience: 'Mulheres de 25 a 45 anos, que trabalham fora, valorizam autocuidado e procuram praticidade e resultado.',
  colors: ['#5A1428', '#C98B8B', '#F5C9D6', '#F4EADF'],
  tones: ['profissional', 'vendedor'],
  style: 'premium',
}

export function briefingFromBrand(b: Brand): Briefing {
  return {
    about: b.about,
    segment: b.segment,
    segmentOther: b.segmentOther ?? '',
    location: b.city,
    objectives: ['Atrair novos clientes', 'Fortalecer a marca'],
    audience: b.audience,
    topics: b.segment === 'beleza' ? 'Dicas de cuidados, tratamentos, transformações, depoimentos e promoções da semana.' : '',
    tones: b.tones.length ? b.tones : ['profissional'],
    visualStyle: b.style,
    colors: b.colors,
    references: '',
    posts: true,
    stories: true,
  }
}

const emptyBriefing: Briefing = {
  about: '',
  segment: '',
  segmentOther: '',
  location: '',
  objectives: [],
  audience: '',
  topics: '',
  tones: ['profissional'],
  visualStyle: 'moderno',
  colors: ['#0B4D3D', '#12B386', '#A8EAD5', '#F3F7F6'],
  references: '',
  posts: true,
  stories: true,
}

const defaultContent: ContentSel = { posts: true, stories: true, themeId: null, customTheme: '', objective: 'atrair', objectiveOther: '' }

function styleFromBrand(b: Brand): StyleSel {
  return { identity: 'brand', colors: b.colors, logo: b.logo, style: b.style, imageType: 'fotos', tones: b.tones.length ? b.tones : ['profissional'], postFormat: '4:5', stories: true }
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface User {
  name: string
  email: string
}

interface State {
  user: User | null
  brand: Brand
  briefing: Briefing
  content: ContentSel
  style: StyleSel
  done: { 1: boolean; 2: boolean; 3: boolean }
  generations: Generation[]
  activeGenId: string | null
  library: LibraryItem[]
  plan: PlanId
  used: number
  exampleSeed: number

  login: (u: User) => void
  logout: () => void
  loadDemo: () => void
  signup: (u: User, company: string, segment: SegmentId) => void
  setBrand: (b: Partial<Brand>) => void
  setBriefing: (b: Partial<Briefing>) => void
  saveBriefingToBrand: () => void
  setContent: (c: Partial<ContentSel>) => void
  setStyle: (s: Partial<StyleSel>) => void
  markDone: (step: 1 | 2 | 3) => void
  newExamples: () => void
  runGeneration: () => Generation
  setActiveGen: (id: string) => void
  updateCreative: (genId: string, creative: Creative) => void
  removeCreative: (genId: string, id: string) => void
  duplicateCreative: (genId: string, id: string) => void
  saveToLibrary: (items: { creative: Creative; gen: Generation }[]) => number
  removeFromLibrary: (ids: string[]) => void
  setPlan: (p: PlanId) => void
  resetCreate: () => void
  resetAll: () => void
}

/** Palette + style used when rendering, derived from Step 3. */
export function currentLook(s: Pick<State, 'style' | 'briefing'>): { palette: Palette; style: StyleSel['style'] } {
  const colors = s.style.identity === 'brand' ? s.style.colors : suggestedColors(s.briefing.segment, s.style.style)
  return { palette: derivePalette(colors), style: s.style.style }
}

export function paramsFrom(s: State, seed: number): GenParams {
  const { palette, style } = currentLook(s)
  const seg = (s.briefing.segment || s.brand.segment || 'outro') as SegmentId
  const theme = s.content.themeId ?? segmentDef(seg).themes[0].id
  return {
    segment: seg,
    themeId: theme,
    customTheme: s.content.customTheme,
    objective: s.content.objective,
    tones: s.style.tones.length ? s.style.tones : s.briefing.tones,
    style,
    palette,
    postFormat: s.style.postFormat,
    posts: s.content.posts,
    stories: s.content.stories,
    brandName: s.brand.name,
    handle: s.brand.handle,
    city: s.briefing.location || s.brand.city,
    seed,
  }
}

function seedLibrary(brand: Brand): LibraryItem[] {
  const look = { palette: derivePalette(brand.colors), style: brand.style }
  const g = generate(
    { segment: brand.segment, themeId: 'cabelo', objective: 'atrair', tones: brand.tones, style: look.style, palette: look.palette, postFormat: '4:5', posts: true, stories: true, brandName: brand.name, handle: brand.handle, city: brand.city, seed: 7 },
    1,
  )
  const now = Date.now()
  return [...g.posts.slice(0, 3), g.stories[0]].map((c, i) => ({
    id: uid('lib'),
    savedAt: now - (i + 1) * 86_400_000,
    creative: c,
    style: look.style,
    palette: look.palette,
    postFormat: '4:5' as const,
    themeLabel: g.themeLabel,
  }))
}

const initial = {
  user: null as User | null,
  brand: DEMO_BRAND,
  briefing: briefingFromBrand(DEMO_BRAND),
  content: { ...defaultContent, themeId: 'cabelo' },
  style: styleFromBrand(DEMO_BRAND),
  done: { 1: false, 2: false, 3: false },
  generations: [] as Generation[],
  activeGenId: null as string | null,
  library: seedLibrary(DEMO_BRAND),
  plan: 'pro' as PlanId,
  used: 23,
  exampleSeed: 0,
}

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      ...initial,

      login: (u) => set({ user: u }),
      logout: () => set({ user: null }),
      loadDemo: () => set({ ...initial, library: seedLibrary(DEMO_BRAND), user: { name: 'Geovane Almeida', email: 'demo@midflow.com.br' } }),
      signup: (u, company, segment) => {
        const seg = segmentDef(segment)
        const brand: Brand = {
          name: company,
          handle: handleFrom(company),
          segment,
          city: '',
          about: '',
          audience: '',
          colors: seg.palette,
          tones: ['profissional'],
          style: 'moderno',
        }
        set({
          user: u,
          brand,
          briefing: { ...emptyBriefing, segment, colors: seg.palette },
          content: { ...defaultContent },
          style: styleFromBrand(brand),
          done: { 1: false, 2: false, 3: false },
          generations: [],
          activeGenId: null,
          library: [],
          plan: 'start',
          used: 0,
        })
      },
      setBrand: (b) =>
        set((s) => {
          const brand = { ...s.brand, ...b }
          // keep the "use my brand" style in sync
          const style = s.style.identity === 'brand' ? { ...s.style, colors: brand.colors, logo: brand.logo } : s.style
          return { brand, style }
        }),
      setBriefing: (b) => set((s) => ({ briefing: { ...s.briefing, ...b } })),
      saveBriefingToBrand: () =>
        set((s) => {
          const b = s.briefing
          const brand: Brand = {
            ...s.brand,
            about: b.about || s.brand.about,
            audience: b.audience || s.brand.audience,
            segment: (b.segment || s.brand.segment) as SegmentId,
            segmentOther: b.segmentOther,
            city: b.location || s.brand.city,
            colors: b.colors.length ? b.colors : s.brand.colors,
            tones: b.tones.length ? b.tones : s.brand.tones,
            style: b.visualStyle,
          }
          return {
            brand,
            content: { ...s.content, posts: b.posts, stories: b.stories },
            style: { ...s.style, colors: s.style.identity === 'brand' ? brand.colors : s.style.colors, tones: b.tones, style: b.visualStyle, stories: b.stories },
          }
        }),
      setContent: (c) => set((s) => ({ content: { ...s.content, ...c } })),
      setStyle: (st) => set((s) => ({ style: { ...s.style, ...st } })),
      markDone: (step) => set((s) => ({ done: { ...s.done, [step]: true } })),
      newExamples: () => set((s) => ({ exampleSeed: s.exampleSeed + 1 })),
      runGeneration: () => {
        const s = get()
        const version = s.generations.length + 1
        const g = generate(paramsFrom(s, Date.now() % 100000), version)
        const cost = g.posts.length + (g.stories.length ? 1 : 0)
        set({ generations: [...s.generations, g], activeGenId: g.id, used: s.used + cost })
        return g
      },
      setActiveGen: (id) => set({ activeGenId: id }),
      updateCreative: (genId, c) =>
        set((s) => ({
          generations: s.generations.map((g) =>
            g.id !== genId ? g : { ...g, posts: g.posts.map((x) => (x.id === c.id ? c : x)), stories: g.stories.map((x) => (x.id === c.id ? c : x)) },
          ),
          library: s.library.map((l) => (l.creative.id === c.id ? { ...l, creative: c } : l)),
        })),
      removeCreative: (genId, id) =>
        set((s) => ({
          generations: s.generations.map((g) =>
            g.id !== genId ? g : { ...g, posts: g.posts.filter((x) => x.id !== id), stories: g.stories.filter((x) => x.id !== id) },
          ),
        })),
      duplicateCreative: (genId, id) =>
        set((s) => ({
          generations: s.generations.map((g) => {
            if (g.id !== genId) return g
            const dup = (arr: Creative[]) => {
              const i = arr.findIndex((x) => x.id === id)
              if (i < 0) return arr
              const copy = { ...arr[i], id: uid(arr[i].kind) }
              const out = [...arr.slice(0, i + 1), copy, ...arr.slice(i + 1)]
              return out.map((x, k) => ({ ...x, order: k + 1 }))
            }
            return { ...g, posts: dup(g.posts), stories: dup(g.stories) }
          }),
        })),
      saveToLibrary: (items) => {
        const s = get()
        const existing = new Set(s.library.map((l) => l.creative.id))
        const fresh = items
          .filter((i) => !existing.has(i.creative.id))
          .map(({ creative, gen }) => ({
            id: uid('lib'),
            savedAt: Date.now(),
            creative,
            style: creative.style ?? gen.params.style,
            palette: creative.palette ?? gen.params.palette,
            postFormat: gen.params.postFormat,
            themeLabel: gen.themeLabel,
          }))
        set({ library: [...fresh, ...s.library] })
        return fresh.length
      },
      removeFromLibrary: (ids) => set((s) => ({ library: s.library.filter((l) => !ids.includes(l.id)) })),
      setPlan: (p) => set({ plan: p, used: 0 }),
      resetCreate: () =>
        set((s) => ({
          briefing: briefingFromBrand(s.brand),
          content: { ...defaultContent, themeId: null },
          style: styleFromBrand(s.brand),
          done: { 1: false, 2: false, 3: false },
          generations: [],
          activeGenId: null,
        })),
      resetAll: () => set({ ...initial, library: seedLibrary(DEMO_BRAND) }),
    }),
    { name: 'midflow-prototype-v1', storage: createJSONStorage(() => safeStorage), version: 1 },
  ),
)

export const useActiveGen = () =>
  useApp((s) => s.generations.find((g) => g.id === s.activeGenId) ?? s.generations[s.generations.length - 1] ?? null)
