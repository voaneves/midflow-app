import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Brand, Generation, LibraryItem, PlanId, SegmentId } from '../types'
import { RepoError } from './errors'
import { effectiveBillingPlan } from './planLimits'
import { isOAuthPending } from '../oauthReturn'
import type { AuthProvider, AuthResult, AuthSession, PlanUsage, Repository } from './types'

/**
 * Supabase adapter (email + password). supabase-js is imported lazily so that builds and users
 * without Supabase never download it; it ships only in its own chunk.
 */
export interface SupabaseConfig {
  url: string
  anonKey: string
}

/**
 * What a return to the app root can carry: "?code=" (PKCE: Google sign-in, e-mail confirmation, password recovery) or an
 * error from Supabase / the provider, in the query string or (older flows) in the hash fragment.
 */
export type AuthReturnError = 'off' | 'cancel' | 'expired' | 'fail'

export function classifyReturnError(error: string, code: string, description: string): AuthReturnError {
  const d = description.toLowerCase()
  if (d.includes('not enabled') || d.includes('unsupported provider') || code === 'provider_disabled') return 'off'
  if (code === 'otp_expired' || d.includes('expired')) return 'expired'
  if (error === 'access_denied') return 'cancel'
  return 'fail'
}

function readReturn(): { hasCode: boolean; error: AuthReturnError | null } {
  const q = new URLSearchParams(window.location.search)
  // A hash that is a route ("#/app") is HashRouter's; anything else ("#error=...") is a fragment from the auth server.
  const raw = window.location.hash
  const h = new URLSearchParams(raw.startsWith('#/') ? '' : raw.slice(1))
  const get = (k: string) => q.get(k) ?? h.get(k) ?? ''
  const err = get('error')
  const errCode = get('error_code')
  const desc = get('error_description')
  if (err || errCode || desc) return { hasCode: false, error: classifyReturnError(err, errCode, desc) }
  return { hasCode: q.has('code'), error: null }
}

/** Removes "?code=" / error parameters (and a non-route fragment) from the address bar without reloading. */
function cleanReturnUrl(): void {
  const url = new URL(window.location.href)
  for (const k of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(k)
  const hash = url.hash.startsWith('#/') ? url.hash : ''
  window.history.replaceState(window.history.state, '', url.pathname + url.search + hash)
}

/** The login screen shows the message for this code (see Auth.tsx). */
function goToLoginWithError(code: AuthReturnError): void {
  cleanReturnUrl()
  window.location.hash = `#/entrar?erro=${code}`
}

/** Covers the landing page while the "?code=" is exchanged, so the person never sees the site "flash" before landing in the app. */
function showReturnOverlay(): () => void {
  const el = document.createElement('div')
  el.setAttribute('role', 'status')
  el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;font:16px/1.5 system-ui,sans-serif;background:Canvas;color:CanvasText'
  el.textContent = 'Entrando na sua conta…'
  document.body.appendChild(el)
  return () => el.remove()
}

let clientPromise: Promise<SupabaseClient> | null = null

export function getSupabaseClient(cfg: SupabaseConfig): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const ret = typeof window === 'undefined' ? { hasCode: false, error: null } : readReturn()
    // supabase-js reads the URL when the client is created. An error return is handled here instead (it has no session to exchange).
    if (ret.error) goToLoginWithError(ret.error)
    const hideOverlay = ret.hasCode ? showReturnOverlay() : null
    const wasOAuth = ret.hasCode && isOAuthPending()
    const client = createClient(cfg.url, cfg.anonKey, {
      // PKCE returns "?code=" in the query string, before the "#/route" that HashRouter owns (the implicit flow would put tokens in the hash).
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
    if (hideOverlay) {
      // Wait for the code exchange. supabase-js strips "?code=" itself on success; on failure we do, and explain.
      void client.auth.initialize().then(({ error }) => {
        if (error) {
          hideOverlay()
          goToLoginWithError('fail')
          return
        }
        // The store sends the person to the app right after adopting the session: keep the cover until the route changes.
        let done = false
        const finish = () => {
          if (done) return
          done = true
          window.removeEventListener('hashchange', finish)
          hideOverlay()
        }
        window.addEventListener('hashchange', finish)
        window.setTimeout(finish, wasOAuth ? 10_000 : 1_500)
      })
    }
    return client
  })
  return clientPromise
}

const PROVIDER_OFF_MESSAGE = 'Login com Google indisponível no momento. Entre com e-mail e senha.'
const providerChecks = new Map<string, Promise<boolean>>()

/**
 * Asks the auth server which providers are on ({url}/auth/v1/settings, public, needs only the anon key). A disabled provider
 * makes /authorize answer with raw JSON, so the UI checks first. Cached for the page session; anything unexpected counts as "on".
 */
function providerEnabled(cfg: SupabaseConfig, provider: string): Promise<boolean> {
  let check = providerChecks.get(provider)
  if (!check) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 5000)
    check = fetch(`${cfg.url.replace(/\/+$/, '')}/auth/v1/settings`, { headers: { apikey: cfg.anonKey }, signal: ctl.signal })
      .then(async (res) => {
        if (!res.ok) return true
        const data = (await res.json().catch(() => null)) as { external?: Record<string, unknown> } | null
        const flag = data?.external?.[provider]
        return typeof flag === 'boolean' ? flag : true
      })
      .catch(() => {
        providerChecks.delete(provider) // offline now does not mean disabled later: let the next call ask again
        return true
      })
      .finally(() => clearTimeout(timer))
    providerChecks.set(provider, check)
  }
  return check
}

const toSession = (s: Session | null): AuthSession | null =>
  s
    ? {
        accessToken: s.access_token,
        user: {
          id: s.user.id,
          email: s.user.email ?? '',
          // E-mail sign-up stores "name"; Google sends "full_name" / "name".
          name: String(s.user.user_metadata?.name ?? s.user.user_metadata?.full_name ?? s.user.email?.split('@')[0] ?? 'Você'),
          company: s.user.user_metadata?.company as string | undefined,
          segment: s.user.user_metadata?.segment as SegmentId | undefined,
        },
      }
    : null

/** Maps Supabase auth errors to pt-BR copy shown in the UI. */
export function authErrorMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return PROVIDER_OFF_MESSAGE
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
      // PKCE: the confirmation link returns to the app root with "?code=".
      const emailRedirectTo = `${window.location.origin}${window.location.pathname}`
      const { data, error } = await (await client()).auth.signUp({ email, password, options: { data: { name, company, segment }, emailRedirectTo } })
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
      // Do not send people to a raw JSON error page when the provider is switched off in the project.
      if (!(await providerEnabled(cfg, provider))) return { ok: false as const, error: PROVIDER_OFF_MESSAGE }
      const { error } = await (await client()).auth.signInWithOAuth({ provider, options: { redirectTo, queryParams: { prompt: 'select_account' } } })
      return error ? { ok: false as const, error: authErrorMessage(error.message) } : { ok: true as const }
    },
    providerEnabled: (provider) => providerEnabled(cfg, provider),
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
      // No subscription row (or one that is not entitled) is a free account (5 contents/month): its usage still comes from the server counter.
      const { data: usage, error: usageError } = await c.from('usage_counters').select('used').eq('period', month()).maybeSingle()
      fail(usageError)
      return { plan: effectiveBillingPlan(sub) as PlanId, used: Number(usage?.used ?? 0), status: (sub?.status as string | null | undefined) ?? null }
    },
  }
}
