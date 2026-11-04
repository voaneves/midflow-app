import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  billingConfigFromEnv,
  checkQuota,
  createCheckoutSession,
  effectivePlan,
  generationCost,
  handleStripeEvent,
  hasLiveSubscription,
  parseCheckoutRequest,
  profileLimit,
  signStripePayload,
  usagePeriod,
  verifyStripeWebhook,
  type BillingConfig,
  type BillingPlanId,
  type StripeEvent,
} from '../billing.ts'
import { applySubscriptionUpdate, claimStripeEvent, claimStripeEventState, DbError, incrementUsage, markStripeEventProcessed, STRIPE_CLAIM_STALE_MS, type DbConfig } from '../db/supabase.ts'
import { PLAN_LIMITS } from '../../src/lib/backend/planLimits.ts'

const USER = '3f1c2b7e-9a4d-4c1e-8f60-5b2d7a9e1c04'
const WHSEC = 'whsec_test_secret'
const cfg: BillingConfig = {
  secretKey: 'sk_test_123',
  prices: { start: { month: 'price_start_m' }, pro: { month: 'price_pro_m', year: 'price_pro_y' }, business: { month: 'price_biz_m' } },
  appUrl: 'https://voaneves.com/midflow-app',
}

// Dynamic, non-literal path: data.ts is front-end code that the server tsconfig does not type-check.
const dataModule = '../../src/lib/data.ts'

test('plan limits match the plan catalog shown in the app', async () => {
  const { ALL_PLANS: PLANS } = (await import(dataModule)) as { ALL_PLANS: { id: BillingPlanId; contents: number; profiles: number; variations: number; price: number }[] }
  assert.equal(PLANS.length, 4)
  assert.equal(PLANS.length, Object.keys(PLAN_LIMITS).length)
  for (const p of PLANS) {
    assert.deepEqual(PLAN_LIMITS[p.id], { contents: p.contents, profiles: p.profiles, variations: p.variations, priceBrl: p.price }, p.id)
  }
})

test('billingConfigFromEnv needs the secret key and maps price ids', () => {
  assert.equal(billingConfigFromEnv({}), null)
  const c = billingConfigFromEnv({ STRIPE_SECRET_KEY: ' sk_x ', STRIPE_PRICE_PRO: 'price_1', STRIPE_PRICE_PRO_ANNUAL: 'price_2', APP_URL: 'https://example.com/app/' })
  assert.equal(c?.secretKey, 'sk_x')
  assert.equal(c?.prices.pro?.month, 'price_1')
  assert.equal(c?.prices.pro?.year, 'price_2')
  assert.equal(c?.prices.start?.month, undefined)
  assert.equal(c?.appUrl, 'https://example.com/app')
  assert.equal(billingConfigFromEnv({ STRIPE_SECRET_KEY: 'k' })?.appUrl, 'https://voaneves.com/midflow-app')
})

test('parseCheckoutRequest accepts only known plans and intervals', () => {
  assert.deepEqual(parseCheckoutRequest({ plan: 'pro' }), { plan: 'pro', interval: 'month' })
  assert.deepEqual(parseCheckoutRequest({ plan: 'business', interval: 'year' }), { plan: 'business', interval: 'year' })
  for (const bad of [null, 'pro', {}, { plan: 'enterprise' }, { plan: 'pro', interval: 'week' }, { plan: '__proto__' }, { plan: 'toString' }, { plan: 'free' }]) {
    assert.equal(parseCheckoutRequest(bad), null)
  }
})

test('createCheckoutSession posts a form-encoded subscription session to Stripe', async () => {
  let seen: { url: string; init: RequestInit } | undefined
  const fake = (async (url: string, init: RequestInit) => {
    seen = { url, init }
    return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 })
  }) as unknown as typeof fetch

  const r = await createCheckoutSession(cfg, { userId: USER, email: 'ana@example.com', plan: 'pro', interval: 'year' }, fake)
  assert.deepEqual(r, { ok: true, id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' })

  assert.equal(seen?.url, 'https://api.stripe.com/v1/checkout/sessions')
  const headers = seen?.init.headers as Record<string, string>
  assert.equal(headers.Authorization, 'Bearer sk_test_123')
  assert.equal(headers['Content-Type'], 'application/x-www-form-urlencoded')
  const form = new URLSearchParams(String(seen?.init.body))
  assert.equal(form.get('mode'), 'subscription')
  assert.equal(form.get('line_items[0][price]'), 'price_pro_y')
  assert.equal(form.get('client_reference_id'), USER)
  assert.equal(form.get('metadata[plan]'), 'pro')
  assert.equal(form.get('subscription_data[metadata][user_id]'), USER)
  assert.equal(form.get('customer_email'), 'ana@example.com')
  assert.equal(form.get('success_url'), 'https://voaneves.com/midflow-app/#/app/planos?checkout=success')
  assert.equal(form.get('cancel_url'), 'https://voaneves.com/midflow-app/#/app/planos?checkout=cancel')
})

test('createCheckoutSession prefers an existing customer and rejects unknown plans or missing prices', async () => {
  let body = ''
  const ok = (async (_u: string, init: RequestInit) => {
    body = String(init.body)
    return new Response(JSON.stringify({ id: 'cs', url: 'https://checkout.stripe.com/x' }), { status: 200 })
  }) as unknown as typeof fetch
  await createCheckoutSession(cfg, { userId: USER, email: 'a@b.co', plan: 'start', customerId: 'cus_9' }, ok)
  const form = new URLSearchParams(body)
  assert.equal(form.get('customer'), 'cus_9')
  assert.equal(form.has('customer_email'), false)

  const never = (async () => assert.fail('must not call Stripe')) as unknown as typeof fetch
  assert.deepEqual(await createCheckoutSession(cfg, { userId: USER, plan: 'gold' }, never), { ok: false, status: 400, error: 'Plano inválido.' })
  // 'free' is not for sale: it is never sent to Stripe nor stored.
  assert.deepEqual(await createCheckoutSession(cfg, { userId: USER, plan: 'free' }, never), { ok: false, status: 400, error: 'Plano inválido.' })
  const noAnnual = await createCheckoutSession(cfg, { userId: USER, plan: 'start', interval: 'year' }, never)
  assert.equal(noAnnual.ok, false)
  assert.equal(!noAnnual.ok && noAnnual.status, 503)
})

test('createCheckoutSession hides Stripe errors from the caller', async () => {
  const warn = console.warn
  console.warn = () => {}
  try {
    const bad = (async () => new Response(JSON.stringify({ error: { message: 'No such price: price_x' } }), { status: 400 })) as unknown as typeof fetch
    const r = await createCheckoutSession(cfg, { userId: USER, plan: 'pro' }, bad)
    assert.equal(r.ok, false)
    assert.ok(!JSON.stringify(r).includes('price_x'))
    const down = (async () => {
      throw new Error('ECONNRESET')
    }) as unknown as typeof fetch
    const r2 = await createCheckoutSession(cfg, { userId: USER, plan: 'pro' }, down)
    assert.equal(!r2.ok && r2.status, 502)
  } finally {
    console.warn = warn
  }
})

/* ---------------------------- webhook ---------------------------- */

const NOW = 1_800_000_000
const eventBody = (type: string, object: Record<string, unknown>, id = 'evt_1') => JSON.stringify({ id, type, data: { object } })

test('verifyStripeWebhook accepts a correctly signed payload', async () => {
  const raw = eventBody('checkout.session.completed', { mode: 'subscription' })
  const header = await signStripePayload(raw, WHSEC, NOW)
  const r = await verifyStripeWebhook(raw, header, WHSEC, { now: NOW + 10 })
  assert.equal(r.ok, true)
  assert.equal(r.ok && r.event.type, 'checkout.session.completed')
})

test('verifyStripeWebhook accepts any matching v1 (secret rotation) and ignores v0', async () => {
  const raw = eventBody('x', {})
  const good = (await signStripePayload(raw, WHSEC, NOW)).split(',v1=')[1]
  const header = `t=${NOW},v0=deadbeef,v1=${'0'.repeat(64)},v1=${good}`
  assert.equal((await verifyStripeWebhook(raw, header, WHSEC, { now: NOW })).ok, true)
})

test('verifyStripeWebhook rejects bad signatures, edited bodies and wrong secrets', async () => {
  const raw = eventBody('x', { a: 1 })
  const header = await signStripePayload(raw, WHSEC, NOW)
  const reason = async (b: string, h: string | null, s = WHSEC) => {
    const r = await verifyStripeWebhook(b, h, s, { now: NOW })
    return r.ok ? 'ok' : r.reason
  }
  assert.equal(await reason(raw.replace('"a":1', '"a":2'), header), 'bad_signature')
  assert.equal(await reason(raw, header, 'whsec_other'), 'bad_signature')
  assert.equal(await reason(raw, `t=${NOW},v1=${'a'.repeat(64)}`), 'bad_signature')
  assert.equal(await reason(raw, `t=${NOW},v1=zz`), 'bad_signature')
  assert.equal(await reason(raw, null), 'missing_header')
  assert.equal(await reason(raw, ''), 'missing_header')
  assert.equal(await reason(raw, 'garbage'), 'malformed_header')
  assert.equal(await reason(raw, `v1=${'a'.repeat(64)}`), 'malformed_header')
  assert.equal(await reason(raw, `t=abc,v1=${'a'.repeat(64)}`), 'malformed_header')
})

test('verifyStripeWebhook enforces the timestamp tolerance in both directions', async () => {
  const raw = eventBody('x', {})
  const old = await signStripePayload(raw, WHSEC, NOW - 301)
  const stale = await verifyStripeWebhook(raw, old, WHSEC, { now: NOW })
  assert.equal(!stale.ok && stale.reason, 'stale_timestamp')
  const future = await signStripePayload(raw, WHSEC, NOW + 301)
  assert.equal((await verifyStripeWebhook(raw, future, WHSEC, { now: NOW })).ok, false)
  const edge = await signStripePayload(raw, WHSEC, NOW - 300)
  assert.equal((await verifyStripeWebhook(raw, edge, WHSEC, { now: NOW })).ok, true)
  const wide = await verifyStripeWebhook(raw, old, WHSEC, { now: NOW, toleranceSec: 600 })
  assert.equal(wide.ok, true)
})

test('verifyStripeWebhook rejects a signed body that is not a Stripe event', async () => {
  for (const raw of ['not json', '{}', JSON.stringify({ id: 1, type: 'x', data: { object: {} } })]) {
    const header = await signStripePayload(raw, WHSEC, NOW)
    const r = await verifyStripeWebhook(raw, header, WHSEC, { now: NOW })
    assert.equal(!r.ok && r.reason, 'bad_payload')
  }
})

/* ----------------------------- events ----------------------------- */

const ev = (type: string, object: Record<string, unknown>): StripeEvent => ({ id: 'evt_1', type, data: { object } })

test('checkout.session.completed activates the plan from client_reference_id and metadata', () => {
  const u = handleStripeEvent(ev('checkout.session.completed', { mode: 'subscription', client_reference_id: USER, metadata: { plan: 'pro', user_id: USER }, payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1' }))
  assert.deepEqual(u, { userId: USER, plan: 'pro', status: 'active', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' })
})

test('checkout.session.completed with an unpaid session stays incomplete; non-subscription is ignored', () => {
  const unpaid = handleStripeEvent(ev('checkout.session.completed', { mode: 'subscription', client_reference_id: USER, metadata: { plan: 'start' }, payment_status: 'unpaid', customer: { id: 'cus_2' } }))
  assert.equal(unpaid?.status, 'incomplete')
  assert.equal(unpaid?.stripeCustomerId, 'cus_2')
  assert.equal(handleStripeEvent(ev('checkout.session.completed', { mode: 'payment' })), null)
})

test('webhook events never carry the free plan: metadata.plan "free" is ignored', () => {
  const done = handleStripeEvent(ev('checkout.session.completed', { mode: 'subscription', client_reference_id: USER, metadata: { plan: 'free' }, payment_status: 'paid' }))
  assert.equal(done?.plan, undefined)
  const sub = handleStripeEvent(ev('customer.subscription.updated', { id: 'sub_1', status: 'active', metadata: { user_id: USER, plan: 'free' }, items: { data: [] } }))
  assert.equal(sub?.plan, undefined)
})

test('checkout.session.completed ignores an unknown plan in metadata', () => {
  const u = handleStripeEvent(ev('checkout.session.completed', { mode: 'subscription', client_reference_id: USER, metadata: { plan: 'enterprise' }, payment_status: 'paid' }))
  assert.equal(u?.plan, undefined)
})

test('customer.subscription.updated maps status, plan, period end and cancel flag', () => {
  const u = handleStripeEvent(
    ev('customer.subscription.updated', {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'past_due',
      cancel_at_period_end: true,
      current_period_end: 1_800_000_000,
      metadata: { user_id: USER, plan: 'business' },
      items: { data: [{ price: { id: 'price_biz_m' } }] },
    }),
    cfg,
  )
  assert.deepEqual(u, {
    userId: USER,
    plan: 'business',
    status: 'past_due',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    currentPeriodEnd: new Date(1_800_000_000 * 1000).toISOString(),
    cancelAtPeriodEnd: true,
  })
})

test('subscription events resolve the plan from the price id when metadata is missing, and read item period end', () => {
  const u = handleStripeEvent(
    ev('customer.subscription.updated', { id: 'sub_2', customer: 'cus_3', status: 'active', items: { data: [{ price: { id: 'price_pro_y' }, current_period_end: 1_800_100_000 }] } }),
    cfg,
  )
  assert.equal(u?.plan, 'pro')
  assert.equal(u?.userId, null)
  assert.equal(u?.currentPeriodEnd, new Date(1_800_100_000 * 1000).toISOString())
})

test('subscription events: the Stripe price wins over a conflicting metadata plan', () => {
  // metadata says "business" (editable in the Stripe dashboard) but the customer is charged the Pro price
  const u = handleStripeEvent(
    ev('customer.subscription.updated', { id: 'sub_9', customer: 'cus_9', status: 'active', metadata: { user_id: USER, plan: 'business' }, items: { data: [{ price: { id: 'price_pro_m' } }] } }),
    cfg,
  )
  assert.equal(u?.plan, 'pro')
  // an unknown price falls back to the metadata hint
  const fallback = handleStripeEvent(
    ev('customer.subscription.updated', { id: 'sub_9', customer: 'cus_9', status: 'active', metadata: { user_id: USER, plan: 'business' }, items: { data: [{ price: { id: 'price_unknown' } }] } }),
    cfg,
  )
  assert.equal(fallback?.plan, 'business')
})

test('handleStripeEvent carries event.created so the database can order events', () => {
  const u = handleStripeEvent({ id: 'evt_9', type: 'customer.subscription.deleted', created: 1_800_000_123, data: { object: { id: 'sub_1', customer: 'cus_1', metadata: { user_id: USER } } } }, cfg)
  assert.equal(u?.eventCreated, 1_800_000_123)
  assert.equal(handleStripeEvent(ev('customer.subscription.deleted', { id: 'sub_1', metadata: { user_id: USER } }), cfg)?.eventCreated, undefined)
})

test('hasLiveSubscription: only entitled statuses with a Stripe subscription block a new checkout', () => {
  assert.equal(hasLiveSubscription({ status: 'active', stripe_subscription_id: 'sub_1' }), true)
  assert.equal(hasLiveSubscription({ status: 'trialing', stripe_subscription_id: 'sub_1' }), true)
  assert.equal(hasLiveSubscription({ status: 'past_due', stripe_subscription_id: 'sub_1' }), true)
  assert.equal(hasLiveSubscription({ status: 'canceled', stripe_subscription_id: 'sub_1' }), false)
  assert.equal(hasLiveSubscription({ status: 'incomplete', stripe_subscription_id: 'sub_1' }), false)
  assert.equal(hasLiveSubscription({ status: 'active', stripe_subscription_id: null }), false)
  assert.equal(hasLiveSubscription(null), false)
})

test('customer.subscription.deleted cancels regardless of the payload status', () => {
  const u = handleStripeEvent(ev('customer.subscription.deleted', { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { user_id: USER, plan: 'pro' } }), cfg)
  assert.equal(u?.status, 'canceled')
  assert.equal(u?.userId, USER)
})

test('unrelated events are ignored', () => {
  assert.equal(handleStripeEvent(ev('invoice.paid', {})), null)
  assert.equal(handleStripeEvent(ev('customer.created', {})), null)
})

/* ------------------------- plans and quota ------------------------- */

test('effectivePlan grants a plan only while the subscription is entitled', () => {
  assert.equal(effectivePlan({ plan: 'pro', status: 'active' }), 'pro')
  assert.equal(effectivePlan({ plan: 'business', status: 'trialing' }), 'business')
  assert.equal(effectivePlan({ plan: 'business', status: 'past_due' }), 'business')
  assert.equal(effectivePlan({ plan: 'start', status: 'active' }), 'start')
  assert.equal(effectivePlan({ plan: 'pro', status: 'canceled' }), 'free')
  assert.equal(effectivePlan({ plan: 'pro', status: 'incomplete' }), 'free')
  assert.equal(effectivePlan({ plan: 'platinum', status: 'active' }), 'free')
  // 'free' is never stored; a row that says so still does not make it a paid plan.
  assert.equal(effectivePlan({ plan: 'free', status: 'active' }), 'free')
  assert.equal(effectivePlan(null), 'free')
})

test('usagePeriod is the UTC calendar month', () => {
  assert.equal(usagePeriod(new Date('2026-11-03T12:00:00Z')), '2026-11')
  assert.equal(usagePeriod(new Date('2026-12-31T23:59:59Z')), '2026-12')
  assert.equal(usagePeriod(new Date('2027-01-01T00:00:00Z')), '2027-01')
})

test('generationCost counts each post plus one for a Stories sequence', () => {
  assert.equal(generationCost(4, 4), 5)
  assert.equal(generationCost(4, 0), 4)
  assert.equal(generationCost(0, 4), 1)
  assert.equal(generationCost(-1, 0), 0)
})

test('checkQuota enforces the monthly allowance of each plan', () => {
  assert.deepEqual(checkQuota('start', 15, 5), { allowed: true, plan: 'start', limit: 20, used: 15, remaining: 5 })
  assert.equal(checkQuota('start', 16, 5).allowed, false)
  assert.equal(checkQuota('pro', 55, 5).allowed, true)
  assert.equal(checkQuota('business', 150, 1).allowed, false)
  assert.equal(checkQuota('business', 200, 0).remaining, 0)
})

test('the free plan allows exactly one full pack (4 posts + 1 Stories) per month and one brand profile', () => {
  assert.deepEqual(checkQuota('free', 4, 1), { allowed: true, plan: 'free', limit: 5, used: 4, remaining: 1 })
  assert.equal(checkQuota('free', 5, 1).allowed, false)
  assert.equal(checkQuota('free', 0, generationCost(4, 1)).allowed, true)
  assert.equal(checkQuota('free', 1, generationCost(4, 1)).allowed, false)
  assert.equal(profileLimit('free'), 1)
  assert.equal(PLAN_LIMITS.free.priceBrl, 0)
})

/* ------------------------------ db ------------------------------ */

const db: DbConfig = { url: 'https://abc.supabase.co', serviceRoleKey: 'service-key' }

function recorder(responses: Record<string, unknown>) {
  const calls: { url: string; init: RequestInit }[] = []
  const f = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    const key = Object.keys(responses).find((k) => url.includes(k))
    return new Response(key ? JSON.stringify(responses[key]) : '', { status: 200 })
  }) as unknown as typeof fetch
  return { calls, f }
}

test('applySubscriptionUpdate goes through the ordered RPC with the service role and passes event.created', async () => {
  const { calls, f } = recorder({})
  const ok = await applySubscriptionUpdate(db, { userId: USER, plan: 'pro', status: 'active', stripeCustomerId: 'cus_1', eventCreated: 1_800_000_000 }, f)
  assert.equal(ok, true)
  assert.equal(calls.length, 1)
  assert.ok(calls[0].url.endsWith('/rest/v1/rpc/apply_subscription_event'))
  const h = calls[0].init.headers as Record<string, string>
  assert.equal(h.Authorization, 'Bearer service-key')
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    p_user: USER,
    p_status: 'active',
    p_plan: 'pro',
    p_customer: 'cus_1',
    p_subscription: null,
    p_period_end: null,
    p_cancel: null,
    p_event_created: 1_800_000_000,
  })
})

test('applySubscriptionUpdate finds the owner by Stripe customer when the event has no user id', async () => {
  const { calls, f } = recorder({ 'stripe_customer_id=eq.cus_7': [{ user_id: USER }] })
  assert.equal(await applySubscriptionUpdate(db, { userId: null, status: 'canceled', stripeCustomerId: 'cus_7' }, f), true)
  assert.equal(calls.length, 2)
  assert.equal(JSON.parse(String(calls[1].init.body)).p_user, USER)

  const none = recorder({ 'stripe_customer_id=eq.cus_8': [] })
  assert.equal(await applySubscriptionUpdate(db, { userId: null, status: 'canceled', stripeCustomerId: 'cus_8' }, none.f), false)
  assert.equal(none.calls.length, 1)
  assert.equal(await applySubscriptionUpdate(db, { userId: null, status: 'canceled' }, none.f), false)
})

test('incrementUsage calls the atomic SQL function and claimStripeEvent detects redeliveries', async () => {
  const inc = recorder({ 'rpc/increment_usage': 12 })
  assert.equal(await incrementUsage(db, USER, '2026-11', 5, inc.f), 12)
  assert.deepEqual(JSON.parse(String(inc.calls[0].init.body)), { p_user: USER, p_period: '2026-11', p_cost: 5 })

  assert.equal(await claimStripeEvent(db, 'evt_1', recorder({ stripe_events: [{ id: 'evt_1' }] }).f), true)
  assert.equal(await claimStripeEvent(db, 'evt_1', recorder({ stripe_events: [] }).f), false)
})

/** Fake stripe_events table behind PostgREST-shaped URLs, enough for the claim / takeover flow. */
function stripeEventsFetch(row: { id: string; received_at: string; processed_at: string | null } | null) {
  const calls: string[] = []
  const f = (async (url: string, init: RequestInit = {}) => {
    const u = new URL(url)
    const method = init.method ?? 'GET'
    calls.push(`${method} ${u.pathname}${u.search}`)
    if (method === 'POST') return Response.json(row ? [] : [{ id: 'evt_x' }])
    if (method === 'GET') return Response.json(row ? [row] : [])
    if (method === 'PATCH') {
      const body = JSON.parse(String(init.body))
      if ('processed_at' in body) {
        if (row) row.processed_at = body.processed_at
        return new Response(null, { status: 204 })
      }
      const cutoff = decodeURIComponent(u.search.match(/received_at=lt\.([^&]+)/)![1])
      const eligible = row && row.processed_at === null && row.received_at < cutoff
      if (eligible) row!.received_at = body.received_at
      return Response.json(eligible ? [row] : [])
    }
    return new Response('?', { status: 500 })
  }) as unknown as typeof fetch
  return { calls, f }
}

test('claimStripeEvent: processed events are skipped, fresh unprocessed claims wait, stale ones are taken over', async () => {
  const now = Date.parse('2026-11-03T12:00:00Z')
  const iso = (ms: number) => new Date(ms).toISOString()

  const done = stripeEventsFetch({ id: 'evt_x', received_at: iso(now - 3_600_000), processed_at: iso(now - 3_000_000) })
  assert.equal(await claimStripeEvent(db, 'evt_x', done.f, now), false)

  const fresh = stripeEventsFetch({ id: 'evt_x', received_at: iso(now - 60_000), processed_at: null })
  assert.equal(await claimStripeEvent(db, 'evt_x', fresh.f, now), false)
  assert.ok(!fresh.calls.some((c) => c.startsWith('PATCH')))

  const stale = stripeEventsFetch({ id: 'evt_x', received_at: iso(now - STRIPE_CLAIM_STALE_MS - 1000), processed_at: null })
  assert.equal(await claimStripeEvent(db, 'evt_x', stale.f, now), true)
  assert.ok(stale.calls.some((c) => c.startsWith('PATCH') && c.includes('processed_at=is.null')))
  // the takeover refreshed the claim, so a concurrent retry no longer qualifies
  assert.equal(await claimStripeEvent(db, 'evt_x', stale.f, now), false)

  const fresh2 = stripeEventsFetch(null)
  assert.equal(await claimStripeEvent(db, 'evt_x', fresh2.f, now), true)
})

test('claimStripeEventState tells a processed event from one still in flight', async () => {
  const now = Date.parse('2026-11-03T12:00:00Z')
  const iso = (ms: number) => new Date(ms).toISOString()
  const done = stripeEventsFetch({ id: 'evt_x', received_at: iso(now - 3_600_000), processed_at: iso(now - 3_000_000) })
  assert.equal(await claimStripeEventState(db, 'evt_x', done.f, now), 'processed')
  const fresh = stripeEventsFetch({ id: 'evt_x', received_at: iso(now - 60_000), processed_at: null })
  assert.equal(await claimStripeEventState(db, 'evt_x', fresh.f, now), 'in_flight')
  const stale = stripeEventsFetch({ id: 'evt_x', received_at: iso(now - STRIPE_CLAIM_STALE_MS - 1000), processed_at: null })
  assert.equal(await claimStripeEventState(db, 'evt_x', stale.f, now), 'claimed')
  assert.equal(await claimStripeEventState(db, 'evt_x', stripeEventsFetch(null).f, now), 'claimed')
})

test('markStripeEventProcessed sets processed_at', async () => {
  const row = { id: 'evt_x', received_at: '2026-11-03T11:00:00.000Z', processed_at: null as string | null }
  await markStripeEventProcessed(db, 'evt_x', stripeEventsFetch(row).f, Date.parse('2026-11-03T12:00:00Z'))
  assert.equal(row.processed_at, '2026-11-03T12:00:00.000Z')
})

test('db errors expose the HTTP status and the Postgres code', async () => {
  const f = (async () => Response.json({ code: '23505', message: 'duplicate key' }, { status: 409 })) as unknown as typeof fetch
  await assert.rejects(
    () => incrementUsage(db, USER, '2026-11', 1, f),
    (err: unknown) => err instanceof DbError && err.status === 409 && err.code === '23505',
  )
})

test('db helpers surface HTTP failures', async () => {
  const f = (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch
  await assert.rejects(() => incrementUsage(db, USER, '2026-11', 1, f), /500/)
})
