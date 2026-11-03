/**
 * Server-side Supabase access through PostgREST with the service role key (bypasses RLS).
 * Plain fetch, so it works in Node and in the Cloudflare Worker. The key must never reach the browser.
 *
 * Used for what clients may not write themselves: subscriptions, usage counters and processed Stripe events.
 */
import type { SubscriptionUpdate } from '../billing.ts'

export interface DbConfig {
  /** https://<project>.supabase.co */
  url: string
  serviceRoleKey: string
}

export function dbConfigFromEnv(env: Record<string, string | undefined>): DbConfig | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '')
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return url && serviceRoleKey ? { url, serviceRoleKey } : null
}

export interface SubscriptionRow {
  user_id: string
  plan: string | null
  status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  /** Stripe event.created (seconds) of the last event applied. */
  last_event_at?: number | null
}

export type Fetch = typeof fetch

export const dbHeaders = (cfg: DbConfig, extra: Record<string, string> = {}) => ({
  apikey: cfg.serviceRoleKey,
  Authorization: `Bearer ${cfg.serviceRoleKey}`,
  'Content-Type': 'application/json',
  ...extra,
})

/** A failed PostgREST call. `code` is the Postgres SQLSTATE when PostgREST reports one (23505 = unique violation). */
export class DbError extends Error {
  status: number
  code: string | undefined
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function dbRequest(cfg: DbConfig, path: string, init: RequestInit, f: Fetch): Promise<unknown> {
  const res = await f(`${cfg.url}/rest/v1/${path}`, init)
  if (!res.ok) {
    let code: string | undefined
    try {
      const detail = (await res.json()) as { code?: unknown } | null
      if (typeof detail?.code === 'string') code = detail.code
    } catch {
      // body is not JSON: the status is enough
    }
    throw new DbError(`supabase ${init.method ?? 'GET'} ${path.split('?')[0]} -> ${res.status}`, res.status, code)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const dbEq = (v: string) => `eq.${encodeURIComponent(v)}`

export async function getSubscription(cfg: DbConfig, userId: string, f: Fetch = fetch): Promise<SubscriptionRow | null> {
  const rows = (await dbRequest(cfg, `subscriptions?user_id=${dbEq(userId)}&select=*&limit=1`, { headers: dbHeaders(cfg) }, f)) as SubscriptionRow[]
  return rows[0] ?? null
}

export async function findUserIdByCustomer(cfg: DbConfig, customerId: string, f: Fetch = fetch): Promise<string | null> {
  const rows = (await dbRequest(cfg, `subscriptions?stripe_customer_id=${dbEq(customerId)}&select=user_id&limit=1`, { headers: dbHeaders(cfg) }, f)) as { user_id: string }[]
  return rows[0]?.user_id ?? null
}

/**
 * Persists a billing update. When the event has no user id, the user is found through the Stripe customer id.
 * Returns false when the owner cannot be determined (the caller should still answer 2xx and log it).
 */
export async function applySubscriptionUpdate(cfg: DbConfig, update: SubscriptionUpdate, f: Fetch = fetch): Promise<boolean> {
  const userId = update.userId ?? (update.stripeCustomerId ? await findUserIdByCustomer(cfg, update.stripeCustomerId, f) : null)
  if (!userId) return false
  // public.apply_subscription_event keeps known values when a field is null and ignores events older than the last one applied.
  await dbRequest(
    cfg,
    'rpc/apply_subscription_event',
    {
      method: 'POST',
      headers: dbHeaders(cfg),
      body: JSON.stringify({
        p_user: userId,
        p_status: update.status,
        p_plan: update.plan ?? null,
        p_customer: update.stripeCustomerId ?? null,
        p_subscription: update.stripeSubscriptionId ?? null,
        p_period_end: update.currentPeriodEnd ?? null,
        p_cancel: update.cancelAtPeriodEnd ?? null,
        p_event_created: update.eventCreated ?? null,
      }),
    },
    f,
  )
  return true
}

export async function getUsage(cfg: DbConfig, userId: string, period: string, f: Fetch = fetch): Promise<number> {
  const rows = (await dbRequest(cfg, `usage_counters?user_id=${dbEq(userId)}&period=${dbEq(period)}&select=used&limit=1`, { headers: dbHeaders(cfg) }, f)) as { used: number }[]
  return Number(rows[0]?.used ?? 0)
}

/** Atomic increment (SQL function public.increment_usage); returns the new total for the period. */
export async function incrementUsage(cfg: DbConfig, userId: string, period: string, cost: number, f: Fetch = fetch): Promise<number> {
  const out = await dbRequest(
    cfg,
    'rpc/increment_usage',
    { method: 'POST', headers: dbHeaders(cfg), body: JSON.stringify({ p_user: userId, p_period: period, p_cost: cost }) },
    f,
  )
  return Number(out)
}

/** A claim that was never marked processed is retried after this long (the worker that took it probably died). */
export const STRIPE_CLAIM_STALE_MS = 5 * 60_000

export type StripeClaim = 'claimed' | 'processed' | 'in_flight'

/**
 * Webhook idempotency:
 *   - 'claimed':   first sight of the event id (or a stale claim taken over): process it
 *   - 'processed': already applied (processed_at set): answer 2xx, nothing to do
 *   - 'in_flight': claimed by another delivery that has not finished and is not stale yet: answer non-2xx so Stripe retries
 * A claim that was never marked processed and is older than 5 minutes is taken over (atomically, so only one retry wins).
 * Call markStripeEventProcessed after the update is persisted, or releaseStripeEvent if processing fails.
 */
export async function claimStripeEventState(cfg: DbConfig, eventId: string, f: Fetch = fetch, now = Date.now()): Promise<StripeClaim> {
  const rows = (await dbRequest(
    cfg,
    'stripe_events?on_conflict=id',
    { method: 'POST', headers: dbHeaders(cfg, { Prefer: 'resolution=ignore-duplicates,return=representation' }), body: JSON.stringify({ id: eventId }) },
    f,
  )) as unknown[] | null
  if (Array.isArray(rows) && rows.length > 0) return 'claimed'

  const existing = (await dbRequest(cfg, `stripe_events?id=${dbEq(eventId)}&select=processed_at,received_at&limit=1`, { headers: dbHeaders(cfg) }, f)) as
    | { processed_at: string | null; received_at: string }[]
    | null
  const row = existing?.[0]
  if (row?.processed_at) return 'processed'
  if (!row) return 'in_flight' // deleted between the two calls (released after a failure): let the retry claim it
  const received = Date.parse(row.received_at)
  if (!Number.isFinite(received) || now - received <= STRIPE_CLAIM_STALE_MS) return 'in_flight'

  const cutoff = new Date(now - STRIPE_CLAIM_STALE_MS).toISOString()
  const taken = (await dbRequest(
    cfg,
    `stripe_events?id=${dbEq(eventId)}&processed_at=is.null&received_at=lt.${encodeURIComponent(cutoff)}`,
    { method: 'PATCH', headers: dbHeaders(cfg, { Prefer: 'return=representation' }), body: JSON.stringify({ received_at: new Date(now).toISOString() }) },
    f,
  )) as unknown[] | null
  return Array.isArray(taken) && taken.length > 0 ? 'claimed' : 'in_flight'
}

/** Boolean form of claimStripeEventState: true only when this delivery should be processed. */
export async function claimStripeEvent(cfg: DbConfig, eventId: string, f: Fetch = fetch, now = Date.now()): Promise<boolean> {
  return (await claimStripeEventState(cfg, eventId, f, now)) === 'claimed'
}

export async function markStripeEventProcessed(cfg: DbConfig, eventId: string, f: Fetch = fetch, now = Date.now()): Promise<void> {
  await dbRequest(
    cfg,
    `stripe_events?id=${dbEq(eventId)}`,
    { method: 'PATCH', headers: dbHeaders(cfg, { Prefer: 'return=minimal' }), body: JSON.stringify({ processed_at: new Date(now).toISOString() }) },
    f,
  )
}

export async function releaseStripeEvent(cfg: DbConfig, eventId: string, f: Fetch = fetch): Promise<void> {
  await dbRequest(cfg, `stripe_events?id=${dbEq(eventId)}`, { method: 'DELETE', headers: dbHeaders(cfg) }, f)
}

/* ------------------------------------------------------------------ */
/* Staff (RBAC)                                                        */
/* ------------------------------------------------------------------ */

export type StaffRole = 'admin' | 'editor'
export const isStaffRole = (v: unknown): v is StaffRole => v === 'admin' || v === 'editor'

export interface StaffRow {
  user_id: string
  role: StaffRole
  created_at: string
  created_by: string | null
}

export async function getStaffRole(cfg: DbConfig, userId: string, f: Fetch = fetch): Promise<StaffRole | null> {
  const rows = (await dbRequest(cfg, `staff_members?user_id=${dbEq(userId)}&select=role&limit=1`, { headers: dbHeaders(cfg) }, f)) as { role: string }[]
  const role = rows[0]?.role
  return isStaffRole(role) ? role : null
}

export async function listStaff(cfg: DbConfig, f: Fetch = fetch): Promise<(StaffRow & { email: string | null; name: string | null })[]> {
  const rows = (await dbRequest(cfg, 'staff_members?select=user_id,role,created_at,created_by&order=created_at.asc&limit=200', { headers: dbHeaders(cfg) }, f)) as StaffRow[]
  if (!rows.length) return []
  const ids = rows.map((r) => r.user_id).join(',')
  const profiles = (await dbRequest(cfg, `profiles?id=in.(${ids})&select=id,email,name`, { headers: dbHeaders(cfg) }, f)) as { id: string; email: string | null; name: string | null }[]
  const byId = new Map(profiles.map((p) => [p.id, p]))
  return rows.map((r) => ({ ...r, email: byId.get(r.user_id)?.email ?? null, name: byId.get(r.user_id)?.name ?? null }))
}

/**
 * Looks up the person who owns an e-mail address through public.find_confirmed_user_by_email (service role only).
 * The function reads auth.users, so the match is on the verified account e-mail, never on anything a user can edit;
 * unconfirmed or deleted accounts are not returned. Anything but exactly one match is "not found".
 */
export async function findUserByEmail(cfg: DbConfig, email: string, f: Fetch = fetch): Promise<{ id: string; email: string | null; name: string | null } | null> {
  const rows = (await dbRequest(
    cfg,
    'rpc/find_confirmed_user_by_email',
    { method: 'POST', headers: dbHeaders(cfg), body: JSON.stringify({ p_email: email.trim().toLowerCase() }) },
    f,
  )) as { id: string; email: string | null; name: string | null }[] | null
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null
}

export type StaffChange = 'ok' | 'last_admin' | 'not_found'

/** Sets a role (insert or change). Under an advisory lock, so two concurrent demotions cannot leave zero admins. */
export async function setStaffRoleGuarded(cfg: DbConfig, userId: string, role: StaffRole, createdBy: string | null, f: Fetch = fetch): Promise<StaffChange> {
  const out = await dbRequest(
    cfg,
    'rpc/set_staff_role_guarded',
    { method: 'POST', headers: dbHeaders(cfg), body: JSON.stringify({ p_user: userId, p_role: role, p_actor: createdBy }) },
    f,
  )
  return out === 'last_admin' ? 'last_admin' : 'ok'
}

/** Removes a staff member unless they are the last admin (checked and deleted under the same advisory lock). */
export async function removeStaffGuarded(cfg: DbConfig, userId: string, f: Fetch = fetch): Promise<StaffChange> {
  const out = await dbRequest(cfg, 'rpc/remove_staff_guarded', { method: 'POST', headers: dbHeaders(cfg), body: JSON.stringify({ p_user: userId }) }, f)
  return out === 'last_admin' ? 'last_admin' : out === 'not_found' ? 'not_found' : 'ok'
}

export async function countAdmins(cfg: DbConfig, f: Fetch = fetch): Promise<number> {
  const rows = (await dbRequest(cfg, 'staff_members?role=eq.admin&select=user_id', { headers: dbHeaders(cfg) }, f)) as unknown[]
  return rows.length
}

/* ------------------------------------------------------------------ */
/* Account deletion                                                    */
/* ------------------------------------------------------------------ */

/** Review requests carry the customer's briefing, comment and contact e-mail, so they are erased with the account. */
export async function deleteUserReviews(cfg: DbConfig, userId: string, f: Fetch = fetch): Promise<void> {
  await dbRequest(cfg, `review_requests?user_id=${dbEq(userId)}`, { method: 'DELETE', headers: dbHeaders(cfg) }, f)
}

/** Detaches the AI health rows from the person (the rows themselves hold no personal data and stay for statistics). */
export async function anonymizeAiEvents(cfg: DbConfig, userId: string, f: Fetch = fetch): Promise<void> {
  await dbRequest(
    cfg,
    `ai_events?user_id=${dbEq(userId)}`,
    { method: 'PATCH', headers: dbHeaders(cfg, { Prefer: 'return=minimal' }), body: JSON.stringify({ user_id: null }) },
    f,
  )
}

/**
 * Deletes the Supabase Auth user (admin API). Every table that references auth.users cascades or sets null,
 * so this removes the profile, brands, generations, library, subscription and usage rows too.
 * An unknown user (404) counts as already deleted.
 */
export async function deleteAuthUser(cfg: DbConfig, userId: string, f: Fetch = fetch): Promise<void> {
  const res = await f(`${cfg.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE', headers: dbHeaders(cfg) })
  if (!res.ok && res.status !== 404) throw new Error(`supabase DELETE auth/admin/users -> ${res.status}`)
}
