/**
 * Stripe billing over the plain REST API (fetch + Web Crypto), so it runs in Node and in the Cloudflare Worker.
 * Nothing here reads process.env or touches routes: callers pass configuration in and persist what comes out.
 */
import { PLAN_LIMITS, effectiveBillingPlan, isPaidPlan, type BillingPlanId, type PaidPlanId } from '../src/lib/backend/planLimits.ts'

export type { BillingPlanId, PaidPlanId }
export type BillingInterval = 'month' | 'year'

export interface BillingConfig {
  secretKey: string
  /** Stripe price ids per plan and interval. `year` is optional per plan. */
  prices: Partial<Record<PaidPlanId, { month?: string; year?: string }>>
  /** Public site URL including the Pages base, no trailing slash. Example: https://voaneves.com/midflow-app */
  appUrl: string
}

/** Reads STRIPE_* / APP_URL names from an env-like object (process.env or the Worker env binding). */
export function billingConfigFromEnv(env: Record<string, string | undefined>): BillingConfig | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) return null
  const price = (name: string) => env[name]?.trim() || undefined
  return {
    secretKey,
    prices: {
      start: { month: price('STRIPE_PRICE_START'), year: price('STRIPE_PRICE_START_ANNUAL') },
      pro: { month: price('STRIPE_PRICE_PRO'), year: price('STRIPE_PRICE_PRO_ANNUAL') },
      business: { month: price('STRIPE_PRICE_BUSINESS'), year: price('STRIPE_PRICE_BUSINESS_ANNUAL') },
    },
    appUrl: (env.APP_URL?.trim() || 'https://voaneves.com/midflow-app').replace(/\/+$/, ''),
  }
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

export interface CheckoutInput {
  userId: string
  email?: string | null
  plan: unknown
  interval?: unknown
  /** Existing Stripe customer, so repeat buyers are not duplicated. */
  customerId?: string | null
}

export type CheckoutResult = { ok: true; url: string; id: string } | { ok: false; status: number; error: string }

/** Validates untrusted client input; the server never accepts a price id or amount from the browser. */
export function parseCheckoutRequest(body: unknown): { plan: PaidPlanId; interval: BillingInterval } | null {
  if (!body || typeof body !== 'object') return null
  const { plan, interval } = body as Record<string, unknown>
  if (!isPaidPlan(plan)) return null
  if (interval !== undefined && interval !== 'month' && interval !== 'year') return null
  return { plan, interval: interval ?? 'month' }
}

export async function createCheckoutSession(cfg: BillingConfig, input: CheckoutInput, fetchImpl: typeof fetch = fetch): Promise<CheckoutResult> {
  if (!isPaidPlan(input.plan)) return { ok: false, status: 400, error: 'Plano inválido.' }
  const interval: BillingInterval = input.interval === 'year' ? 'year' : 'month'
  const price = cfg.prices[input.plan]?.[interval]
  if (!price) return { ok: false, status: 503, error: 'Este plano ainda não está disponível para assinatura.' }

  const form = new URLSearchParams()
  form.set('mode', 'subscription')
  form.set('line_items[0][price]', price)
  form.set('line_items[0][quantity]', '1')
  form.set('client_reference_id', input.userId)
  form.set('success_url', `${cfg.appUrl}/#/app/planos?checkout=success`)
  form.set('cancel_url', `${cfg.appUrl}/#/app/planos?checkout=cancel`)
  form.set('locale', 'pt-BR')
  form.set('allow_promotion_codes', 'true')
  form.set('metadata[user_id]', input.userId)
  form.set('metadata[plan]', input.plan)
  form.set('subscription_data[metadata][user_id]', input.userId)
  form.set('subscription_data[metadata][plan]', input.plan)
  if (input.customerId) form.set('customer', input.customerId)
  else if (input.email) form.set('customer_email', input.email)

  let res: Response
  try {
    res = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Same user + plan + interval within a minute reuses the session instead of opening duplicates.
        'Idempotency-Key': `checkout:${input.userId}:${input.plan}:${interval}:${Math.floor(Date.now() / 60_000)}`,
      },
      body: form.toString(),
    })
  } catch {
    return { ok: false, status: 502, error: 'Não foi possível falar com o serviço de pagamento.' }
  }
  const data = (await res.json().catch(() => null)) as { id?: string; url?: string; error?: { message?: string } } | null
  if (!res.ok || !data?.url || !data.id) {
    // Stripe error text is for the server log, never for the browser.
    console.warn('[billing] checkout session failed', res.status, data?.error?.message)
    return { ok: false, status: 502, error: 'Não foi possível abrir o pagamento agora. Tente novamente.' }
  }
  return { ok: true, url: data.url, id: data.id }
}

export type PortalResult = { ok: true; url: string } | { ok: false; status: number; error: string }

/**
 * Stripe Customer Portal session (POST /v1/billing_portal/sessions): the hosted page where the customer changes plan,
 * updates the card, downloads invoices or cancels. Needs a portal configuration saved once in the Stripe dashboard.
 * The customer id must come from our own database, never from the browser.
 */
export async function createPortalSession(cfg: Pick<BillingConfig, 'secretKey' | 'appUrl'>, input: { customerId: string }, fetchImpl: typeof fetch = fetch): Promise<PortalResult> {
  const form = new URLSearchParams()
  form.set('customer', input.customerId)
  form.set('return_url', `${cfg.appUrl}/#/app/config`)
  form.set('locale', 'pt-BR')
  let res: Response
  try {
    res = await fetchImpl('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
  } catch {
    return { ok: false, status: 502, error: 'Não foi possível falar com o serviço de pagamento.' }
  }
  const data = (await res.json().catch(() => null)) as { url?: string; error?: { message?: string } } | null
  if (!res.ok || !data?.url) {
    // Stripe error text is for the server log, never for the browser (a missing portal configuration shows up here).
    console.warn('[billing] portal session failed', res.status, data?.error?.message)
    return { ok: false, status: 502, error: 'Não foi possível abrir o gerenciamento da assinatura agora. Tente novamente.' }
  }
  return { ok: true, url: data.url }
}

/**
 * Cancels a subscription immediately (DELETE /v1/subscriptions/:id). Used when an account is deleted.
 * An id Stripe no longer knows (404) counts as already cancelled. Any other failure is reported so the caller can abort.
 */
export async function cancelStripeSubscription(cfg: Pick<BillingConfig, 'secretKey'>, subscriptionId: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean }> {
  try {
    const res = await fetchImpl(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cfg.secretKey}` },
    })
    if (res.ok || res.status === 404) return { ok: true }
    console.warn('[billing] subscription cancel failed', res.status)
    return { ok: false }
  } catch {
    console.warn('[billing] subscription cancel failed: network')
    return { ok: false }
  }
}

/* ------------------------------------------------------------------ */
/* Webhook verification                                                */
/* ------------------------------------------------------------------ */

export interface StripeEvent {
  id: string
  type: string
  created?: number
  data: { object: Record<string, unknown> }
}

export type WebhookResult =
  | { ok: true; event: StripeEvent }
  | { ok: false; reason: 'missing_header' | 'malformed_header' | 'stale_timestamp' | 'bad_signature' | 'bad_payload' }

const encoder = new TextEncoder()

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/**
 * Verifies a Stripe-Signature header ("t=...,v1=...[,v1=...]") against the exact raw request body.
 * The signature check is constant time (subtle.verify) and any of several v1 values may match (secret rotation).
 */
export async function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  opts: { toleranceSec?: number; now?: number } = {},
): Promise<WebhookResult> {
  if (!signatureHeader) return { ok: false, reason: 'missing_header' }
  let timestamp = ''
  const sigs: string[] = []
  for (const part of signatureHeader.split(',')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (k === 't') timestamp = v
    else if (k === 'v1') sigs.push(v)
  }
  if (!/^\d{1,12}$/.test(timestamp) || !sigs.length) return { ok: false, reason: 'malformed_header' }

  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const tolerance = opts.toleranceSec ?? 300
  if (Math.abs(now - Number(timestamp)) > tolerance) return { ok: false, reason: 'stale_timestamp' }

  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const payload = encoder.encode(`${timestamp}.${rawBody}`)
  let matched = false
  for (const s of sigs) {
    const bytes = hexToBytes(s)
    if (bytes && bytes.length === 32 && (await crypto.subtle.verify('HMAC', key, bytes, payload))) matched = true
  }
  if (!matched) return { ok: false, reason: 'bad_signature' }

  try {
    const event = JSON.parse(rawBody) as StripeEvent
    if (!event || typeof event.id !== 'string' || typeof event.type !== 'string' || !event.data?.object) return { ok: false, reason: 'bad_payload' }
    return { ok: true, event }
  } catch {
    return { ok: false, reason: 'bad_payload' }
  }
}

/** Test and tooling helper: builds a valid Stripe-Signature header. */
export async function signStripePayload(rawBody: string, secret: string, timestamp: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`)))
  return `t=${timestamp},v1=${[...sig].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

/* ------------------------------------------------------------------ */
/* Event handling                                                      */
/* ------------------------------------------------------------------ */

/** Row to upsert into public.subscriptions (service role). Undefined fields are left untouched. */
export interface SubscriptionUpdate {
  /** Null when the event carries no user id; look the user up by stripeCustomerId. */
  userId: string | null
  plan?: PaidPlanId
  /** Stripe subscription status: active, trialing, past_due, canceled, unpaid, incomplete... */
  status: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  /** ISO timestamp. */
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
  /** Stripe event.created (seconds). The database ignores an update older than the last one applied, so retries and reordering cannot roll a subscription back. */
  eventCreated?: number
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
/** Stripe expands objects optionally: a field is either an id string or an object with an id. */
const idOf = (v: unknown): string | undefined => (typeof v === 'string' ? str(v) : v && typeof v === 'object' ? str((v as { id?: unknown }).id) : undefined)
const iso = (sec: unknown): string | undefined => (typeof sec === 'number' && sec > 0 ? new Date(sec * 1000).toISOString() : undefined)

/** Reverse lookup of a Stripe price id to our plan, for subscriptions created without metadata. */
export function planForPrice(cfg: Pick<BillingConfig, 'prices'>, priceId: string | undefined): PaidPlanId | undefined {
  if (!priceId) return undefined
  for (const [plan, p] of Object.entries(cfg.prices) as [PaidPlanId, { month?: string; year?: string }][]) {
    if (p.month === priceId || p.year === priceId) return plan
  }
  return undefined
}

/**
 * Translates a verified Stripe event into the subscription change to persist, or null for events we ignore.
 * Pure: the caller writes the result (see server/db/supabase.ts) and must answer 2xx for ignored events.
 */
export function handleStripeEvent(event: StripeEvent, cfg: Pick<BillingConfig, 'prices'> = { prices: {} }): SubscriptionUpdate | null {
  const update = planFromEvent(event, cfg)
  return update && typeof event.created === 'number' && event.created > 0 ? { ...update, eventCreated: event.created } : update
}

function planFromEvent(event: StripeEvent, cfg: Pick<BillingConfig, 'prices'>): SubscriptionUpdate | null {
  const obj = event.data.object
  switch (event.type) {
    case 'checkout.session.completed': {
      if (obj.mode !== 'subscription') return null
      const meta = (obj.metadata ?? {}) as Record<string, unknown>
      const userId = str(obj.client_reference_id) ?? str(meta.user_id) ?? null
      const plan = isPaidPlan(meta.plan) ? meta.plan : undefined
      // payment_status "paid" (or no_payment_required for trials and 100% coupons) means the plan can be unlocked now.
      const paid = obj.payment_status === 'paid' || obj.payment_status === 'no_payment_required'
      return {
        userId,
        plan,
        status: paid ? 'active' : 'incomplete',
        stripeCustomerId: idOf(obj.customer),
        stripeSubscriptionId: idOf(obj.subscription),
      }
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const meta = (obj.metadata ?? {}) as Record<string, unknown>
      const items = (obj.items as { data?: { price?: { id?: string }; current_period_end?: number }[] } | undefined)?.data ?? []
      const priceId = items[0]?.price?.id
      // The price is what Stripe actually charges; metadata is only a hint (it can be edited in the dashboard), so the price wins.
      const plan = planForPrice(cfg, priceId) ?? (isPaidPlan(meta.plan) ? meta.plan : undefined)
      const deleted = event.type === 'customer.subscription.deleted'
      return {
        userId: str(meta.user_id) ?? null,
        plan,
        status: deleted ? 'canceled' : (str(obj.status) ?? 'incomplete'),
        stripeCustomerId: idOf(obj.customer),
        stripeSubscriptionId: str(obj.id),
        // Newer API versions moved current_period_end onto the subscription item.
        currentPeriodEnd: iso(obj.current_period_end) ?? iso(items[0]?.current_period_end),
        cancelAtPeriodEnd: typeof obj.cancel_at_period_end === 'boolean' ? obj.cancel_at_period_end : undefined,
      }
    }
    default:
      return null
  }
}

/* ------------------------------------------------------------------ */
/* Plan resolution and quota                                           */
/* ------------------------------------------------------------------ */

/**
 * The plan whose limits apply. No subscription, or one that ended, falls back to the free plan (5 contents/month),
 * matching the app, where every new account begins on Grátis. 'free' is never stored in subscriptions.
 */
export function effectivePlan(sub: { plan?: string | null; status?: string | null } | null | undefined): BillingPlanId {
  return effectiveBillingPlan(sub)
}

/** Subscription statuses that still unlock the plan. Mirrors ENTITLED_STATUSES in src/lib/backend/planLimits.ts. */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

/** True when the person already pays for a plan through Stripe, so a new Checkout would create a second subscription. */
export function hasLiveSubscription(sub: { status?: string | null; stripe_subscription_id?: string | null } | null | undefined): boolean {
  return !!sub?.stripe_subscription_id && LIVE_STATUSES.has(sub.status ?? '')
}

/** Calendar month key (UTC) used by usage_counters.period, e.g. "2026-11". */
export function usagePeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

/** What one generation costs: each post counts 1, a Stories sequence counts 1 (same rule as the client store). */
export const generationCost = (posts: number, stories: number): number => Math.max(0, posts) + (stories > 0 ? 1 : 0)

export interface QuotaCheck {
  allowed: boolean
  plan: BillingPlanId
  limit: number
  used: number
  remaining: number
}

/** True when `cost` more contents still fit in the plan's monthly allowance. */
export function checkQuota(plan: BillingPlanId, used: number, cost: number): QuotaCheck {
  const limit = PLAN_LIMITS[plan].contents
  const remaining = Math.max(0, limit - used)
  return { allowed: cost <= remaining, plan, limit, used, remaining }
}

/** Brand-profile allowance for a plan, used when the server validates a brand upsert. */
export const profileLimit = (plan: BillingPlanId): number => PLAN_LIMITS[plan].profiles
