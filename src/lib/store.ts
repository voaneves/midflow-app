import { api } from './api'
import { authHeaders, getBackend, isSupabaseConfigured } from './backend'
import type { AuthResult, AuthSession } from './backend'
import { GenerateError, MAX_RETRIES, RETRY_DELAYS_MS, sleep, type RetryInfo } from './generation'
import { isBillingPlan } from './backend/planLimits'
import { createSync } from './backend/sync'
import { toast } from '../components/ui/toast-store'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { derivePalette, suggestedColors } from './color'
import { DEMO_BRIEFING_TEXT, planDef, segmentDef } from './data'
import { generate, handleFrom, uid } from './generator'
import { clearOAuthPending, isOAuthPending, markRecoveryPending } from './oauthReturn'
import { track } from './telemetry'
import type {
  Brand,
  Briefing,
  ContentSel,
  Creative,
  Generation,
  GenParams,
  LibraryItem,
  Palette,
  PlanId,
  ScheduledPost,
  ScheduledStatus,
  SegmentId,
  StyleSel,
} from './types'

/* localStorage seguro com fallback em memória */
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
/* Defaults & Demo                                                     */
/* ------------------------------------------------------------------ */

export const DEMO_BRAND: Brand = {
  id: 'brand_aurora',
  name: 'Studio Aurora',
  handle: 'studioaurora',
  segment: 'beleza',
  city: 'Palmas - TO',
  about: DEMO_BRIEFING_TEXT.about,
  audience: DEMO_BRIEFING_TEXT.audience,
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
    topics: b.segment === 'beleza' ? DEMO_BRIEFING_TEXT.topics : '',
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

const defaultContent: ContentSel = {
  posts: true,
  stories: true,
  themeId: null,
  customTheme: '',
  objective: 'atrair',
  objectiveOther: '',
}

function styleFromBrand(b: Brand): StyleSel {
  return {
    identity: 'brand',
    colors: b.colors,
    logo: b.logo,
    style: b.style,
    imageType: 'fotos',
    tones: b.tones.length ? b.tones : ['profissional'],
    postFormat: '4:5',
    stories: true,
  }
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface User {
  name: string
  email: string
  /** Backend account id. Absent for local logins and demo mode, which never sync. */
  id?: string
}

interface State {
  user: User | null
  brands: Brand[]
  brand: Brand
  briefing: Briefing
  content: ContentSel
  style: StyleSel
  done: { 1: boolean; 2: boolean; 3: boolean }
  generations: Generation[]
  activeGenId: string | null
  library: LibraryItem[]
  scheduledPosts: ScheduledPost[]
  plan: PlanId
  used: number
  exampleSeed: number

  login: (u: User) => void
  logout: () => void
  /** Real accounts: go through the configured auth provider (Supabase), or the local adapter when none is set. */
  authSignIn: (email: string, password: string) => Promise<AuthResult>
  authSignUp: (u: { name: string; email: string; password: string }, company: string, segment: SegmentId) => Promise<AuthResult>
  /** Re-reads plan and usage from the backend (after a Stripe checkout). No-op without an account. */
  refreshPlan: () => Promise<void>
  /** Adopts a session created outside the forms (Google sign-in return). No-op when that user is already signed in. */
  /** Resolves true when the first sign-in created the business from defaults (no company in the profile), so the person still has to describe it. */
  adoptSession: (session: AuthSession) => Promise<boolean>
  loadDemo: () => void
  signup: (u: User, company: string, segment: SegmentId) => void
  setBrand: (b: Partial<Brand>) => void
  addBrand: (b: Brand) => boolean
  switchBrand: (brandId: string) => void
  deleteBrand: (brandId: string) => void
  setBriefing: (b: Partial<Briefing>) => void
  saveBriefingToBrand: () => void
  setContent: (c: Partial<ContentSel>) => void
  setStyle: (s: Partial<StyleSel>) => void
  markDone: (step: 1 | 2 | 3) => void
  newExamples: () => void
  /** `signal` cancels the request; `offline` uses the local template engine (labelled as such, never as AI). */
  runGeneration: (customParams?: Partial<GenParams>, opts?: { signal?: AbortSignal; offline?: boolean; onRetry?: (info: RetryInfo) => void }) => Promise<Generation>
  setActiveGen: (id: string) => void
  updateCreative: (genId: string, creative: Creative) => void
  removeCreative: (genId: string, id: string) => void
  duplicateCreative: (genId: string, id: string) => void
  reorderStories: (genId: string, fromIndex: number, toIndex: number) => void
  saveToLibrary: (items: { creative: Creative; gen: Generation }[]) => number
  removeFromLibrary: (ids: string[]) => void
  scheduleCreative: (item: {
    creative: Creative
    date: string
    time: string
    status?: ScheduledStatus
    notes?: string
    network?: 'instagram' | 'whatsapp' | 'facebook' | 'todas'
    themeLabel?: string
    style?: StyleSel['style']
    palette?: Palette
    format?: StyleSel['postFormat']
  }) => ScheduledPost
  updateScheduledPost: (id: string, partial: Partial<ScheduledPost>) => void
  removeScheduledPost: (id: string) => void
  markPostPublished: (id: string) => void
  setPlan: (p: PlanId) => void
  resetCreate: () => void
  resetAll: () => void
}

/** The `usage` object of /api/generate ({ plan, used, limit }); anything malformed is ignored. */
function parseServerUsage(raw: unknown): { plan: PlanId; used: number } | null {
  const u = raw as { plan?: unknown; used?: unknown } | null
  if (!u || typeof u !== 'object' || !isBillingPlan(u.plan) || typeof u.used !== 'number' || !Number.isFinite(u.used) || u.used < 0) return null
  return { plan: u.plan, used: Math.floor(u.used) }
}

/** Paleta e estilo calculados a partir da Etapa 3 */
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
    objectiveOther: s.content.objectiveOther,
    tones: s.style.tones.length ? s.style.tones : s.briefing.tones,
    style,
    palette,
    postFormat: s.style.postFormat,
    imageType: s.style.imageType,
    posts: s.content.posts,
    stories: s.content.stories,
    brandName: s.brand.name,
    handle: s.brand.handle,
    city: s.briefing.location || s.brand.city,
    about: s.briefing.about || s.brand.about,
    audience: s.briefing.audience || s.brand.audience,
    topics: s.briefing.topics,
    references: s.briefing.references,
    seed,
  }
}

function seedLibrary(brand: Brand): LibraryItem[] {
  const look = { palette: derivePalette(brand.colors), style: brand.style }
  const g = generate(
    {
      segment: brand.segment,
      themeId: 'cabelo',
      objective: 'atrair',
      tones: brand.tones,
      style: look.style,
      palette: look.palette,
      postFormat: '4:5',
      posts: true,
      stories: true,
      brandName: brand.name,
      handle: brand.handle,
      city: brand.city,
      seed: 7,
    },
    1,
  )
  const now = Date.now()
  return [...g.posts.slice(0, 3), g.stories[0]].map((c, i) => ({
    id: uid('lib'),
    savedAt: now - (i + 1) * 86_400_000,
    creative: { ...c, brand: { name: brand.name, handle: brand.handle } },
    style: look.style,
    palette: look.palette,
    postFormat: '4:5' as const,
    themeLabel: g.themeLabel,
  }))
}

function seedSchedule(_brand: Brand, library: LibraryItem[]): ScheduledPost[] {
  const today = new Date()
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10)
  const posts: ScheduledPost[] = []

  if (library[0]) {
    const d1 = new Date(today)
    d1.setDate(today.getDate() + 1)
    posts.push({
      id: uid('sch'),
      date: fmtDate(d1),
      time: '11:30',
      status: 'agendado',
      creative: library[0].creative,
      style: library[0].style,
      palette: library[0].palette,
      postFormat: library[0].postFormat,
      themeLabel: library[0].themeLabel,
      notes: 'Melhor horário para engajamento no horário de almoço.',
      socialNetwork: 'instagram',
    })
  }

  if (library[1]) {
    const d2 = new Date(today)
    d2.setDate(today.getDate() + 3)
    posts.push({
      id: uid('sch'),
      date: fmtDate(d2),
      time: '19:30',
      status: 'pronto',
      creative: library[1].creative,
      style: library[1].style,
      palette: library[1].palette,
      postFormat: library[1].postFormat,
      themeLabel: library[1].themeLabel,
      notes: 'Post de dicas e autocuidado noturno.',
      socialNetwork: 'instagram',
    })
  }

  if (library[2]) {
    const d3 = new Date(today)
    d3.setDate(today.getDate() - 1)
    posts.push({
      id: uid('sch'),
      date: fmtDate(d3),
      time: '18:00',
      status: 'publicado',
      publishedAt: Date.now() - 86_400_000,
      creative: library[2].creative,
      style: library[2].style,
      palette: library[2].palette,
      postFormat: library[2].postFormat,
      themeLabel: library[2].themeLabel,
      notes: 'Publicado no Feed com sucesso.',
      socialNetwork: 'instagram',
    })
  }

  return posts
}


const initialLib = seedLibrary(DEMO_BRAND)

const initial = {
  user: null as User | null,
  brands: [DEMO_BRAND],
  brand: DEMO_BRAND,
  briefing: briefingFromBrand(DEMO_BRAND),
  content: { ...defaultContent, themeId: 'cabelo' },
  style: styleFromBrand(DEMO_BRAND),
  done: { 1: false, 2: false, 3: false },
  generations: [] as Generation[],
  activeGenId: null as string | null,
  library: initialLib,
  scheduledPosts: seedSchedule(DEMO_BRAND, initialLib),
  plan: 'pro' as PlanId,
  used: 23,
  exampleSeed: 0,
}

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      ...initial,

      // Editing the profile of a signed-in account keeps its backend id (same e-mail); any other login is local-only.
      login: (u) => set((st) => ({ user: u.id || st.user?.email !== u.email || !st.user?.id ? u : { ...u, id: st.user.id } })),
      logout: () => {
        const account = !!get().user?.id
        if (isSupabaseConfigured())
          void getBackend()
            .then((b) => b.auth.signOut())
            .catch(() => {})
        if (!account) return set({ user: null })
        // A real account was signed in: do not leave its data on this device for the next visitor.
        const lib = seedLibrary(DEMO_BRAND)
        set({ ...initial, library: lib, scheduledPosts: seedSchedule(DEMO_BRAND, lib) })
      },
      authSignIn: async (email, password) => {
        const { auth } = await getBackend()
        const res = await auth.signIn({ email, password })
        if (!res.ok || !res.session) return res
        await get().adoptSession(res.session)
        return res
      },
      adoptSession: async ({ user }) => {
        const remote = isSupabaseConfigured()
        if (remote && get().user?.id === user.id) return false
        set({ user: { name: user.name, email: user.email, ...(remote ? { id: user.id } : {}) } })
        let needsBusiness = false
        if (remote && sync) {
          await sync.hydrate(user.id)
          // First sign-in after e-mail confirmation: nothing saved yet, so create the business from sign-up data.
          if (get().brands.every((b) => b.id === DEMO_BRAND.id)) {
            // Google sign-ups carry no company or segment: use the person's name as a placeholder and send them to "Marca" to fill it in.
            needsBusiness = !user.company
            get().signup({ name: user.name, email: user.email }, user.company || user.name || 'Minha empresa', user.segment || 'outro')
            set((s) => ({ user: s.user && { ...s.user, id: user.id } }))
            await sync.flush()
          }
        }
        return needsBusiness
      },
      authSignUp: async ({ name, email, password }, company, segment) => {
        const { auth } = await getBackend()
        const res = await auth.signUp({ email, password, name, company, segment })
        if (!res.ok || !res.session) return res // e-mail confirmation pending: nothing is created until the first sign-in
        get().signup({ name, email }, company, segment)
        if (isSupabaseConfigured()) {
          const id = res.session.user.id
          set((s) => ({ user: s.user && { ...s.user, id } }))
          await sync?.hydrate(id)
        }
        return res
      },
      refreshPlan: async () => {
        await sync?.refreshPlan()
      },
      loadDemo: () => {
        const lib = seedLibrary(DEMO_BRAND)
        set({
          ...initial,
          library: lib,
          scheduledPosts: seedSchedule(DEMO_BRAND, lib),
          user: { name: 'Geovane Almeida', email: 'demo@midflow.com.br' },
        })
      },
      signup: (u, company, segment) => {
        const seg = segmentDef(segment)
        const brand: Brand = {
          id: uid('brand'),
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
          brands: [brand],
          brand,
          briefing: { ...emptyBriefing, segment, colors: seg.palette },
          content: { ...defaultContent },
          style: styleFromBrand(brand),
          done: { 1: false, 2: false, 3: false },
          generations: [],
          activeGenId: null,
          library: [],
          scheduledPosts: [],
          plan: 'free',
          used: 0,
        })
      },
      setBrand: (b) =>
        set((s) => {
          const brand = { ...s.brand, ...b }
          const brands = s.brands.map((item) => (item.id === brand.id || item.name === s.brand.name ? brand : item))
          const style =
            s.style.identity === 'brand' ? { ...s.style, colors: brand.colors, logo: brand.logo } : s.style
          return { brand, brands, style }
        }),
      addBrand: (newBrand) => {
        const s = get()
        const planObj = planDef(s.plan)
        if (s.brands.length >= planObj.profiles) {
          return false
        }
        const b = { ...newBrand, id: newBrand.id || uid('brand') }
        set({
          brands: [...s.brands, b],
          brand: b,
          briefing: briefingFromBrand(b),
          style: styleFromBrand(b),
        })
        return true
      },
      switchBrand: (brandId) => {
        const s = get()
        const target = s.brands.find((b) => b.id === brandId)
        if (target) {
          set({
            brand: target,
            briefing: briefingFromBrand(target),
            style: styleFromBrand(target),
          })
        }
      },
      deleteBrand: (brandId) => {
        const s = get()
        if (s.brands.length <= 1) return
        const nextBrands = s.brands.filter((b) => b.id !== brandId)
        const nextBrand = nextBrands[0]
        set({
          brands: nextBrands,
          brand: nextBrand,
          briefing: briefingFromBrand(nextBrand),
          style: styleFromBrand(nextBrand),
        })
      },
      setBriefing: (b) =>
        set((s) => {
          const briefing = { ...s.briefing, ...b }
          if (b.segment === undefined || b.segment === s.briefing.segment) return { briefing }
          // Themes are per segment: a new segment means step 2 (and everything after it) must be redone.
          return {
            briefing,
            content: s.content.themeId === 'custom' ? s.content : { ...s.content, themeId: null },
            done: { ...s.done, 2: false, 3: false },
          }
        }),
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
          const brands = s.brands.map((item) => (item.id === brand.id || item.name === s.brand.name ? brand : item))
          return {
            brand,
            brands,
            content: { ...s.content, posts: b.posts, stories: b.stories },
            style: {
              ...s.style,
              colors: s.style.identity === 'brand' ? brand.colors : s.style.colors,
              tones: b.tones,
              style: b.visualStyle,
              stories: b.stories,
            },
          }
        }),
      setContent: (c) => set((s) => ({ content: { ...s.content, ...c } })),
      setStyle: (st) => set((s) => ({ style: { ...s.style, ...st } })),
      markDone: (step) => set((s) => ({ done: { ...s.done, [step]: true } })),
      newExamples: () => set((s) => ({ exampleSeed: s.exampleSeed + 1 })),
      runGeneration: async (customParams, opts = {}) => {
        const s = get()
        const version = s.generations.length + 1
        const params: GenParams = {
          ...paramsFrom(s, (Date.now() + version * 7) % 100000),
          ...customParams,
        }

        // 1. Backend: IA real + controle de qualidade (skipped when the user explicitly picks the offline model).
        //    A temporary AI failure comes back as a template result with `retryable: true`: retry a few times with
        //    backoff, then keep the (honestly labelled) template result.
        if (!opts.offline) {
          for (let attempt = 0; ; attempt++) {
            let res: Response | null = null
            try {
              res = await fetch(api('/api/generate'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders().catch(() => ({}))) },
                body: JSON.stringify({ params, version }),
                signal: opts.signal,
              })
            } catch (e) {
              // A user cancel must not silently turn into a template generation.
              if ((e as Error)?.name === 'AbortError') throw e
              console.warn('[MIDFLOW] Servidor indisponível, usando gerador local:', e)
            }
            opts.signal?.throwIfAborted()
            if (!res) break

            if (res.ok) {
              const data = await res.json().catch(() => null)
              if (data?.generation) {
                const g: Generation = { ...data.generation, version }
                if (g.engine === 'template' && data.aiErrorKind) g.aiErrorKind = data.aiErrorKind
                if (g.engine === 'template' && data.code === 'account_required') g.aiErrorCode = 'account_required'
                if (g.engine === 'template' && data.retryable === true && attempt < MAX_RETRIES) {
                  const delayMs = RETRY_DELAYS_MS[attempt]
                  opts.onRetry?.({ attempt: attempt + 1, max: MAX_RETRIES, delayMs })
                  await sleep(delayMs, opts.signal)
                  continue
                }
                const cost = g.posts.length + (g.stories.length ? 1 : 0)
                const usage = parseServerUsage(data.usage)
                set((st) => ({
                  generations: [...st.generations, g],
                  activeGenId: g.id,
                  // Signed-in accounts: the server counter is the truth. Demo and browser-only logins keep counting locally.
                  ...(st.user?.id && usage ? { used: usage.used, plan: usage.plan } : { used: st.used + cost }),
                }))
                return g
              }
              break
            }

            // Our API answered with a clear JSON error: show it. Anything else (404/405 HTML from a static host such as
            // GitHub Pages) means "no backend here".
            const data = await res.json().catch(() => null)
            if (res.status === 402) throw new GenerateError('quota', data?.error || 'Você chegou ao limite de conteúdos do seu plano neste mês.')
            if (res.status === 401) throw new GenerateError('auth', data?.error || 'Sua sessão expirou. Entre novamente para continuar.')
            if (data?.error) throw new Error(data.error)
            break
          }
        }

        // 2. No backend at all (static demo hosting): local templates, clearly labeled.
        const g: Generation = { ...generate(params, version), engine: 'local' }
        track('client_fallback', { generationId: g.id, brandName: params.brandName })
        const cost = g.posts.length + (g.stories.length ? 1 : 0)
        set((st) => ({ generations: [...st.generations, g], activeGenId: g.id, used: st.used + cost }))
        return g
      },
      setActiveGen: (id) => set({ activeGenId: id }),
      updateCreative: (genId, c) =>
        set((s) => ({
          generations: s.generations.map((g) =>
            g.id !== genId
              ? g
              : {
                ...g,
                posts: g.posts.map((x) => (x.id === c.id ? c : x)),
                stories: g.stories.map((x) => (x.id === c.id ? c : x)),
              },
          ),
          library: s.library.map((l) => (l.creative.id === c.id ? { ...l, creative: c } : l)),
          scheduledPosts: s.scheduledPosts.map((sp) => (sp.creative.id === c.id ? { ...sp, creative: c } : sp)),
        })),
      removeCreative: (genId, id) =>
        set((s) => ({
          generations: s.generations.map((g) =>
            g.id !== genId
              ? g
              : {
                ...g,
                posts: g.posts.filter((x) => x.id !== id),
                stories: g.stories.filter((x) => x.id !== id),
              },
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
      reorderStories: (genId, fromIdx, toIdx) =>
        set((s) => ({
          generations: s.generations.map((g) => {
            if (g.id !== genId || !g.stories.length) return g
            const arr = [...g.stories]
            const [moved] = arr.splice(fromIdx, 1)
            arr.splice(toIdx, 0, moved)
            return {
              ...g,
              stories: arr.map((item, idx) => ({ ...item, order: idx + 1 })),
            }
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
        const nextLib = [...fresh, ...s.library]
        set({ library: nextLib })
        if (fresh.length) track('save', { count: fresh.length, brandName: s.brand.name })
        return fresh.length
      },
      removeFromLibrary: (ids) => set((s) => ({ library: s.library.filter((l) => !ids.includes(l.id)) })),
      scheduleCreative: (item) => {
        const s = get()
        const sp: ScheduledPost = {
          id: uid('sch'),
          date: item.date,
          time: item.time,
          status: item.status || 'agendado',
          creative: item.creative,
          style: item.style || item.creative.style || s.style.style,
          palette: item.palette || item.creative.palette || currentLook(s).palette,
          postFormat: item.format || s.style.postFormat,
          themeLabel: item.themeLabel || 'Conteúdo agendado',
          notes: item.notes,
          socialNetwork: item.network || 'instagram',
        }
        const nextSched = [sp, ...s.scheduledPosts]
        set({ scheduledPosts: nextSched })
        return sp
      },
      updateScheduledPost: (id, partial) =>
        set((s) => ({
          scheduledPosts: s.scheduledPosts.map((sp) => (sp.id === id ? { ...sp, ...partial } : sp)),
        })),
      removeScheduledPost: (id) =>
        set((s) => ({
          scheduledPosts: s.scheduledPosts.filter((sp) => sp.id !== id),
        })),
      markPostPublished: (id) =>
        set((s) => ({
          scheduledPosts: s.scheduledPosts.map((sp) =>
            sp.id === id ? { ...sp, status: 'publicado', publishedAt: Date.now() } : sp,
          ),
        })),
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
      resetAll: () => {
        const lib = seedLibrary(DEMO_BRAND)
        set({
          ...initial,
          library: lib,
          scheduledPosts: seedSchedule(DEMO_BRAND, lib),
        })
      },
    }),
    {
      name: 'midflow-storage-v3',
      storage: createJSONStorage(() => safeStorage),
      version: 5,
      // v5: the AI key no longer lives in the browser — drop any copy saved by older versions.
      migrate: (persisted) => {
        const { aiConfig: _drop, ...rest } = (persisted ?? {}) as Record<string, unknown>
        return rest as unknown as State
      },
    },
  ),
)

export const useActiveGen = () =>
  useApp((s) => s.generations.find((g) => g.id === s.activeGenId) ?? s.generations[s.generations.length - 1] ?? null)

/**
 * Account sync exists only when Supabase is configured; otherwise the persisted store above is the whole
 * persistence layer, exactly as before. Demo mode and local logins have no user.id and never sync.
 */
const sync = isSupabaseConfigured()
  ? createSync(useApp, getBackend, {
      demoBrandIds: [DEMO_BRAND.id ?? ''],
      onRemoteBrands: (brands) => useApp.setState({ briefing: briefingFromBrand(brands[0]), style: styleFromBrand(brands[0]) }),
      onSessionEnded: () => useApp.getState().logout(),
      onRowsSkipped: () => toast('Algumas imagens ou itens são grandes demais para sincronizar com a nuvem. Eles continuam salvos neste navegador.', 'info', { duration: 9000 }),
    })
  : null
sync?.start()

// Return from "Continuar com Google": the provider redirects back to the app root with a session in the URL.
// Only a flow started in this tab (flag set before the redirect) signs the user in; a persisted session alone never does.
if (sync) {
  void getBackend().then(({ auth }) =>
    auth.onChange((session) => {
      if (!session || !isOAuthPending()) return
      clearOAuthPending()
      void useApp
        .getState()
        .adoptSession(session)
        .then((needsBusiness) => {
          window.location.hash = needsBusiness ? '#/app/marca' : '#/app'
        })
    }),
  )
  // Return from the "Esqueci a senha" e-mail: send the person to the new-password screen.
  void getBackend().then(({ auth }) =>
    auth.onPasswordRecovery(() => {
      markRecoveryPending()
      window.location.hash = '#/nova-senha'
    }),
  )
}
