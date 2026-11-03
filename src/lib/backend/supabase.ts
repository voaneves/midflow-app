import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Brand, Generation, LibraryItem, PlanId, SegmentId } from '../types'
import { RepoError } from './errors'
import { effectiveBillingPlan } from './planLimits'
import type { AuthProvider, AuthResult, AuthSession, PlanUsage, Repository } from './types'

/**
 * Supabase adapter (email + password). supabase-js is imported lazily so that builds and users
 * without Supabase never download it; it ships only in its own chunk.
 */
export interface SupabaseConfig {
  url: string
  anonKey: string
}

let clientPromise: Promise<SupabaseClient> | null = null

export function getSupabaseClient(cfg: SupabaseConfig): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(cfg.url, cfg.anonKey, {
      // PKCE returns "?code=" in the query string, before the "#/route" that HashRouter owns (the implicit flow would put tokens in the hash).
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    }),
  )
  return clientPromise
}

const toSession = (s: Session | null): AuthSession | null =>
  s
    ? {
        accessToken: s.access_token,
        user: {
          id: s.user.id,
          email: s.user.email ?? '',
          name: String(s.user.user_metadata?.name ?? s.user.email?.split('@')[0] ?? 'Você'),
          company: s.user.user_metadata?.company as string | undefined,
          segment: s.user.user_metadata?.segment as SegmentId | undefined,
        },
      }
    : null

/** Maps Supabase auth errors to pt-BR copy shown in the UI. */
export function authErrorMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já tem cadastro. Entre com a sua senha.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
  if (m.includes('same password') || m.includes('different from the old')) return 'Escolha uma senha diferente da anterior.'
  if (m.includes('session') && (m.includes('missing') || m.includes('expired'))) return 'O link expirou. Peça um novo link de recuperação.'
  if (m.includes('password') && m.includes('characters')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde um instante e tente de novo.'
  return 'Não foi possível concluir agora. Tente novamente em instantes.'
}

export function createSupabaseAuth(cfg: SupabaseConfig): AuthProvider {
  const client = () => getSupabaseClient(cfg)
  return {
    kind: 'supabase',
    async signUp({ email, password, name, company, segment }): Promise<AuthResult> {
      const { data, error } = await (await client()).auth.signUp({ email, password, options: { data: { name, company, segment } } })
      if (error) return { ok: false, error: authErrorMessage(error.message) }
      const session = toSession(data.session)
      return { ok: true, session, needsConfirmation: !session }
    },
    async signIn({ email, password }): Promise<AuthResult> {
      const { data, error } = await (await client()).auth.signInWithPassword({ email, password })
      if (error) return { ok: false, error: authErrorMessage(error.message) }
      return { ok: true, session: toSession(data.session) }
    },
    async signInWithOAuth(provider) {
      // Back to the app root (no hash); the session is exchanged from "?code=" when the page loads.
      const redirectTo = `${window.location.origin}${window.location.pathname}`
      const { error } = await (await client()).auth.signInWithOAuth({ provider, options: { redirectTo } })
      return error ? { ok: false as const, error: authErrorMessage(error.message) } : { ok: true as const }
    },
    async signOut() {
      await (await client()).auth.signOut()
    },
    async resetPassword(email) {
      // PKCE: the e-mail link returns to the app root with "?code=", and supabase-js then reports PASSWORD_RECOVERY.
      const redirectTo = `${window.location.origin}${window.location.pathname}`
      const { error } = await (await client()).auth.resetPasswordForEmail(email, { redirectTo })
      return error ? { ok: false as const, error: authErrorMessage(error.message) } : { ok: true as const }
    },
    async updatePassword(password) {
      const { error } = await (await client()).auth.updateUser({ password })
      return error ? { ok: false as const, error: authErrorMessage(error.message) } : { ok: true as const }
    },
    onPasswordRecovery(cb) {
      let off = () => {}
      let cancelled = false
      void client().then((c) => {
        if (cancelled) return
        const { data } = c.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY') cb()
        })
        off = () => data.subscription.unsubscribe()
      })
      return () => {
        cancelled = true
        off()
      }
    },
    async getSession() {
      const { data } = await (await client()).auth.getSession()
      return toSession(data.session)
    },
    onChange(cb) {
      let off = () => {}
      let cancelled = false
      void client().then((c) => {
        if (cancelled) return
        const { data } = c.auth.onAuthStateChange((_event, session) => cb(toSession(session)))
        off = () => data.subscription.unsubscribe()
      })
      return () => {
        cancelled = true
        off()
      }
    },
  }
}

const month = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
const brandKey = (b: Brand) => b.id ?? b.name

/** Rows are scoped by RLS (user_id = auth.uid()); the client never filters by user itself. */
export function createSupabaseRepository(cfg: SupabaseConfig): Repository {
  const client = () => getSupabaseClient(cfg)
  const userId = async () => {
    const { data } = await (await client()).auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('not signed in')
    return id
  }
  const fail = (error: { message: string; code?: string } | null) => {
    if (error) throw new RepoError(error.message, error.code)
  }
  return {
    kind: 'supabase',
    async listBrands() {
      const { data, error } = await (await client()).from('brands').select('id, data').order('updated_at', { ascending: true })
      fail(error)
      return (data ?? []).map((r) => ({ ...(r.data as Brand), id: r.id as string }))
    },
    async upsertBrands(brands) {
      if (!brands.length) return
      const uid = await userId()
      const rows = brands.map((b) => ({ user_id: uid, id: brandKey(b), name: b.name, data: b, updated_at: new Date().toISOString() }))
      fail((await (await client()).from('brands').upsert(rows, { onConflict: 'user_id,id' })).error)
    },
    async deleteBrands(ids) {
      if (!ids.length) return
      fail((await (await client()).from('brands').delete().in('id', ids)).error)
    },
    async listGenerations(limit = 20) {
      const { data, error } = await (await client()).from('generations').select('data').order('created_at', { ascending: false }).limit(limit)
      fail(error)
      return (data ?? []).map((r) => r.data as Generation)
    },
    async saveGeneration(gen, brandId) {
      const uid = await userId()
      const row = { user_id: uid, id: gen.id, brand_id: brandId ?? null, version: gen.version ?? 1, data: gen, created_at: new Date(gen.createdAt).toISOString() }
      fail((await (await client()).from('generations').upsert(row, { onConflict: 'user_id,id' })).error)
    },
    async listLibrary() {
      const { data, error } = await (await client()).from('library_items').select('id, data').order('saved_at', { ascending: false })
      fail(error)
      return (data ?? []).map((r) => ({ ...(r.data as LibraryItem), id: r.id as string }))
    },
    async upsertLibrary(items) {
      if (!items.length) return
      const uid = await userId()
      const rows = items.map((i) => ({ user_id: uid, id: i.id, data: i, saved_at: new Date(i.savedAt).toISOString() }))
      fail((await (await client()).from('library_items').upsert(rows, { onConflict: 'user_id,id' })).error)
    },
    async deleteLibrary(ids) {
      if (!ids.length) return
      fail((await (await client()).from('library_items').delete().in('id', ids)).error)
    },
    async getPlanUsage(): Promise<PlanUsage | null> {
      const c = await client()
      const { data: sub, error } = await c.from('subscriptions').select('plan, status').maybeSingle()
      fail(error)
      // No subscription row is a normal Start account: its usage still comes from the server counter.
      const { data: usage, error: usageError } = await c.from('usage_counters').select('used').eq('period', month()).maybeSingle()
      fail(usageError)
      return { plan: effectiveBillingPlan(sub) as PlanId, used: Number(usage?.used ?? 0), status: (sub?.status as string | null | undefined) ?? null }
    },
  }
}
