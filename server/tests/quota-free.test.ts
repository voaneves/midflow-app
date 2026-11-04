import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aiCalls, be, call, deliverAiPacks, enableGemini, enableSupabase, generateBody, ids, period, setupHarness, tokenFor } from './quotaHarness.ts'

setupHarness()

const usedOf = (user: string) => be.tables.usage_counters.find((r) => r.user_id === user && r.period === period())?.used ?? 0
const FREE_MESSAGE = /conteúdos grátis/

test('an account without a subscription row is on the free plan: one full pack (5 contents) per month', async () => {
  enableSupabase()
  deliverAiPacks()
  const token = await tokenFor(ids.customer)
  const r = await call('POST', '/api/generate', { body: generateBody, token })
  assert.equal(r.status, 200)
  assert.equal(r.json.generation.engine, 'gemini', 'free accounts get AI text')
  assert.deepEqual(r.json.usage, { plan: 'free', used: 5, limit: 5 })
  assert.equal(usedOf(ids.customer), 5)
  // 'free' is never stored: no subscription row appears.
  assert.equal(be.tables.subscriptions.length, 0)
})

test('free plan at the limit: 402 quota_exceeded with the free message, nothing reserved and no AI call', async () => {
  enableSupabase()
  enableGemini()
  be.tables.usage_counters.push({ user_id: ids.customer, period: period(), used: 5 })
  const r = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.equal(r.status, 402)
  assert.equal(r.json.code, 'quota_exceeded')
  assert.equal(r.json.plan, 'free')
  assert.equal(r.json.limit, 5)
  assert.equal(r.json.used, 5)
  assert.match(r.json.error, FREE_MESSAGE)
  assert.match(r.json.error, /dia 1º/)
  assert.equal(usedOf(ids.customer), 5)
  assert.equal(aiCalls().length, 0)
})

test('free plan: a second pack in the same month is refused', async () => {
  enableSupabase()
  deliverAiPacks()
  const token = await tokenFor(ids.customer)
  assert.equal((await call('POST', '/api/generate', { body: generateBody, token })).status, 200)
  const again = await call('POST', '/api/generate', { body: generateBody, token })
  assert.equal(again.status, 402)
  assert.equal(again.json.plan, 'free')
})

test('a canceled subscription falls back to the free allowance (5), not to the old plan', async () => {
  enableSupabase()
  enableGemini()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'pro', status: 'canceled' })
  be.tables.usage_counters.push({ user_id: ids.customer, period: period(), used: 5 })
  const r = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.equal(r.status, 402)
  assert.equal(r.json.plan, 'free')
  assert.equal(r.json.limit, 5)
  assert.match(r.json.error, FREE_MESSAGE)
})

test('a past_due subscription keeps the paid plan (60 for Pro) and the paid message', async () => {
  enableSupabase()
  deliverAiPacks()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'pro', status: 'past_due' })
  const r = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.equal(r.status, 200)
  assert.deepEqual(r.json.usage, { plan: 'pro', used: 5, limit: 60 })
  be.tables.usage_counters[0].used = 60
  const over = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.equal(over.status, 402)
  assert.match(over.json.error, /plano Pro/)
  assert.doesNotMatch(over.json.error, FREE_MESSAGE)
})

test('checkout rejects the free plan: it is not for sale', async () => {
  enableSupabase()
  process.env.STRIPE_SECRET_KEY = 'sk_test_123'
  process.env.STRIPE_PRICE_START = 'price_start_m'
  try {
    const r = await call('POST', '/api/billing/checkout', { body: { plan: 'free' }, token: await tokenFor(ids.customer) })
    assert.equal(r.status, 400)
    assert.equal(r.json.error, 'Plano inválido.')
    assert.ok(!be.stripeRequests.length, 'Stripe is never called')
  } finally {
    delete process.env.STRIPE_PRICE_START
  }
})

test('an anonymous template result is not an AI failure: no daily_cap kind, only code account_required', async () => {
  enableSupabase()
  enableGemini()
  const gen = await call('POST', '/api/generate', { body: generateBody })
  assert.equal(gen.status, 200)
  assert.equal(gen.json.generation.engine, 'template')
  assert.equal(gen.json.code, 'account_required')
  assert.equal(gen.json.aiErrorKind, null)
  assert.equal(gen.json.retryable, false)
  assert.equal(aiCalls().length, 0)
  const rewrite = await call('POST', '/api/rewrite', { body: { creative: { headline: 'x', cta: 'y', caption: 'z' }, mode: 'curto', brandName: 'Studio Teste', segment: 'beleza' } })
  assert.equal(rewrite.status, 200)
  assert.equal(rewrite.json.code, 'account_required')
  assert.equal(rewrite.json.aiErrorKind, null)
})
