import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { after, afterEach, before, beforeEach, mock, test } from 'node:test'
import { createFakeBackend } from './fakeBackend.ts'
import { fakeGeminiFetch } from './fakeGemini.ts'
import { jwksOf, makeEs256Key, signAsymmetric } from './jwtKeys.ts'

// Events go to a throw-away file. Must be set before telemetry.ts loads.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'midflow-backend-'))
const eventsFile = path.join(tmpDir, 'events.jsonl')
process.env.EVENTS_FILE = eventsFile

const BACKEND_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_PRO_ANNUAL',
  'ANON_AI',
]
for (const n of BACKEND_ENV) delete process.env[n]

const { config } = await import('../config.ts')
const { setRateLimitStore } = await import('../http.ts')
const { handleApiRequest } = await import('../routes.ts')
const { clearJwksCache, signHs256Jwt } = await import('../auth.ts')
const { signStripePayload } = await import('../billing.ts')
const { clearStaffCache } = await import('../authz.ts')
const { resetAiPrune } = await import('../aihealth.ts')

const JWT_SECRET = 'test-jwt-secret-value'
const WHSEC = 'whsec_test_route'
const ADMIN_TOKEN = 'test-admin-token-value-123'
const ids = {
  admin: '11111111-1111-4111-8111-111111111111',
  editor: '22222222-2222-4222-8222-222222222222',
  customer: '33333333-3333-4333-8333-333333333333',
  other: '44444444-4444-4444-8444-444444444444',
  newbie: '55555555-5555-4555-8555-555555555555',
}

const be = createFakeBackend()
const realFetch = globalThis.fetch
const real = {
  adminToken: config.adminToken,
  provider: config.ai.provider,
  geminiKey: config.ai.geminiKey,
  requireLlm: config.ai.requireLlm,
  maxRetries: config.ai.maxRetries,
  fallbackModels: config.ai.fallbackModels,
  limits: { ...config.limits },
  logRequests: config.logRequests,
  isProd: config.isProd,
}

let server: http.Server
let base = ''

before(async () => {
  // Server-side fetches go to the fake Supabase / Stripe; the test client keeps the real fetch.
  globalThis.fetch = be.fetch
  server = http.createServer(async (req, res) => {
    if (!(await handleApiRequest(req, res))) res.writeHead(404).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(async () => {
  globalThis.fetch = realFetch
  await new Promise((resolve) => server.close(resolve))
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(() => {
  setRateLimitStore()
  clearStaffCache()
  resetAiPrune()
  be.reset()
  config.logRequests = false
  config.isProd = false
  config.adminToken = ADMIN_TOKEN
  config.ai.provider = 'none'
  config.ai.maxRetries = 0
  config.ai.fallbackModels = []
  for (const n of BACKEND_ENV) delete process.env[n]
})

afterEach(() => {
  config.adminToken = real.adminToken
  config.ai.provider = real.provider
  config.ai.geminiKey = real.geminiKey
  config.ai.requireLlm = real.requireLlm
  config.ai.maxRetries = real.maxRetries
  config.ai.fallbackModels = real.fallbackModels
  Object.assign(config.limits, real.limits)
  config.logRequests = real.logRequests
  config.isProd = real.isProd
})

function enableSupabase() {
  process.env.SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET
}

function enableStripe() {
  process.env.STRIPE_SECRET_KEY = 'sk_test_route'
  process.env.STRIPE_WEBHOOK_SECRET = WHSEC
  process.env.STRIPE_PRICE_PRO = 'price_pro_m'
  process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_y'
}

const tokenFor = (sub: string, email = `${sub.slice(0, 4)}@example.com`, exp = Math.floor(Date.now() / 1000) + 3600) =>
  signHs256Jwt({ sub, email, aud: 'authenticated', role: 'authenticated', iss: 'https://fake.supabase.co/auth/v1', exp }, JWT_SECRET)

async function call(method: string, route: string, opts: { body?: unknown; token?: string; raw?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  let body: string | undefined
  if (opts.raw !== undefined) body = opts.raw
  else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body)
    headers['Content-Type'] = 'application/json'
  }
  const res = await realFetch(`${base}${route}`, { method, headers, body })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // not JSON
  }
  return { status: res.status, json }
}

const generateBody = {
  params: { brandName: 'Studio Teste', segment: 'beleza', city: 'São Paulo', about: 'Salão de beleza com foco em cabelo.', topics: 'hidratação, corte' },
  version: 1,
}

const output = { kind: 'post', title: 'Hidratação profunda', caption: 'Legenda de teste', hashtags: ['#beleza'] }
const reviewBody = { brandName: 'Studio Teste', segment: 'beleza', engine: 'template', aiErrorKind: 'transient', comment: 'Não gostei do tom.', briefing: { about: 'Salão', tones: ['leve'] }, outputs: [output] }

function seedStaff() {
  be.tables.staff_members.push({ user_id: ids.admin, role: 'admin', created_at: '2026-01-01T00:00:00Z' }, { user_id: ids.editor, role: 'editor', created_at: '2026-01-02T00:00:00Z' })
  be.addUser({ id: ids.admin, email: 'admin@example.com', name: 'Ana Admin' })
  be.addUser({ id: ids.editor, email: 'editor@example.com', name: 'Edu Editor' })
  be.addUser({ id: ids.customer, email: 'cliente@example.com', name: 'Cris Cliente' })
  be.addUser({ id: ids.newbie, email: 'novo@example.com', name: 'Nando Novo' })
}

function seedReview(over: Record<string, unknown> = {}) {
  const row = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    created_at: '2026-11-01T10:00:00.000Z',
    updated_at: '2026-11-01T10:00:00.000Z',
    user_id: ids.customer,
    status: 'pending',
    brand_name: 'Studio Teste',
    segment: 'beleza',
    engine: 'template',
    ai_error_kind: 'transient',
    comment: 'Não gostei',
    contact_email: 'cliente@example.com',
    payload: { briefing: { about: 'x' }, outputs: [output] },
    admin_note: 'nota interna',
    assigned_to: null,
    revised_outputs: null,
    resolved_at: null,
    ...over,
  }
  be.tables.review_requests.push(row)
  return row
}

const REVIEW_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

test('checkout: 503 in pt-BR when billing is not configured', async () => {
  const r = await call('POST', '/api/billing/checkout', { body: { plan: 'pro' }, token: await tokenFor(ids.customer) })
  assert.equal(r.status, 503)
  assert.match(r.json.error, /indisponíveis/)
})

test('checkout: requires a valid Bearer token, a known plan, then returns the Stripe url', async () => {
  enableSupabase()
  enableStripe()
  assert.equal((await call('POST', '/api/billing/checkout', { body: { plan: 'pro' } })).status, 401)
  assert.equal((await call('POST', '/api/billing/checkout', { body: { plan: 'pro' }, token: 'not.a.jwt' })).status, 401)
  const token = await tokenFor(ids.customer)
  assert.equal((await call('POST', '/api/billing/checkout', { body: { plan: 'enterprise' }, token })).status, 400)

  const ok = await call('POST', '/api/billing/checkout', { body: { plan: 'pro', interval: 'year' }, token })
  assert.equal(ok.status, 200)
  assert.equal(ok.json.url, 'https://checkout.stripe.com/c/pay/cs_test_1')
  const sent = be.stripeRequests[0]
  const form = new URLSearchParams(sent.body)
  assert.equal(form.get('line_items[0][price]'), 'price_pro_y')
  assert.equal(form.get('client_reference_id'), ids.customer)
  assert.equal(sent.headers.Authorization, 'Bearer sk_test_route')
})

function webhookEvent(id: string, userId = ids.customer) {
  return JSON.stringify({
    id,
    type: 'checkout.session.completed',
    created: 1,
    data: { object: { mode: 'subscription', client_reference_id: userId, metadata: { user_id: userId, plan: 'pro' }, payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1', note: 'João da Padaria' } },
  })
}

test('webhook: 503 when billing is not configured', async () => {
  const r = await call('POST', '/api/billing/webhook', { raw: '{}' })
  assert.equal(r.status, 503)
})

test('webhook: a valid signature over the exact raw bytes updates the subscription; a replay is ignored', async () => {
  enableSupabase()
  enableStripe()
  const raw = webhookEvent('evt_1') // contains multi-byte characters: the signature covers the exact bytes
  const sig = await signStripePayload(raw, WHSEC, Math.floor(Date.now() / 1000))

  const first = await call('POST', '/api/billing/webhook', { raw, headers: { 'Stripe-Signature': sig, 'Content-Type': 'application/json' } })
  assert.equal(first.status, 200)
  assert.deepEqual(first.json, { received: true })
  assert.equal(be.tables.subscriptions.length, 1)
  assert.equal(be.tables.subscriptions[0].plan, 'pro')
  assert.equal(be.tables.subscriptions[0].status, 'active')

  be.tables.subscriptions[0].plan = 'start' // proves the replay does not touch the row again
  const replay = await call('POST', '/api/billing/webhook', { raw, headers: { 'Stripe-Signature': sig } })
  assert.equal(replay.status, 200)
  assert.equal(replay.json.duplicate, true)
  assert.equal(be.tables.subscriptions[0].plan, 'start')
})

test('webhook: missing, forged, stale and tampered signatures are rejected with 400', async () => {
  enableSupabase()
  enableStripe()
  const raw = webhookEvent('evt_2')
  const now = Math.floor(Date.now() / 1000)
  const good = await signStripePayload(raw, WHSEC, now)

  assert.equal((await call('POST', '/api/billing/webhook', { raw })).status, 400)
  const forged = await signStripePayload(raw, 'whsec_other', now)
  assert.equal((await call('POST', '/api/billing/webhook', { raw, headers: { 'Stripe-Signature': forged } })).status, 400)
  const stale = await signStripePayload(raw, WHSEC, now - 3600)
  assert.equal((await call('POST', '/api/billing/webhook', { raw, headers: { 'Stripe-Signature': stale } })).status, 400)
  assert.equal((await call('POST', '/api/billing/webhook', { raw: raw.replace('pro', 'business'), headers: { 'Stripe-Signature': good } })).status, 400)
  assert.equal(be.tables.subscriptions.length, 0)
  assert.equal(be.tables.stripe_events.length, 0)
})

test('webhook: the raw body is capped at 256 KB', async () => {
  enableSupabase()
  enableStripe()
  const big = JSON.stringify({ pad: 'x'.repeat(300 * 1024) })
  const r = await call('POST', '/api/billing/webhook', { raw: big, headers: { 'Stripe-Signature': 't=1,v1=00' } })
  assert.equal(r.status, 413)
})

test('webhook: a failure while processing releases the event so Stripe can retry', async () => {
  enableSupabase()
  enableStripe()
  const raw = webhookEvent('evt_3')
  const sig = await signStripePayload(raw, WHSEC, Math.floor(Date.now() / 1000))
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).includes('/rest/v1/rpc/apply_subscription_event')) return new Response('boom', { status: 500 })
    return orig(input, init)
  }) as typeof fetch
  try {
    const r = await call('POST', '/api/billing/webhook', { raw, headers: { 'Stripe-Signature': sig } })
    assert.equal(r.status, 500)
  } finally {
    globalThis.fetch = orig
  }
  assert.equal(be.tables.stripe_events.length, 0)
})

/* ------------------------------------------------------------------ */
/* Optional auth, quota and the AI failure contract                    */
/* ------------------------------------------------------------------ */

test('generate: anonymous callers keep working and never touch the database', async () => {
  enableSupabase()
  const r = await call('POST', '/api/generate', { body: generateBody })
  assert.equal(r.status, 200)
  assert.equal(r.json.generation.posts.length, 4)
  assert.equal(r.json.usage, undefined)
  assert.ok(!be.calls.some((c) => c.includes('fake.supabase.co/rest/v1/usage_counters') || c.includes('subscriptions')))
})

test('generate / rewrite: an invalid or expired Bearer token is a 401', async () => {
  enableSupabase()
  const expired = await tokenFor(ids.customer, 'a@b.co', Math.floor(Date.now() / 1000) - 3600)
  for (const token of ['garbage.token.value', expired]) {
    assert.equal((await call('POST', '/api/generate', { body: generateBody, token })).status, 401)
    assert.equal((await call('POST', '/api/rewrite', { body: { creative: { headline: 'x' } }, token })).status, 401)
  }
})

test('generate: over the plan allowance answers 402 quota_exceeded without calling the AI', async () => {
  enableSupabase()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'start', status: 'active' }) // paid Start: 20/month (no row = free plan, see quota-free.test.ts)
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  be.tables.usage_counters.push({ user_id: ids.customer, period: new Date().toISOString().slice(0, 7), used: 18 }) // start plan = 20; a full run costs 5
  const r = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.equal(r.status, 402)
  assert.equal(r.json.code, 'quota_exceeded')
  assert.equal(r.json.limit, 20)
  assert.equal(r.json.used, 18)
  assert.match(r.json.error, /plano Start/)
  assert.ok(!be.calls.some((c) => c.includes('googleapis')))
  // Rewrites need at least one unit left; with 18/20 they still work.
  assert.equal((await call('POST', '/api/rewrite', { body: { creative: { headline: 'x' } }, token: await tokenFor(ids.customer) })).status, 200)
})

test('generate: an AI-delivered result is counted against the account and reported back', async () => {
  enableSupabase()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'start', status: 'active' }) // paid Start: 20/month (no row = free plan, see quota-free.test.ts)
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  globalThis.fetch = fakeGeminiFetch(be.fetch, generateBody.params)
  try {
    const r = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
    assert.equal(r.status, 200)
    assert.equal(r.json.generation.engine, 'gemini')
    assert.deepEqual(r.json.usage, { plan: 'start', used: 5, limit: 20 })
    assert.equal(be.tables.usage_counters[0].used, 5)
    // A paid plan raises the limit.
    be.tables.subscriptions.push({ user_id: ids.other, plan: 'pro', status: 'active' })
    const pro = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.other) })
    assert.deepEqual(pro.json.usage, { plan: 'pro', used: 5, limit: 60 })
  } finally {
    globalThis.fetch = be.fetch
  }
})

test('generate: a template result is never charged, whatever the reason (not configured, daily cap, transient)', async () => {
  enableSupabase()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'start', status: 'active' }) // paid Start: 20/month (no row = free plan, see quota-free.test.ts)
  const token = await tokenFor(ids.customer)
  const sum = () => be.tables.usage_counters.reduce((n, row) => n + row.used, 0)

  // AI not configured → kind config
  const none = await call('POST', '/api/generate', { body: generateBody, token })
  assert.equal(none.json.generation.engine, 'template')
  assert.equal(none.json.aiErrorKind, 'config')
  assert.equal(sum(), 0)
  assert.deepEqual(none.json.usage, { plan: 'start', used: 0, limit: 20 })

  // global daily cap reached → kind daily_cap
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  config.limits.dailyMaxText = 0
  const capped = await call('POST', '/api/generate', { body: generateBody, token })
  assert.equal(capped.json.aiErrorKind, 'daily_cap')
  assert.equal(sum(), 0)

  // provider failing → kind transient
  config.limits.dailyMaxText = Infinity
  const failing = await call('POST', '/api/generate', { body: generateBody, token })
  assert.equal(failing.json.aiErrorKind, 'transient')
  assert.equal(sum(), 0)
})

test('generate: without Supabase a signed-in token is verified only when a secret exists, and no quota is applied', async () => {
  const r = await call('POST', '/api/generate', { body: generateBody, token: 'anything.at.all' })
  assert.equal(r.status, 200)
})

test('AI failure contract: template result with aiErrorKind and retryable instead of a 503', async () => {
  config.ai.requireLlm = true // deprecated: must not block anymore

  // config: no AI key at all
  const noKey = await call('POST', '/api/generate', { body: generateBody })
  assert.equal(noKey.status, 200)
  assert.equal(noKey.json.generation.engine, 'template')
  assert.equal(noKey.json.aiErrorKind, 'config')
  assert.equal(noKey.json.retryable, false)

  // daily_cap
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  config.limits.dailyMaxText = 0
  const capped = await call('POST', '/api/generate', { body: generateBody })
  assert.equal(capped.status, 200)
  assert.equal(capped.json.generation.engine, 'template')
  assert.equal(capped.json.aiErrorKind, 'daily_cap')
  assert.equal(capped.json.retryable, false)
  config.limits.dailyMaxText = Infinity

  // transient: provider overloaded (503)
  const transient = await call('POST', '/api/generate', { body: generateBody })
  assert.equal(transient.status, 200)
  assert.equal(transient.json.generation.engine, 'template')
  assert.equal(transient.json.aiErrorKind, 'transient')
  assert.equal(transient.json.retryable, true)
})

test('AI failure contract: provider rate limit is transient, invalid key is config', async () => {
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  const orig = globalThis.fetch
  const answer = (status: number) => {
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      String(input).includes('generativelanguage') ? new Response('{}', { status }) : orig(input, init)) as typeof fetch
  }
  try {
    answer(429)
    const limited = await call('POST', '/api/generate', { body: generateBody })
    assert.equal(limited.json.aiErrorKind, 'transient')
    assert.equal(limited.json.retryable, true)
    answer(403)
    const badKey = await call('POST', '/api/generate', { body: generateBody })
    assert.equal(badKey.json.aiErrorKind, 'config')
    assert.equal(badKey.json.retryable, false)
  } finally {
    globalThis.fetch = orig
  }
})

test('AI failure contract: a transient failure is not charged to the account (the client retries)', async () => {
  enableSupabase()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'start', status: 'active' }) // paid Start: 20/month (no row = free plan, see quota-free.test.ts)
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  const r = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.equal(r.json.aiErrorKind, 'transient')
  assert.equal(r.json.retryable, true)
  assert.equal(be.tables.usage_counters.reduce((n, row) => n + row.used, 0), 0) // reserved up front, then refunded in full
  assert.deepEqual(r.json.usage, { plan: 'start', used: 0, limit: 20 })
})

test('rewrite: failures carry aiErrorKind and retryable; success carries null / false', async () => {
  const body = { creative: { headline: 'Hidratação profunda', cta: 'Agendar', caption: 'Legenda' }, mode: 'curto', brandName: 'Studio Teste', segment: 'beleza' }
  const none = await call('POST', '/api/rewrite', { body })
  assert.equal(none.status, 200)
  assert.equal(none.json.engine, 'template')
  assert.equal(none.json.aiErrorKind, 'config')
  assert.equal(none.json.retryable, false)

  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (!String(input).includes('generativelanguage')) return orig(input, init)
    const text = JSON.stringify({ headline: 'Hidratação que transforma', highlight: 'transforma', sub: 's', cta: 'Agendar', caption: 'Legenda' })
    return Response.json({ candidates: [{ content: { parts: [{ text }] } }] })
  }) as typeof fetch
  try {
    const ok = await call('POST', '/api/rewrite', { body })
    assert.equal(ok.json.engine, 'gemini')
    assert.equal(ok.json.aiErrorKind, null)
    assert.equal(ok.json.retryable, false)
  } finally {
    globalThis.fetch = orig
  }
  const transient = await call('POST', '/api/rewrite', { body })
  assert.equal(transient.json.engine, 'template')
  assert.equal(transient.json.aiErrorKind, 'transient')
  assert.equal(transient.json.retryable, true)
})

test('metrics count ai_unavailable events by kind', async () => {
  await call('POST', '/api/generate', { body: generateBody }) // config
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  await call('POST', '/api/generate', { body: generateBody }) // transient
  const m = await call('GET', '/api/admin/metrics', { token: ADMIN_TOKEN })
  assert.equal(m.status, 200)
  assert.equal(m.json.aiUnavailable.config >= 1, true)
  assert.equal(m.json.aiUnavailable.transient >= 1, true)
  assert.equal(m.json.aiUnavailable.total, m.json.aiUnavailable.config + m.json.aiUnavailable.transient + m.json.aiUnavailable.daily_cap)
})

/* ------------------------------------------------------------------ */
/* Review requests                                                     */
/* ------------------------------------------------------------------ */

test('review: validation rejects bad input with 400 in pt-BR', async () => {
  enableSupabase()
  const cases: [string, unknown][] = [
    ['no brand', { ...reviewBody, brandName: '' }],
    ['comment too long', { ...reviewBody, comment: 'x'.repeat(1001) }],
    ['bad e-mail', { ...reviewBody, contactEmail: 'not-an-email' }],
    ['bad aiErrorKind', { ...reviewBody, aiErrorKind: 'boom' }],
    ['no briefing', { ...reviewBody, briefing: undefined }],
    ['briefing too big', { ...reviewBody, briefing: { about: 'x'.repeat(9000) } }],
    ['too many outputs', { ...reviewBody, outputs: Array.from({ length: 9 }, () => output) }],
    ['bad output kind', { ...reviewBody, outputs: [{ ...output, kind: 'reel' }] }],
    ['caption too long', { ...reviewBody, outputs: [{ ...output, caption: 'x'.repeat(2201) }] }],
    ['too many hashtags', { ...reviewBody, outputs: [{ ...output, hashtags: Array.from({ length: 16 }, () => '#a') }] }],
  ]
  for (const [name, body] of cases) {
    const r = await call('POST', '/api/review', { body })
    assert.equal(r.status, 400, name)
    assert.equal(typeof r.json.error, 'string', name)
  }
  assert.equal(be.tables.review_requests.length, 0)
})

test('review: stored in Supabase with the account id, sanitized; anonymous allowed; invalid token 401', async () => {
  enableSupabase()
  const anon = await call('POST', '/api/review', { body: { ...reviewBody, contactEmail: 'Cliente@Exemplo.com', comment: 'Oi\u0000 tudo bem' } })
  assert.equal(anon.status, 201)
  assert.match(anon.json.id, /^[0-9a-f-]{36}$/)
  const row = be.tables.review_requests[0]
  assert.equal(row.id, anon.json.id)
  assert.equal(row.user_id, null)
  assert.equal(row.contact_email, 'cliente@exemplo.com')
  assert.equal(row.comment, 'Oi tudo bem')
  assert.deepEqual(row.payload.outputs, [output])

  const authed = await call('POST', '/api/review', { body: reviewBody, token: await tokenFor(ids.customer) })
  assert.equal(authed.status, 201)
  assert.equal(be.tables.review_requests[1].user_id, ids.customer)

  assert.equal((await call('POST', '/api/review', { body: reviewBody, token: 'bad.token.here' })).status, 401)
})

test('review: without Supabase it is appended to the event log', async () => {
  const r = await call('POST', '/api/review', { body: reviewBody })
  assert.equal(r.status, 201)
  const events = fs.readFileSync(eventsFile, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const ev = events.find((e) => e.type === 'review_request' && e.reviewId === r.json.id)
  assert.ok(ev)
  assert.equal(ev.brandName, 'Studio Teste')
  const list = await call('GET', '/api/admin/reviews', { token: ADMIN_TOKEN })
  assert.equal(list.json.storage, 'events')
  assert.ok(list.json.items.some((i: any) => i.id === r.json.id && i.status === 'pending'))
})

test('review: 10 requests per hour per IP', async () => {
  enableSupabase()
  for (let i = 0; i < 10; i++) assert.equal((await call('POST', '/api/review', { body: reviewBody })).status, 201)
  assert.equal((await call('POST', '/api/review', { body: reviewBody })).status, 429)
})

test('reviews/mine: a customer sees only their own requests and no internal fields', async () => {
  enableSupabase()
  seedReview()
  seedReview({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_id: ids.other, brand_name: 'Outra Marca' })
  assert.equal((await call('GET', '/api/reviews/mine')).status, 401)
  const mine = await call('GET', '/api/reviews/mine', { token: await tokenFor(ids.customer) })
  assert.equal(mine.status, 200)
  assert.equal(mine.json.items.length, 1)
  assert.equal(mine.json.items[0].brandName, 'Studio Teste')
  assert.ok(!('adminNote' in mine.json.items[0]))
  assert.ok(!('contactEmail' in mine.json.items[0]))
})

/* ------------------------------------------------------------------ */
/* RBAC                                                                */
/* ------------------------------------------------------------------ */

type Who = 'anonymous' | 'customer' | 'editor' | 'admin' | 'token'

async function tokenOf(who: Who): Promise<string | undefined> {
  if (who === 'anonymous') return undefined
  if (who === 'token') return ADMIN_TOKEN
  return tokenFor(ids[who])
}

const MATRIX: { name: string; method: string; path: string; body?: unknown; expect: Record<Who, number> }[] = [
  { name: 'me', method: 'GET', path: '/api/admin/me', expect: { anonymous: 401, customer: 403, editor: 200, admin: 200, token: 200 } },
  { name: 'metrics', method: 'GET', path: '/api/admin/metrics', expect: { anonymous: 401, customer: 403, editor: 403, admin: 200, token: 200 } },
  { name: 'ai-health', method: 'GET', path: '/api/admin/ai-health?range=7d', expect: { anonymous: 401, customer: 403, editor: 403, admin: 200, token: 200 } },
  { name: 'list reviews', method: 'GET', path: '/api/admin/reviews', expect: { anonymous: 401, customer: 403, editor: 200, admin: 200, token: 200 } },
  { name: 'get review', method: 'GET', path: `/api/admin/reviews/${REVIEW_ID}`, expect: { anonymous: 401, customer: 403, editor: 200, admin: 200, token: 200 } },
  { name: 'patch review', method: 'PATCH', path: `/api/admin/reviews/${REVIEW_ID}`, body: { status: 'in_progress' }, expect: { anonymous: 401, customer: 403, editor: 200, admin: 200, token: 200 } },
  { name: 'revision', method: 'POST', path: `/api/admin/reviews/${REVIEW_ID}/revision`, body: { outputs: [output] }, expect: { anonymous: 401, customer: 403, editor: 200, admin: 200, token: 200 } },
  { name: 'list staff', method: 'GET', path: '/api/admin/staff', expect: { anonymous: 401, customer: 403, editor: 403, admin: 200, token: 200 } },
  { name: 'add staff', method: 'POST', path: '/api/admin/staff', body: { email: 'novo@example.com', role: 'editor' }, expect: { anonymous: 401, customer: 403, editor: 403, admin: 200, token: 200 } },
  { name: 'remove staff (unknown id: authorized callers reach 404)', method: 'DELETE', path: `/api/admin/staff/${ids.other}`, expect: { anonymous: 401, customer: 403, editor: 403, admin: 404, token: 404 } },
]

for (const row of MATRIX) {
  test(`RBAC matrix: ${row.name}`, async () => {
    enableSupabase()
    for (const who of Object.keys(row.expect) as Who[]) {
      be.reset()
      clearStaffCache()
      seedStaff()
      seedReview()
      const r = await call(row.method, row.path, { body: row.body, token: await tokenOf(who) })
      assert.equal(r.status, row.expect[who], `${row.name} as ${who}`)
    }
  })
}

test('RBAC matrix: an invalid token is 401 and a forged staff claim gains nothing', async () => {
  enableSupabase()
  seedStaff()
  assert.equal((await call('GET', '/api/admin/me', { token: 'a.b.c' })).status, 401)
  const forged = await signHs256Jwt({ sub: ids.admin, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }, 'wrong-secret')
  assert.equal((await call('GET', '/api/admin/me', { token: forged })).status, 401)
  assert.equal((await call('GET', '/api/admin/me', { token: 'wrong-admin-token' })).status, 401)
})

test('RBAC: test-ai is admin only in production and limited to 5 per hour', async () => {
  enableSupabase()
  seedStaff()
  config.isProd = true
  assert.equal((await call('POST', '/api/test-ai', { token: await tokenFor(ids.editor) })).status, 403)
  assert.equal((await call('POST', '/api/test-ai')).status, 401)
  for (let i = 0; i < 5; i++) {
    const r = await call('POST', '/api/test-ai', { token: await tokenFor(ids.admin) })
    assert.equal(r.status, 200)
    assert.equal(r.json.ok, false) // no AI key configured in the test
  }
  assert.equal((await call('POST', '/api/test-ai', { token: ADMIN_TOKEN })).status, 429)
})

test('RBAC: /api/admin/me reports role, user id and how the caller authenticated', async () => {
  enableSupabase()
  seedStaff()
  assert.deepEqual((await call('GET', '/api/admin/me', { token: ADMIN_TOKEN })).json, { role: 'admin', userId: null, via: 'token' })
  assert.deepEqual((await call('GET', '/api/admin/me', { token: await tokenFor(ids.editor) })).json, { role: 'editor', userId: ids.editor, via: 'session' })
})

test('RBAC: the staff role lookup is cached per user', async () => {
  enableSupabase()
  seedStaff()
  const token = await tokenFor(ids.editor)
  await call('GET', '/api/admin/me', { token })
  await call('GET', '/api/admin/me', { token })
  assert.equal(be.calls.filter((c) => c.includes('/rest/v1/staff_members')).length, 1)
})

test('RBAC: without Supabase only the admin token works; staff and write routes answer 501', async () => {
  const session = await signHs256Jwt({ sub: ids.admin, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET)
  assert.equal((await call('GET', '/api/admin/me', { token: session })).status, 401)
  assert.equal((await call('GET', '/api/admin/me', { token: ADMIN_TOKEN })).status, 200)
  assert.equal((await call('GET', '/api/admin/staff', { token: ADMIN_TOKEN })).status, 501)
  assert.match((await call('POST', '/api/admin/staff', { token: ADMIN_TOKEN, body: { email: 'a@b.co', role: 'editor' } })).json.error, /banco de dados/)
  assert.equal((await call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token: ADMIN_TOKEN, body: { status: 'resolved' } })).status, 501)
})

test('RBAC: admin routes do not exist while no staff access is configured', async () => {
  config.adminToken = ''
  assert.equal((await call('GET', '/api/admin/me', { token: 'whatever' })).status, 404)
})

test('staff management: unknown e-mail is a pt-BR 404, bad input is 400, success is visible in the list', async () => {
  enableSupabase()
  seedStaff()
  const token = await tokenFor(ids.admin)
  assert.equal((await call('POST', '/api/admin/staff', { token, body: { email: 'nao-existe@example.com', role: 'editor' } })).status, 404)
  assert.equal((await call('POST', '/api/admin/staff', { token, body: { email: 'nope', role: 'editor' } })).status, 400)
  assert.equal((await call('POST', '/api/admin/staff', { token, body: { email: 'novo@example.com', role: 'owner' } })).status, 400)

  const added = await call('POST', '/api/admin/staff', { token, body: { email: 'Novo@Example.com', role: 'editor' } })
  assert.equal(added.status, 200)
  assert.equal(added.json.staff.userId, ids.newbie)
  const list = await call('GET', '/api/admin/staff', { token })
  assert.deepEqual(list.json.items.map((i: any) => [i.email, i.role]).sort(), [['admin@example.com', 'admin'], ['editor@example.com', 'editor'], ['novo@example.com', 'editor']])
  assert.equal(be.tables.staff_members.find((r) => r.user_id === ids.newbie)?.created_by, ids.admin)
})

test('staff management: the last admin cannot be removed or demoted', async () => {
  enableSupabase()
  seedStaff()
  const token = await tokenFor(ids.admin)
  const del = await call('DELETE', `/api/admin/staff/${ids.admin}`, { token })
  assert.equal(del.status, 409)
  assert.match(del.json.error, /último administrador/)
  const demote = await call('POST', '/api/admin/staff', { token, body: { email: 'admin@example.com', role: 'editor' } })
  assert.equal(demote.status, 409)
  assert.equal(be.tables.staff_members.find((r) => r.user_id === ids.admin)?.role, 'admin')

  // With a second admin the first can go; the removal takes effect immediately (cache cleared).
  await call('POST', '/api/admin/staff', { token, body: { email: 'novo@example.com', role: 'admin' } })
  assert.equal((await call('DELETE', `/api/admin/staff/${ids.admin}`, { token: ADMIN_TOKEN })).status, 200)
  assert.equal((await call('GET', '/api/admin/me', { token })).status, 403)
  assert.equal((await call('DELETE', `/api/admin/staff/${ids.newbie}`, { token: ADMIN_TOKEN })).status, 409)
})

test('reviews: editors may assign only themselves; admins and the token may assign anyone', async () => {
  enableSupabase()
  seedStaff()
  seedReview()
  const editor = await tokenFor(ids.editor)
  const other = await call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token: editor, body: { assignedTo: ids.admin } })
  assert.equal(other.status, 403)
  const self = await call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token: editor, body: { assignedTo: ids.editor } })
  assert.equal(self.status, 200)
  assert.equal(self.json.item.assignedTo, ids.editor)
  const byAdmin = await call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token: ADMIN_TOKEN, body: { assignedTo: ids.admin } })
  assert.equal(byAdmin.status, 200)
  assert.equal(byAdmin.json.item.assignedTo, ids.admin)
  // An editor cannot release a review that belongs to someone else.
  assert.equal((await call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token: editor, body: { assignedTo: null } })).status, 403)
})

test('reviews: PATCH validates input and the list can be filtered by status', async () => {
  enableSupabase()
  seedStaff()
  seedReview()
  seedReview({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', status: 'resolved', created_at: '2026-11-02T10:00:00.000Z' })
  const token = await tokenFor(ids.editor)
  assert.equal((await call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token, body: { status: 'done' } })).status, 400)
  assert.equal((await call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token, body: {} })).status, 400)
  assert.equal((await call('PATCH', '/api/admin/reviews/dddddddd-dddd-4ddd-8ddd-dddddddddddd', { token, body: { status: 'resolved' } })).status, 404)
  assert.equal((await call('GET', '/api/admin/reviews?status=bogus', { token })).status, 400)

  const all = await call('GET', '/api/admin/reviews', { token })
  assert.equal(all.json.storage, 'supabase')
  assert.deepEqual(all.json.items.map((i: any) => i.status), ['resolved', 'pending']) // newest first
  assert.ok(!('outputs' in all.json.items[0]) && !('briefing' in all.json.items[0]))
  const pending = await call('GET', '/api/admin/reviews?status=pending', { token })
  assert.equal(pending.json.items.length, 1)
})

test('audit: status changes, assignments and notes write review_events rows with the actor', async () => {
  enableSupabase()
  seedStaff()
  seedReview()
  const editor = await tokenFor(ids.editor)
  const r = await call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token: editor, body: { status: 'in_progress', assignedTo: ids.editor, adminNote: 'Vou ajustar o tom.' } })
  assert.equal(r.status, 200)
  const events = be.tables.review_events
  assert.deepEqual(events.map((e) => e.action).sort(), ['assign', 'note', 'status'])
  const status = events.find((e) => e.action === 'status')!
  assert.equal(status.review_id, REVIEW_ID)
  assert.equal(status.actor_id, ids.editor)
  assert.equal(status.actor_label, `editor:${ids.editor}`)
  assert.equal(status.from_status, 'pending')
  assert.equal(status.to_status, 'in_progress')

  // The shared token is recorded as such, with no user id.
  await call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token: ADMIN_TOKEN, body: { status: 'pending' } })
  const last = be.tables.review_events.at(-1)!
  assert.equal(last.actor_label, 'admin-token')
  assert.equal(last.actor_id, null)

  // Unchanged values write nothing.
  const before = be.tables.review_events.length
  await call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token: ADMIN_TOKEN, body: { status: 'pending' } })
  assert.equal(be.tables.review_events.length, before)

  const detail = await call('GET', `/api/admin/reviews/${REVIEW_ID}`, { token: editor })
  assert.equal(detail.json.events.length, be.tables.review_events.length)
  assert.deepEqual(detail.json.item.outputs, [output])
})

test('audit: a revision stores the revised outputs, resolves the review and is logged', async () => {
  enableSupabase()
  seedStaff()
  seedReview({ status: 'in_progress' })
  const editor = await tokenFor(ids.editor)
  assert.equal((await call('POST', `/api/admin/reviews/${REVIEW_ID}/revision`, { token: editor, body: { outputs: [] } })).status, 400)
  assert.equal((await call('POST', `/api/admin/reviews/${REVIEW_ID}/revision`, { token: editor, body: { outputs: [{ ...output, kind: 'x' }] } })).status, 400)

  const revised = [{ ...output, caption: 'Legenda revisada' }]
  const r = await call('POST', `/api/admin/reviews/${REVIEW_ID}/revision`, { token: editor, body: { outputs: revised } })
  assert.equal(r.status, 200)
  assert.equal(r.json.item.status, 'resolved')
  assert.ok(r.json.item.resolvedAt)
  const row = be.tables.review_requests[0]
  assert.deepEqual(row.revised_outputs, revised)
  assert.equal(row.status, 'resolved')
  assert.ok(row.resolved_at)
  const ev = be.tables.review_events.find((e) => e.action === 'revision')!
  assert.equal(ev.actor_label, `editor:${ids.editor}`)
  assert.equal(ev.from_status, 'in_progress')
  assert.equal(ev.to_status, 'resolved')

  // The customer now sees the revised creatives, and no internal note.
  const mine = await call('GET', '/api/reviews/mine', { token: await tokenFor(ids.customer) })
  assert.deepEqual(mine.json.items[0].revisedOutputs, revised)
  assert.equal(mine.json.items[0].status, 'resolved')
})

/* ------------------------------------------------------------------ */
/* AI health                                                           */
/* ------------------------------------------------------------------ */

test('ai-health: each attempt is recorded in ai_events and aggregated for admins only', async () => {
  enableSupabase()
  process.env.ANON_AI = 'open' // anonymous callers get the AI only when allowed explicitly
  seedStaff()
  await call('POST', '/api/generate', { body: generateBody }) // config
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  await call('POST', '/api/generate', { body: generateBody }) // transient
  await call('POST', '/api/rewrite', { body: { creative: { headline: 'x' } } }) // transient
  await sleep(50)
  assert.equal(be.tables.ai_events.length, 3)

  const health = await call('GET', '/api/admin/ai-health?range=24h', { token: await tokenFor(ids.admin) })
  assert.equal(health.status, 200)
  assert.equal(health.json.range, '24h')
  assert.equal(health.json.storage, 'supabase')
  assert.equal(health.json.totals.calls, 3)
  assert.equal(health.json.totals.ok, 0)
  assert.deepEqual(health.json.totals.fallbackByKind, { transient: 2, daily_cap: 0, config: 1 })
  assert.equal(health.json.totals.successRate, 0)
  assert.equal(health.json.series.length, 24)
  assert.equal(health.json.lastError.route === 'rewrite' || health.json.lastError.route === 'generate', true)
  assert.deepEqual(health.json.providers.find((p: any) => p.name === 'gemini'), { name: 'gemini', configured: true, model: config.ai.model })

  assert.equal((await call('GET', '/api/admin/ai-health', { token: await tokenFor(ids.editor) })).status, 403)
})

test('ai-health: ai_events never contain prompts, briefing text, keys or provider messages', async () => {
  enableSupabase()
  process.env.ANON_AI = 'open' // the anonymous rewrite below must reach the (failing) provider
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'AIza-super-secret-key-9999'
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    String(input).includes('generativelanguage') ? new Response('Echo: SEGREDO-DO-CLIENTE AIza-super-secret-key-9999', { status: 500 }) : orig(input, init)) as typeof fetch
  try {
    const secretBody = { params: { ...generateBody.params, about: 'SEGREDO-DO-CLIENTE vende bolo', brandName: 'Marca SEGREDO-DO-CLIENTE' }, version: 1 }
    await call('POST', '/api/generate', { body: secretBody, token: await tokenFor(ids.customer) })
    await call('POST', '/api/rewrite', { body: { creative: { headline: 'SEGREDO-DO-CLIENTE', caption: 'SEGREDO-DO-CLIENTE' }, brandName: 'SEGREDO-DO-CLIENTE' } })
  } finally {
    globalThis.fetch = orig
  }
  await sleep(50)
  assert.ok(be.tables.ai_events.length >= 2)
  const dump = JSON.stringify(be.tables.ai_events)
  assert.ok(!dump.includes('SEGREDO'))
  assert.ok(!dump.includes('AIza'))
  assert.ok(!dump.includes('Echo'))
  const allowed = new Set(['created_at', 'route', 'provider', 'model', 'outcome', 'engine', 'latency_ms', 'quality_score', 'retries', 'error_code', 'user_id'])
  for (const row of be.tables.ai_events) for (const k of Object.keys(row)) assert.ok(allowed.has(k), k)
  // The signed-in call is attributed to the account.
  assert.ok(be.tables.ai_events.some((r) => r.user_id === ids.customer))
})

test('ai-health: without Supabase attempts go to the event log and storage is reported as events', async () => {
  await call('POST', '/api/generate', { body: generateBody })
  await sleep(50)
  const health = await call('GET', '/api/admin/ai-health', { token: ADMIN_TOKEN })
  assert.equal(health.status, 200)
  assert.equal(health.json.storage, 'events')
  assert.ok(health.json.totals.calls >= 1)
})

/* ------------------------------------------------------------------ */
/* Security hardening                                                  */
/* ------------------------------------------------------------------ */

const ISS = 'https://fake.supabase.co/auth/v1'

test('staff invite: the e-mail is resolved from the verified account, so a user who edits their profile e-mail hijacks nothing', async () => {
  enableSupabase()
  seedStaff()
  // The customer (attacker) rewrites their own profile e-mail to the invitee's address. auth.users is untouched.
  be.tables.profiles.find((p) => p.id === ids.customer)!.email = 'novo@example.com'
  const admin = await tokenFor(ids.admin)
  const r = await call('POST', '/api/admin/staff', { token: admin, body: { email: 'novo@example.com', role: 'editor' } })
  assert.equal(r.status, 200)
  assert.equal(r.json.staff.userId, ids.newbie)
  assert.ok(be.tables.staff_members.some((s) => s.user_id === ids.newbie))
  assert.ok(!be.tables.staff_members.some((s) => s.user_id === ids.customer))
  assert.ok(be.calls.some((c) => c.endsWith('/rest/v1/rpc/find_confirmed_user_by_email')))
  assert.ok(!be.calls.some((c) => c.includes('/rest/v1/profiles?')))
})

test('staff invite: unconfirmed accounts and ambiguous e-mails are a 404', async () => {
  enableSupabase()
  seedStaff()
  be.addUser({ id: '66666666-6666-4666-8666-666666666666', email: 'pendente@example.com', confirmed: false })
  const admin = await tokenFor(ids.admin)
  const unconfirmed = await call('POST', '/api/admin/staff', { token: admin, body: { email: 'pendente@example.com', role: 'editor' } })
  assert.equal(unconfirmed.status, 404)
  assert.match(unconfirmed.json.error, /confirmada/)

  be.addUser({ id: '77777777-7777-4777-8777-777777777777', email: 'novo@example.com' }) // a second match for the same address
  assert.equal((await call('POST', '/api/admin/staff', { token: admin, body: { email: 'novo@example.com', role: 'editor' } })).status, 404)
  assert.equal(be.tables.staff_members.length, 2)
})

test('staff management: roles change through the guarded database functions', async () => {
  enableSupabase()
  seedStaff()
  const admin = await tokenFor(ids.admin)
  assert.equal((await call('POST', '/api/admin/staff', { token: admin, body: { email: 'novo@example.com', role: 'editor' } })).status, 200)
  assert.equal((await call('DELETE', `/api/admin/staff/${ids.newbie}`, { token: admin })).status, 200)
  assert.equal((await call('DELETE', `/api/admin/staff/${ids.newbie}`, { token: admin })).status, 404)
  assert.ok(be.calls.some((c) => c.endsWith('/rest/v1/rpc/set_staff_role_guarded')))
  assert.ok(be.calls.some((c) => c.endsWith('/rest/v1/rpc/remove_staff_guarded')))
})

test('ES256 sessions: verified against the project JWKS, with no JWT secret configured', async () => {
  process.env.SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'
  config.adminToken = '' // staff access must come from SUPABASE_URL + the database alone
  clearJwksCache()
  seedStaff()
  const key = await makeEs256Key('route-key')
  be.jwks = jwksOf(key)
  const exp = Math.floor(Date.now() / 1000) + 3600
  const session = (sub: string, over: Record<string, unknown> = {}) =>
    signAsymmetric(key, { sub, aud: 'authenticated', role: 'authenticated', iss: ISS, email: 'x@example.com', exp, ...over })

  assert.deepEqual((await call('GET', '/api/admin/me', { token: await session(ids.admin) })).json, { role: 'admin', userId: ids.admin, via: 'session' })
  assert.equal((await call('GET', '/api/admin/me', { token: await session(ids.customer) })).status, 403)
  assert.equal((await call('GET', '/api/admin/me', { token: await session(ids.admin, { role: 'anon' }) })).status, 401)
  assert.equal((await call('GET', '/api/admin/me', { token: await session(ids.admin, { iss: 'https://evil.supabase.co/auth/v1' }) })).status, 401)

  const other = await makeEs256Key('route-key') // same kid, attacker's key
  assert.equal((await call('GET', '/api/admin/me', { token: await signAsymmetric(other, { sub: ids.admin, aud: 'authenticated', role: 'authenticated', iss: ISS, exp }) })).status, 401)
  assert.equal((await call('GET', '/api/admin/me', {})).status, 401)
})

test('ES256 sessions work for the customer routes too (billing checkout, account deletion path)', async () => {
  process.env.SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'
  enableStripe()
  clearJwksCache()
  const key = await makeEs256Key('route-key')
  be.jwks = jwksOf(key)
  const token = await signAsymmetric(key, { sub: ids.customer, aud: 'authenticated', role: 'authenticated', iss: ISS, exp: Math.floor(Date.now() / 1000) + 3600 })
  assert.equal((await call('POST', '/api/billing/checkout', { body: { plan: 'pro' }, token })).status, 200)
  assert.equal((await call('POST', '/api/account/delete', { body: { confirm: 'nope' }, token })).status, 400) // authenticated, then validated
})

test('admin auth: failed Bearer attempts are rate limited per IP (20 per hour); anonymous probes and valid staff are not', async () => {
  enableSupabase()
  seedStaff()
  for (let i = 0; i < 20; i++) assert.equal((await call('GET', '/api/admin/me', { token: `guess-${i}` })).status, 401)
  assert.equal((await call('GET', '/api/admin/me', { token: 'guess-21' })).status, 429)
  // a customer token counts as a failed attempt too, and the budget is shared
  assert.equal((await call('GET', '/api/admin/me', { token: await tokenFor(ids.customer) })).status, 429)
  // credentials that work are not affected
  assert.equal((await call('GET', '/api/admin/me', { token: ADMIN_TOKEN })).status, 200)
  assert.equal((await call('GET', '/api/admin/me', { token: await tokenFor(ids.admin) })).status, 200)
})

test('admin auth: customers (403) and unknown tokens (401) consume the failure budget, anonymous requests do not', async () => {
  enableSupabase()
  seedStaff()
  const customer = await tokenFor(ids.customer)
  for (let i = 0; i < 30; i++) assert.equal((await call('GET', '/api/admin/me', {})).status, 401)
  for (let i = 0; i < 20; i++) assert.equal((await call('GET', '/api/admin/me', { token: customer })).status, 403)
  assert.equal((await call('GET', '/api/admin/me', { token: customer })).status, 429)
})

test('checkout: 409 while an entitled Stripe subscription exists; a canceled or missing one may buy', async () => {
  enableSupabase()
  enableStripe()
  const token = await tokenFor(ids.customer)
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'pro', status: 'active', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' })
  const blocked = await call('POST', '/api/billing/checkout', { body: { plan: 'business' }, token })
  assert.equal(blocked.status, 409)
  assert.equal(blocked.json.error, 'Você já tem uma assinatura ativa. Use "Gerenciar assinatura" para trocar de plano ou cancelar.')
  assert.equal(be.stripeRequests.length, 0)

  be.tables.subscriptions[0].status = 'canceled'
  assert.equal((await call('POST', '/api/billing/checkout', { body: { plan: 'pro' }, token })).status, 200)
})

async function postEvent(event: Record<string, unknown>) {
  const raw = JSON.stringify(event)
  const sig = await signStripePayload(raw, WHSEC, Math.floor(Date.now() / 1000))
  return call('POST', '/api/billing/webhook', { raw, headers: { 'Stripe-Signature': sig } })
}

const subEvent = (id: string, created: number, status: string, plan = 'pro') => ({
  id,
  type: 'customer.subscription.updated',
  created,
  data: { object: { id: 'sub_1', customer: 'cus_1', status, metadata: { user_id: ids.customer, plan }, items: { data: [{ price: { id: 'price_pro_m' } }] } } },
})

test('webhook: an older event cannot roll a subscription back; the latest created wins', async () => {
  enableSupabase()
  enableStripe()
  assert.equal((await postEvent(subEvent('evt_new', 2000, 'canceled'))).status, 200)
  assert.equal(be.tables.subscriptions[0].status, 'canceled')
  assert.equal(be.tables.subscriptions[0].last_event_at, 2000)

  // delivered late: created earlier, status active
  assert.equal((await postEvent(subEvent('evt_old', 1000, 'active'))).status, 200)
  assert.equal(be.tables.subscriptions[0].status, 'canceled')

  assert.equal((await postEvent(subEvent('evt_newer', 3000, 'active'))).status, 200)
  assert.equal(be.tables.subscriptions[0].status, 'active')
  assert.equal(be.rpcArgs.at(-1)!.args.p_event_created, 3000)
})

test('webhook: the Stripe price decides the plan, not the editable metadata', async () => {
  enableSupabase()
  enableStripe()
  assert.equal((await postEvent(subEvent('evt_meta', 10, 'active', 'business'))).status, 200)
  assert.equal(be.tables.subscriptions[0].plan, 'pro')
})

test('webhook: a processed event is marked, a fresh unfinished claim waits, a stale one is processed again', async () => {
  enableSupabase()
  enableStripe()
  assert.equal((await postEvent(subEvent('evt_done', 10, 'active'))).status, 200)
  const done = be.tables.stripe_events.find((e) => e.id === 'evt_done')!
  assert.ok(done.processed_at)

  // a redelivery of a processed event is a harmless duplicate
  assert.equal((await postEvent(subEvent('evt_done', 10, 'active'))).json.duplicate, true)

  // claimed a minute ago and never finished: still in flight elsewhere and may yet fail, so Stripe must retry (503, not 2xx)
  be.tables.stripe_events.push({ id: 'evt_fresh', received_at: new Date(Date.now() - 60_000).toISOString(), processed_at: null })
  const fresh = await postEvent(subEvent('evt_fresh', 20, 'past_due'))
  assert.equal(fresh.status, 503)
  assert.equal(fresh.json.duplicate, undefined)
  assert.equal(be.tables.subscriptions[0].status, 'active')
  assert.equal(be.tables.stripe_events.find((e) => e.id === 'evt_fresh')!.processed_at, null, 'the in-flight claim is left alone')

  // claimed 10 minutes ago and never finished: the worker died, so Stripe's retry is processed
  be.tables.stripe_events.push({ id: 'evt_stale', received_at: new Date(Date.now() - 10 * 60_000).toISOString(), processed_at: null })
  const stale = await postEvent(subEvent('evt_stale', 30, 'past_due'))
  assert.equal(stale.status, 200)
  assert.equal(stale.json.duplicate, undefined)
  assert.equal(be.tables.subscriptions[0].status, 'past_due')
  assert.ok(be.tables.stripe_events.find((e) => e.id === 'evt_stale')!.processed_at)
})

test('webhook: a unique violation on the Stripe customer id is logged and answered 200 instead of retried forever', async () => {
  enableSupabase()
  enableStripe()
  be.tables.subscriptions.push({ user_id: ids.other, plan: 'pro', status: 'active', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_other' })
  const error = mock.method(console, 'error', () => undefined)
  try {
    const r = await postEvent(subEvent('evt_dup', 10, 'active'))
    assert.equal(r.status, 200)
    assert.equal(r.json.ignored, true)
    assert.equal(error.mock.callCount(), 1)
    assert.ok(!JSON.stringify(error.mock.calls[0].arguments).includes('cus_1')) // ids of the customer stay out of the log
  } finally {
    error.mock.restore()
  }
  assert.equal(be.tables.subscriptions.length, 1)
  assert.ok(be.tables.stripe_events.find((e) => e.id === 'evt_dup')!.processed_at)
  assert.equal((await postEvent(subEvent('evt_dup', 10, 'active'))).json.duplicate, true)
})

test('reviews: an editor cannot take over, change the status of, or revise a review assigned to someone else', async () => {
  enableSupabase()
  seedStaff()
  seedReview({ assigned_to: ids.admin, status: 'in_progress' })
  const editor = await tokenFor(ids.editor)
  const patch = (body: unknown, token = editor) => call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token, body })

  const takeover = await patch({ assignedTo: ids.editor })
  assert.equal(takeover.status, 403)
  assert.equal(takeover.json.error, 'Este pedido está atribuído a outra pessoa.')
  assert.equal((await patch({ status: 'resolved' })).status, 403)
  assert.equal((await patch({ assignedTo: null })).status, 403)
  assert.equal((await call('POST', `/api/admin/reviews/${REVIEW_ID}/revision`, { token: editor, body: { outputs: [output] } })).status, 403)
  assert.equal(be.tables.review_requests[0].assigned_to, ids.admin)
  assert.equal(be.tables.review_requests[0].status, 'in_progress')
  assert.equal(be.tables.review_requests[0].revised_outputs ?? null, null)

  // admins and the shared token still can
  assert.equal((await patch({ status: 'pending' }, await tokenFor(ids.admin))).status, 200)
  assert.equal((await patch({ assignedTo: ids.editor }, ADMIN_TOKEN)).status, 200)
  // and once it is the editor's own, they work on it
  assert.equal((await patch({ status: 'resolved' })).status, 200)
  assert.equal((await call('POST', `/api/admin/reviews/${REVIEW_ID}/revision`, { token: editor, body: { outputs: [output] } })).status, 200)
})

test('reviews: an unassigned review can be picked up and worked by any editor', async () => {
  enableSupabase()
  seedStaff()
  seedReview()
  const editor = await tokenFor(ids.editor)
  assert.equal((await call('PATCH', `/api/admin/reviews/${REVIEW_ID}`, { token: editor, body: { status: 'in_progress' } })).status, 200)
})

test('review (events storage): the log keeps sizes, not the contact e-mail or the briefing', async () => {
  const r = await call('POST', '/api/review', { body: { ...reviewBody, contactEmail: 'dona@padaria.com.br', briefing: { about: 'Padaria da Dona Maria, rua das Flores 12', tones: ['leve'] } } })
  assert.equal(r.status, 201)
  const line = fs.readFileSync(eventsFile, 'utf-8').split('\n').find((l) => l.includes(r.json.id))!
  const ev = JSON.parse(line)
  assert.equal(ev.hasContact, true)
  assert.ok(ev.briefingBytes > 0)
  assert.equal(ev.contactEmail, undefined)
  assert.equal(ev.briefing, undefined)
  assert.ok(!line.includes('padaria.com.br') && !line.includes('Dona Maria'))
  const detail = await call('GET', `/api/admin/reviews/${r.json.id}`, { token: ADMIN_TOKEN })
  assert.equal(detail.json.item.contactEmail, null)
  assert.equal(detail.json.item.briefing, null)
})

test('request bodies must be JSON objects: arrays, null and scalars are a 400 "JSON inválido."', async () => {
  for (const raw of ['[]', 'null', '42', '"x"']) {
    const r = await call('POST', '/api/review', { raw, headers: { 'Content-Type': 'application/json' } })
    assert.equal(r.status, 400, raw)
    assert.equal(r.json.error, 'JSON inválido.')
  }
})
