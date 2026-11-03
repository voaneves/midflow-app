import { api } from '../api'
import { createLocalAuth, createLocalRepository } from './local'
import type { Backend } from './types'

export type { AuthProvider, AuthResult, AuthSession, AuthUser, Backend, PlanUsage, Repository } from './types'

/** Public by design (the anon key is protected by Row Level Security), so VITE_* is fine here. */
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/** The single-file demo build never talks to a backend. */
const offlineBuild = import.meta.env.MODE === 'single'

export const isSupabaseConfigured = (): boolean => !offlineBuild && SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 0

/** Billing UI is on only when explicitly enabled AND Supabase auth exists (checkout needs a verified user). */
export const isBillingEnabled = (): boolean => isSupabaseConfigured() && String(import.meta.env.VITE_BILLING_ENABLED ?? '') === 'true'

let backend: Promise<Backend> | null = null

/**
 * Picks the backend once: Supabase when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set,
 * otherwise the localStorage adapter (the original behaviour, also used by demo mode).
 * The Supabase adapter is a dynamic import, so its code is fetched only when configured.
 */
export function getBackend(): Promise<Backend> {
  backend ??= isSupabaseConfigured()
    ? import('./supabase').then((m) => {
        const cfg = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }
        return { kind: 'supabase', auth: m.createSupabaseAuth(cfg), repo: m.createSupabaseRepository(cfg) } satisfies Backend
      })
    : Promise.resolve({ kind: 'local', auth: createLocalAuth(), repo: createLocalRepository() } satisfies Backend)
  return backend
}

/** Test hook. */
export function resetBackendForTests(): void {
  backend = null
}

export type CheckoutInterval = 'month' | 'year'

/**
 * Asks the API for a Stripe Checkout session and returns its URL.
 * The server derives the user from the Bearer token; the client only names the plan.
 */
export async function startCheckout(plan: string, interval: CheckoutInterval): Promise<{ ok: true; url: string } | { ok: false; error: string; status?: number }> {
  const session = await (await getBackend()).auth.getSession()
  if (!session?.accessToken) return { ok: false, error: 'Entre na sua conta para assinar um plano.' }
  try {
    const res = await fetch(api('/api/billing/checkout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ plan, interval }),
    })
    const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
    if (res.ok && data?.url) return { ok: true, url: data.url }
    return { ok: false, error: data?.error || 'Não foi possível abrir o pagamento agora. Tente novamente.', status: res.status }
  } catch {
    return { ok: false, error: 'Sem conexão com o servidor de pagamento. Tente novamente.' }
  }
}

/**
 * Opens the Stripe Customer Portal for the signed-in account (change card, switch or cancel the plan).
 * 404 = no subscription found, 503 = billing not configured on the server.
 */
export async function openBillingPortal(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const session = await (await getBackend()).auth.getSession()
  if (!session?.accessToken) return { ok: false, error: 'Entre na sua conta para gerenciar a assinatura.' }
  try {
    const res = await fetch(api('/api/billing/portal'), { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}` } })
    const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
    if (res.ok && data?.url) return { ok: true, url: data.url }
    if (res.status === 404) return { ok: false, error: data?.error || 'Nenhuma assinatura encontrada.' }
    if (res.status === 503) return { ok: false, error: 'O portal de assinatura não está disponível no momento. Tente novamente mais tarde.' }
    return { ok: false, error: data?.error || 'Não foi possível abrir o portal da assinatura agora. Tente novamente.' }
  } catch {
    return { ok: false, error: 'Sem conexão com o servidor de pagamento. Tente novamente.' }
  }
}

/**
 * LGPD art. 18: asks the API to delete the signed-in account (subscription, profile, brands, creations, library).
 * The browser only sends the typed confirmation; the user comes from the Bearer token.
 */
export async function deleteAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await (await getBackend()).auth.getSession()
  if (!session?.accessToken) return { ok: false, error: 'Entre na sua conta para excluí-la.' }
  try {
    const res = await fetch(api('/api/account/delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ confirm: 'EXCLUIR' }),
    })
    const data = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
    if (res.ok && data?.success) return { ok: true }
    return { ok: false, error: data?.error || 'Não foi possível excluir a conta agora. Tente novamente em instantes.' }
  } catch {
    return { ok: false, error: 'Sem conexão com o servidor. Tente novamente.' }
  }
}

/** Headers for authenticated API calls (empty when signed out or on the local adapter). */
export async function authHeaders(): Promise<Record<string, string>> {
  const session = await (await getBackend()).auth.getSession()
  return session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}
}
