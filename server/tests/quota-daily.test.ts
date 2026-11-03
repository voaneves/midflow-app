import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryStore, setRateLimitStore } from '../http.ts'
import { aiCalls, be, call, config, deliverAiPacks, enableGemini, enableSupabase, generateBody, ids, setupHarness, tokenFor } from './quotaHarness.ts'

setupHarness()

const day = () => new Date().toISOString().slice(0, 10)
const rewriteBody = { creative: { headline: 'Hidratação profunda', cta: 'Agendar', caption: 'Legenda' }, mode: 'curto', brandName: 'Studio Teste', segment: 'beleza' }

/** Counts every key the daily budgets and rate limiters touch, like the Durable Object store would see them. */
function recordKeys() {
  const keys: string[] = []
  const inner = createMemoryStore()
  setRateLimitStore({
    hit(key, windowMs, now) {
      keys.push(key)
      return inner.hit(key, windowMs, now)
    },
  })
  return keys
}

function enableImages() {
  process.env.IMAGE_URL_SECRET = 'image-secret-for-test'
  config.image.provider = 'cloudflare'
}

const signed = (g: any) => [...g.posts, ...g.stories].filter((c: any) => c.photo.includes('sig=')).length

/* ---------------- rewrite ---------------- */

test('rewrite: a per-user daily cap answers the honest template (daily_cap, not retryable); other users are unaffected', async () => {
  enableSupabase()
  deliverAiPacks()
  config.limits.dailyMaxRewritePerUser = 2
  const keys = recordKeys()
  const a = await tokenFor(ids.customer)
  const b = await tokenFor(ids.other)

  for (let i = 0; i < 2; i++) {
    const ok = await call('POST', '/api/rewrite', { body: rewriteBody, token: a })
    assert.equal(ok.json.engine, 'gemini')
    assert.equal(ok.json.aiErrorKind, null)
  }
  const capped = await call('POST', '/api/rewrite', { body: rewriteBody, token: a })
  assert.equal(capped.status, 200)
  assert.equal(capped.json.engine, 'template')
  assert.equal(capped.json.aiErrorKind, 'daily_cap')
  assert.equal(capped.json.retryable, false)
  assert.equal(typeof capped.json.data.headline, 'string')

  assert.equal((await call('POST', '/api/rewrite', { body: rewriteBody, token: b })).json.engine, 'gemini')
  // The keys start with "daily:", so on the Worker they go through the Durable Object store.
  assert.ok(keys.includes(`daily:rewrite:${ids.customer}:${day()}`))
  assert.ok(keys.includes(`daily:rewrite:${day()}`), 'and the global rewrite budget is its own key, not daily:text')
  assert.ok(!keys.includes(`daily:text:${day()}`))
})

test('rewrite: the per-user cap does not consume the global rewrite budget once it is hit', async () => {
  enableSupabase()
  deliverAiPacks()
  config.limits.dailyMaxRewritePerUser = 1
  config.limits.dailyMaxRewrite = 2
  const a = await tokenFor(ids.customer)
  await call('POST', '/api/rewrite', { body: rewriteBody, token: a }) // global 1/2
  for (let i = 0; i < 5; i++) await call('POST', '/api/rewrite', { body: rewriteBody, token: a }) // capped per user: not counted globally
  assert.equal((await call('POST', '/api/rewrite', { body: rewriteBody, token: await tokenFor(ids.other) })).json.engine, 'gemini') // global 2/2
  assert.equal((await call('POST', '/api/rewrite', { body: rewriteBody, token: await tokenFor('55555555-5555-4555-8555-555555555555') })).json.aiErrorKind, 'daily_cap')
})

test('rewrite: anonymous callers in ANON_AI=open are capped per IP with the same limit', async () => {
  enableSupabase()
  deliverAiPacks()
  process.env.ANON_AI = 'open'
  config.limits.dailyMaxRewritePerUser = 1
  const keys = recordKeys()
  assert.equal((await call('POST', '/api/rewrite', { body: rewriteBody })).json.engine, 'gemini')
  const capped = await call('POST', '/api/rewrite', { body: rewriteBody })
  assert.equal(capped.json.engine, 'template')
  assert.equal(capped.json.aiErrorKind, 'daily_cap')
  assert.ok(keys.some((k) => k.startsWith('daily:rewrite:ip:') && k.endsWith(`:${day()}`)))
})

/* ---------------- images ---------------- */

test('generate-image: past the per-user daily cap the answer is an unsigned non-AI URL flagged daily_user_limit', async () => {
  enableSupabase()
  enableImages()
  config.limits.dailyMaxImagesPerUser = 2
  const keys = recordKeys()
  const token = await tokenFor(ids.customer)
  const body = { headline: 'x', segment: 'beleza', prompt: 'corte' }

  for (let i = 0; i < 2; i++) {
    const ok = await call('POST', '/api/generate-image', { body, token })
    assert.equal(ok.json.aiEnabled, true)
    assert.equal(ok.json.code, undefined)
    assert.match(ok.json.imageUrl, /sig=/)
  }
  const capped = await call('POST', '/api/generate-image', { body, token })
  assert.equal(capped.status, 200)
  assert.equal(capped.json.success, true)
  assert.equal(capped.json.aiEnabled, false)
  assert.equal(capped.json.code, 'daily_user_limit')
  assert.ok(!/ai=1|sig=/.test(capped.json.imageUrl))

  const other = await call('POST', '/api/generate-image', { body, token: await tokenFor(ids.other) })
  assert.equal(other.json.aiEnabled, true)
  assert.ok(keys.includes(`daily:img:${ids.customer}:${day()}`))
})

test('generate: every signed card image URL counts against the same per-user key (8 per pack); cards past the cap get stock photos', async () => {
  enableSupabase()
  enableImages()
  config.limits.dailyMaxImagesPerUser = 10
  const token = await tokenFor(ids.customer)

  const first = await call('POST', '/api/generate', { body: generateBody, token })
  assert.equal(signed(first.json.generation), 8)
  const second = await call('POST', '/api/generate', { body: generateBody, token })
  assert.equal(signed(second.json.generation), 2, 'only the 2 images left of the day are AI')
  assert.equal(second.json.generation.posts.length + second.json.generation.stories.length, 8, 'the pack itself is complete')

  const editor = await call('POST', '/api/generate-image', { body: { headline: 'x' }, token })
  assert.equal(editor.json.code, 'daily_user_limit', 'the editor button shares the counter')

  const fresh = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.other) })
  assert.equal(signed(fresh.json.generation), 8, 'another account has its own budget')
})

/* ---------------- quota: fail closed ---------------- */

test('quota: when the database answers with an error the request is refused (503), not served unmetered', async () => {
  enableSupabase()
  enableGemini()
  const token = await tokenFor(ids.customer)
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    String(input).includes('/rpc/reserve_usage') ? new Response('{"code":"PGRST202"}', { status: 404 }) : be.fetch(input, init)) as typeof fetch
  const r = await call('POST', '/api/generate', { body: generateBody, token })
  assert.equal(r.status, 503)
  assert.equal(r.json.error, 'Não foi possível verificar seu plano agora. Tente novamente em instantes.')
  assert.equal(aiCalls().length, 0, 'no paid call was made')

  // the allowance check used by rewrites fails closed the same way
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    String(input).includes('/usage_counters') ? new Response('boom', { status: 500 }) : be.fetch(input, init)) as typeof fetch
  assert.equal((await call('POST', '/api/rewrite', { body: rewriteBody, token })).status, 503)
})

test('quota: when the database cannot be reached at all the request is still served (fail open), without usage tracking', async () => {
  enableSupabase()
  const token = await tokenFor(ids.customer)
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed')
  }) as typeof fetch
  const r = await call('POST', '/api/generate', { body: generateBody, token })
  assert.equal(r.status, 200)
  assert.equal(r.json.usage, undefined)
})
