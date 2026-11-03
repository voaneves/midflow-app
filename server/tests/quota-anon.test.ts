import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aiCalls, be, call, config, enableGemini, enableSupabase, generateBody, ids, tokenFor, setupHarness } from './quotaHarness.ts'

setupHarness()

const rewriteBody = { creative: { headline: 'Hidratação profunda', cta: 'Agendar', caption: 'Legenda' }, mode: 'curto', brandName: 'Studio Teste', segment: 'beleza' }

test('ANON_AI defaults: template when accounts are configured, open otherwise', async () => {
  const { anonAiMode } = await import('../config.ts')
  assert.equal(anonAiMode(), 'open')
  enableSupabase()
  assert.equal(anonAiMode(), 'template')
  process.env.ANON_AI = 'off'
  assert.equal(anonAiMode(), 'off')
  process.env.ANON_AI = 'nonsense'
  assert.equal(anonAiMode(), 'template')
})

test('template mode: an anonymous generate gets the honest template and never reaches a paid model or the daily budget', async () => {
  enableSupabase()
  enableGemini()
  config.limits.dailyMaxText = 1
  const r = await call('POST', '/api/generate', { body: generateBody })
  assert.equal(r.status, 200)
  assert.equal(r.json.generation.engine, 'template')
  assert.equal(r.json.code, 'account_required')
  assert.equal(r.json.aiErrorKind, 'daily_cap')
  assert.equal(r.json.retryable, false)
  assert.equal(aiCalls().length, 0)
  // The single daily unit is still available for a signed-in caller.
  const signedIn = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.equal(signedIn.status, 200)
  assert.ok(aiCalls().length > 0, 'signed-in callers still reach the AI')
  assert.equal(signedIn.json.code, undefined)
})

test('template mode: anonymous cards never ask for a signed AI image', async () => {
  enableSupabase()
  process.env.IMAGE_URL_SECRET = 'image-secret-for-test'
  config.image.provider = 'cloudflare'
  const anon = await call('POST', '/api/generate', { body: generateBody })
  assert.ok(anon.json.generation.posts.every((p: any) => !p.photo.includes('ai=1')))
  const user = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.ok(user.json.generation.posts.every((p: any) => p.photo.includes('ai=1') && p.photo.includes('sig=')))
})

test('template mode: an anonymous rewrite is the template version and flagged', async () => {
  enableSupabase()
  enableGemini()
  const r = await call('POST', '/api/rewrite', { body: rewriteBody })
  assert.equal(r.status, 200)
  assert.equal(r.json.engine, 'template')
  assert.equal(r.json.code, 'account_required')
  assert.equal(aiCalls().length, 0)
})

test('template mode: an anonymous editor image request gets a non-AI URL and the account_required code', async () => {
  enableSupabase()
  process.env.IMAGE_URL_SECRET = 'image-secret-for-test'
  config.image.provider = 'cloudflare'
  const r = await call('POST', '/api/generate-image', { body: { headline: 'x', segment: 'beleza' } })
  assert.equal(r.status, 200)
  assert.equal(r.json.code, 'account_required')
  assert.equal(r.json.aiEnabled, false)
  assert.ok(!r.json.imageUrl.includes('ai=1'))
})

test('off mode: anonymous callers get a 401 asking to sign in; signed-in callers are unaffected', async () => {
  enableSupabase()
  process.env.ANON_AI = 'off'
  for (const [route, body] of [
    ['/api/generate', generateBody],
    ['/api/rewrite', rewriteBody],
    ['/api/generate-image', { headline: 'x' }],
  ] as const) {
    const r = await call('POST', route, { body })
    assert.equal(r.status, 401, route)
    assert.match(r.json.error, /Entre na sua conta/)
  }
  const ok = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
  assert.equal(ok.status, 200)
})

test('open mode: anonymous callers reach the AI (local development)', async () => {
  enableSupabase()
  enableGemini()
  process.env.ANON_AI = 'open'
  await call('POST', '/api/generate', { body: generateBody })
  assert.ok(aiCalls().length > 0)
  assert.equal(be.tables.usage_counters.length, 0, 'anonymous usage is not tracked')
})
