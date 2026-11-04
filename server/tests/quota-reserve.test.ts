import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aiCalls, be, call, deliverAiPacks, enableGemini, enableSupabase, generateBody, ids, period, tokenFor, setupHarness } from './quotaHarness.ts'

setupHarness()

const usedOf = (user: string) => be.tables.usage_counters.find((r) => r.user_id === user && r.period === period())?.used ?? 0

test('parallel generations can never push usage past the plan limit', async () => {
  enableSupabase()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'start', status: 'active' }) // paid Start: 20/month (an account without a row is on the free plan, see quota-free.test.ts)
  deliverAiPacks()
  const token = await tokenFor(ids.customer)
  be.tables.usage_counters.push({ user_id: ids.customer, period: period(), used: 12 }) // start plan = 20; one run costs 5 → room for exactly one
  const results = await Promise.all(Array.from({ length: 8 }, () => call('POST', '/api/generate', { body: generateBody, token })))
  const ok = results.filter((r) => r.status === 200)
  const refused = results.filter((r) => r.status === 402)
  assert.equal(ok.length, 1, 'exactly one request fits')
  assert.equal(refused.length, 7)
  assert.ok(refused.every((r) => r.json.code === 'quota_exceeded' && r.json.limit === 20))
  assert.equal(usedOf(ids.customer), 17)
  assert.deepEqual(ok[0].json.usage, { plan: 'start', used: 17, limit: 20 })
})

test('parallel generations from a fresh Start subscriber stop at the limit (4 runs of 5 = 20)', async () => {
  enableSupabase()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'start', status: 'active' }) // paid Start: 20/month (an account without a row is on the free plan, see quota-free.test.ts)
  deliverAiPacks()
  const token = await tokenFor(ids.customer)
  const results = await Promise.all(Array.from({ length: 10 }, () => call('POST', '/api/generate', { body: generateBody, token })))
  assert.equal(results.filter((r) => r.status === 200).length, 4)
  assert.equal(results.filter((r) => r.status === 402).length, 6)
  assert.equal(usedOf(ids.customer), 20)
})

test('a reservation is refunded when the AI fails transiently (the client retries)', async () => {
  enableSupabase()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'start', status: 'active' }) // paid Start: 20/month (an account without a row is on the free plan, see quota-free.test.ts)
  enableGemini() // the fake answers the provider call with a 599 → transient
  const r = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.equal(r.status, 200)
  assert.equal(r.json.aiErrorKind, 'transient')
  assert.equal(r.json.retryable, true)
  assert.ok(aiCalls().length > 0)
  assert.equal(usedOf(ids.customer), 0)
  assert.deepEqual(r.json.usage, { plan: 'start', used: 0, limit: 20 })
})

test('a delivered result keeps its reservation and reports the usage', async () => {
  enableSupabase()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'start', status: 'active' }) // paid Start: 20/month (an account without a row is on the free plan, see quota-free.test.ts)
  deliverAiPacks()
  const r = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.equal(r.status, 200)
  assert.equal(r.json.generation.engine, 'gemini')
  assert.equal(r.json.aiErrorKind, null)
  assert.deepEqual(r.json.usage, { plan: 'start', used: 5, limit: 20 })
  assert.equal(usedOf(ids.customer), 5)
  assert.ok(be.calls.some((c) => c.endsWith('/rpc/reserve_usage')))
})

test('over the limit: 402 and nothing is reserved or sent to the AI', async () => {
  enableSupabase()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'start', status: 'active' }) // paid Start: 20/month (an account without a row is on the free plan, see quota-free.test.ts)
  enableGemini()
  be.tables.usage_counters.push({ user_id: ids.customer, period: period(), used: 18 })
  const r = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.equal(r.status, 402)
  assert.equal(r.json.used, 18)
  assert.equal(usedOf(ids.customer), 18)
  assert.equal(aiCalls().length, 0)
})

test('rewrites only check the allowance (they are not charged)', async () => {
  enableSupabase()
  be.tables.subscriptions.push({ user_id: ids.customer, plan: 'start', status: 'active' }) // paid Start: 20/month (an account without a row is on the free plan, see quota-free.test.ts)
  const token = await tokenFor(ids.customer)
  const r = await call('POST', '/api/rewrite', { body: { creative: { headline: 'x' } }, token })
  assert.equal(r.status, 200)
  assert.equal(usedOf(ids.customer), 0)
  be.tables.usage_counters.push({ user_id: ids.customer, period: period(), used: 20 })
  assert.equal((await call('POST', '/api/rewrite', { body: { creative: { headline: 'x' } }, token })).status, 402)
})
