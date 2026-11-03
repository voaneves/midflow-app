import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { createFakeBackend } from './fakeBackend.ts'

// Events go to a throw-away file. Must be set before telemetry.ts loads.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'midflow-account-'))
const eventsFile = path.join(tmpDir, 'events.jsonl')
process.env.EVENTS_FILE = eventsFile

const BACKEND_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_JWT_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
for (const n of BACKEND_ENV) delete process.env[n]

const { config } = await import('../config.ts')
const { setRateLimitStore } = await import('../http.ts')
const { handleApiRequest } = await import('../routes.ts')
const { signHs256Jwt } = await import('../auth.ts')
const { clearStaffCache } = await import('../authz.ts')

const JWT_SECRET = 'test-jwt-secret-value'
const ids = {
  admin: '11111111-1111-4111-8111-111111111111',
  admin2: '66666666-6666-4666-8666-666666666666',
  customer: '33333333-3333-4333-8333-333333333333',
  other: '44444444-4444-4444-8444-444444444444',
}

const be = createFakeBackend()
const realFetch = globalThis.fetch
const real = { limits: { ...config.limits }, logRequests: config.logRequests }

let server: http.Server
let base = ''

before(async () => {
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
  be.reset()
  config.logRequests = false
  for (const n of BACKEND_ENV) delete process.env[n]
})

afterEach(() => {
  Object.assign(config.limits, real.limits)
  config.logRequests = real.logRequests
})

function enableSupabase() {
  process.env.SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET
}

function enableStripe() {
  process.env.STRIPE_SECRET_KEY = 'sk_test_account'
}

const tokenFor = (sub: string) =>
  signHs256Jwt({ sub, email: `${sub.slice(0, 4)}@example.com`, aud: 'authenticated', role: 'authenticated', iss: 'https://fake.supabase.co/auth/v1', exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET)

async function del(opts: { body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  const res = await realFetch(`${base}/api/account/delete`, { method: 'POST', headers, body: JSON.stringify(opts.body ?? { confirm: 'EXCLUIR' }) })
  const text = await res.text()
  return { status: res.status, json: text ? JSON.parse(text) : null }
}

function seedCustomer() {
  be.tables.profiles.push({ id: ids.customer, email: 'cliente@example.com' }, { id: ids.other, email: 'outro@example.com' })
  be.tables.usage_counters.push({ user_id: ids.customer, period: '2026-11', used: 3 })
  be.tables.review_requests.push(
    { id: 'r1', user_id: ids.customer, contact_email: 'cliente@example.com', comment: 'oi', payload: {} },
    { id: 'r2', user_id: ids.other, contact_email: 'outro@example.com', comment: 'oi', payload: {} },
  )
  be.tables.ai_events.push({ id: 1, user_id: ids.customer, route: 'generate' }, { id: 2, user_id: ids.other, route: 'generate' })
}

const authDeleteCalls = () => be.calls.filter((c) => c.startsWith('DELETE fake.supabase.co/auth/v1/admin/users/'))

test('account delete: 501 in pt-BR when Supabase is not configured', async () => {
  const r = await del({ token: 'whatever' })
  assert.equal(r.status, 501)
  assert.match(r.json.error, /banco de dados/)
})

test('account delete: requires a valid Bearer token', async () => {
  enableSupabase()
  assert.equal((await del()).status, 401)
  assert.equal((await del({ token: 'not.a.jwt' })).status, 401)
  assert.equal(authDeleteCalls().length, 0)
})

test('account delete: the typed confirmation is required', async () => {
  enableSupabase()
  const token = await tokenFor(ids.customer)
  for (const confirm of [undefined, '', 'excluir', 'SIM']) {
    const r = await del({ token, body: { confirm } })
    assert.equal(r.status, 400)
    assert.match(r.json.error, /EXCLUIR/)
  }
  assert.equal(authDeleteCalls().length, 0)
})

test('account delete: refuses to remove the last admin', async () => {
  enableSupabase()
  be.tables.staff_members.push({ user_id: ids.admin, role: 'admin', created_at: '2026-01-01T00:00:00Z' })
  const r = await del({ token: await tokenFor(ids.admin) })
  assert.equal(r.status, 409)
  assert.match(r.json.error, /administradora/)
  assert.equal(authDeleteCalls().length, 0)
  assert.equal(be.tables.staff_members.length, 1)
})

test('account delete: an admin may leave when another admin remains', async () => {
  enableSupabase()
  be.tables.staff_members.push({ user_id: ids.admin, role: 'admin', created_at: '2026-01-01T00:00:00Z' }, { user_id: ids.admin2, role: 'admin', created_at: '2026-01-02T00:00:00Z' })
  const r = await del({ token: await tokenFor(ids.admin) })
  assert.equal(r.status, 200)
  assert.deepEqual(
    be.tables.staff_members.map((s) => s.user_id),
    [ids.admin2],
  )
})

test('account delete: cancels the Stripe subscription first, then deletes the auth user and the data', async () => {
  enableSupabase()
  enableStripe()
  seedCustomer()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'pro', status: 'active', stripe_subscription_id: 'sub_123', stripe_customer_id: 'cus_1' })

  const r = await del({ token: await tokenFor(ids.customer) })
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { success: true })

  const stripeAt = be.calls.indexOf('DELETE api.stripe.com/v1/subscriptions/sub_123')
  const authAt = be.calls.findIndex((c) => c.startsWith('DELETE fake.supabase.co/auth/v1/admin/users/'))
  assert.ok(stripeAt >= 0, 'Stripe subscription cancelled')
  assert.ok(authAt > stripeAt, 'auth user deleted after the Stripe cancel')
  assert.equal(be.stripeRequests[0].headers.Authorization, 'Bearer sk_test_account')
  assert.equal(authDeleteCalls()[0], `DELETE fake.supabase.co/auth/v1/admin/users/${ids.customer}`)

  // Cascade simulated by the fake; the other customer is untouched.
  assert.equal(
    be.tables.profiles.some((p) => p.id === ids.customer),
    false,
  )
  assert.equal(
    be.tables.profiles.some((p) => p.id === ids.other),
    true,
  )
  assert.deepEqual(
    be.tables.review_requests.map((x) => x.id),
    ['r2'],
  )
  assert.equal(be.tables.ai_events.find((e) => e.id === 1)?.user_id, null)
  assert.equal(be.tables.ai_events.find((e) => e.id === 2)?.user_id, ids.other)

  // The telemetry line carries no identifiers.
  const line = fs
    .readFileSync(eventsFile, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .find((e) => e.type === 'account_deleted')
  assert.ok(line)
  assert.deepEqual(Object.keys(line).sort(), ['at', 'type'])
})

test('account delete: a failed Stripe cancel aborts before anything is deleted', async () => {
  enableSupabase()
  enableStripe()
  seedCustomer()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'pro', status: 'active', stripe_subscription_id: 'sub_123' })
  be.stripeCancelStatus = 500

  const r = await del({ token: await tokenFor(ids.customer) })
  assert.equal(r.status, 502)
  assert.match(r.json.error, /assinatura/)
  assert.equal(authDeleteCalls().length, 0)
  assert.equal(be.tables.review_requests.length, 2)
})

test('account delete: an active subscription without Stripe configured aborts', async () => {
  enableSupabase()
  seedCustomer()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'pro', status: 'active', stripe_subscription_id: 'sub_123' })
  const r = await del({ token: await tokenFor(ids.customer) })
  assert.equal(r.status, 502)
  assert.equal(authDeleteCalls().length, 0)
})

test('account delete: no Stripe call without a live subscription (free or already cancelled)', async () => {
  enableSupabase()
  enableStripe()
  seedCustomer()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'pro', status: 'canceled', stripe_subscription_id: 'sub_old' })
  const r = await del({ token: await tokenFor(ids.customer) })
  assert.equal(r.status, 200)
  assert.equal(be.stripeRequests.length, 0)
  assert.equal(authDeleteCalls().length, 1)
})

test('account delete: a failing Supabase Auth delete is reported and can be retried', async () => {
  enableSupabase()
  seedCustomer()
  be.authDeleteStatus = 500
  const token = await tokenFor(ids.customer)
  const failed = await del({ token })
  assert.equal(failed.status, 503)
  assert.match(failed.json.error, /Tente novamente/)

  be.authDeleteStatus = 200
  assert.equal((await del({ token })).status, 200)
})

test('account delete: limited to 5 per hour per IP', async () => {
  enableSupabase()
  const token = await tokenFor(ids.customer)
  for (let i = 0; i < config.limits.accountDeletePerHour; i++) assert.equal((await del({ token })).status, 200)
  assert.equal((await del({ token })).status, 429)
})
