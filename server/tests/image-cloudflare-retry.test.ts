import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { cloudflareDaily, imageRetry, describeCloudflareFailure, generateAIImage, imageHealth, isDailyAllocationError, parseCloudflareError } from '../ai/image.ts'
import { aggregateAiHealth, sanitizeErrorDetail, toAiEventRow } from '../aihealth.ts'
import { config } from '../config.ts'

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5000, 1)])
const okBody = () => new Response(JSON.stringify({ success: true, result: { image: jpeg.toString('base64') } }), { headers: { 'content-type': 'application/json' } })
const capacity = (headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ result: null, success: false, errors: [{ code: 3040, message: 'Capacity temporarily exceeded, please try again.' }], messages: [] }), {
    status: 429,
    headers: { 'content-type': 'application/json', ...headers },
  })
const daily = () =>
  new Response(
    JSON.stringify({ success: false, errors: [{ code: 4006, message: "AiError: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare's Workers Paid plan" }] }),
    { status: 429, headers: { 'content-type': 'application/json' } },
  )

const realFetch = globalThis.fetch
const realConfig = { provider: config.image.provider, id: config.image.cfAccountId, token: config.image.cfApiToken, timeoutMs: config.image.timeoutMs }
const realRetry = { ...imageRetry }
let waits: number[] = []
let calls = 0

beforeEach(() => {
  config.image.provider = 'cloudflare'
  config.image.cfAccountId = 'acct'
  config.image.cfApiToken = 'tok'
  waits = []
  calls = 0
  imageRetry.sleep = async (ms) => void waits.push(ms)
  cloudflareDaily.reset()
  delete imageHealth.lastError
  delete imageHealth.lastCode
  delete imageHealth.lastErrorAt
})

afterEach(() => {
  globalThis.fetch = realFetch
  config.image.provider = realConfig.provider
  config.image.cfAccountId = realConfig.id
  config.image.cfApiToken = realConfig.token
  config.image.timeoutMs = realConfig.timeoutMs
  imageRetry.sleep = realRetry.sleep
  imageRetry.delaysMs = realRetry.delaysMs
  cloudflareDaily.reset()
})

const script = (...responses: (() => Response)[]) => {
  globalThis.fetch = (async () => responses[Math.min(calls++, responses.length - 1)]()) as typeof fetch
}

test('429 then 200: the image arrives after one retry (1.5 s backoff)', async () => {
  script(() => capacity(), okBody)
  const img = await generateAIImage('a cake')
  assert.ok(img)
  assert.equal(img.source, 'cloudflare-ai')
  assert.equal(calls, 2)
  assert.deepEqual(waits, [1500])
})

test('429 three times: fails after two retries (1.5 s, 4 s) with the provider code and message', async () => {
  script(() => capacity())
  const img = await generateAIImage('a cake')
  assert.equal(img, null)
  assert.equal(calls, 3)
  assert.deepEqual(waits, [1500, 4000])
  assert.equal(imageHealth.lastCode, 'rate_limit')
  assert.match(imageHealth.lastError!, /^Cloudflare 429 \(3040\): limite momentâneo do Workers AI \(muitas imagens ao mesmo tempo\)/)
  assert.match(imageHealth.lastError!, /Capacity temporarily exceeded/)
  assert.equal(cloudflareDaily.blocked(), false, 'a capacity 429 does not block the rest of the day')
})

test('Retry-After wins over the fixed backoff', async () => {
  script(() => capacity({ 'retry-after': '2' }), okBody)
  assert.ok(await generateAIImage('a cake'))
  assert.deepEqual(waits, [2000])
})

test('a retry that would pass the overall timeout is not attempted', async () => {
  config.image.timeoutMs = 3000
  script(() => capacity({ 'retry-after': '10' }))
  assert.equal(await generateAIImage('a cake'), null)
  assert.equal(calls, 1)
  assert.deepEqual(waits, [])
})

test('daily allocation used up (4006): no retry, clear message, and no more calls until 00:00 UTC', async () => {
  script(() => daily())
  assert.equal(await generateAIImage('a cake'), null)
  assert.equal(calls, 1)
  assert.deepEqual(waits, [])
  assert.equal(imageHealth.lastCode, 'rate_limit')
  assert.equal(
    imageHealth.lastError,
    'Cloudflare 429 (4006): cota diária gratuita do Workers AI esgotada (10.000 neurons; renova à meia-noite UTC). Assine o Workers Paid para continuar.',
  )
  assert.equal(cloudflareDaily.blocked(), true)

  // The next images skip the provider entirely (the caller serves the stock/catalog fallback).
  script(okBody)
  calls = 0
  assert.equal(await generateAIImage('another cake'), null)
  assert.equal(calls, 0, 'Workers AI is not called while blocked')
  assert.equal(imageHealth.lastCode, 'rate_limit')
  assert.match(imageHealth.lastError!, /cota diária gratuita do Workers AI esgotada/)
})

test('the daily block ends at the next 00:00 UTC', () => {
  const evening = Date.UTC(2026, 10, 4, 22, 30)
  cloudflareDaily.block(evening)
  assert.equal(cloudflareDaily.until, Date.UTC(2026, 10, 5))
  assert.equal(cloudflareDaily.blocked(Date.UTC(2026, 10, 4, 23, 59, 59)), true)
  assert.equal(cloudflareDaily.blocked(Date.UTC(2026, 10, 5)), false)
})

test('other statuses are not retried and keep the provider message', async () => {
  script(() => new Response(JSON.stringify({ success: false, errors: [{ code: 5000, message: 'Internal error' }] }), { status: 500, headers: { 'content-type': 'application/json' } }))
  assert.equal(await generateAIImage('a cake'), null)
  assert.equal(calls, 1)
  assert.equal(imageHealth.lastCode, 'provider_error')
  assert.equal(imageHealth.lastError, 'Cloudflare 500 (5000): Internal error')
})

test('auth errors keep their own code and text', async () => {
  script(() => new Response('{}', { status: 403 }))
  assert.equal(await generateAIImage('a cake'), null)
  assert.equal(imageHealth.lastCode, 'invalid_key')
})

test('error body parsing', () => {
  assert.deepEqual(parseCloudflareError('{"errors":[{"code":3040,"message":"Capacity  temporarily exceeded"}]}'), { code: 3040, message: 'Capacity temporarily exceeded' })
  assert.equal(parseCloudflareError('<html>bad gateway</html>'), null)
  assert.equal(parseCloudflareError('{"errors":[]}'), null)
  assert.equal(isDailyAllocationError({ code: 4006, message: 'x' }), true)
  assert.equal(isDailyAllocationError({ message: 'You have used up your daily free allocation' }), true)
  assert.equal(isDailyAllocationError({ code: 3040, message: 'Capacity temporarily exceeded' }), false)
  assert.equal(describeCloudflareFailure(502, 'Bad gateway'), 'Cloudflare 502: Bad gateway')
})

test('error_detail: one line, 200 chars, no URLs or token-like strings', () => {
  const dirty = `Cloudflare 429 (3040): see https://api.cloudflare.com/client/v4/accounts/abc?token=zzz\nBearer ${'a'.repeat(40)} ${'x'.repeat(300)}`
  const clean = sanitizeErrorDetail(dirty)!
  assert.ok(clean.length <= 200)
  assert.ok(!/https?:|\n|a{32}/.test(clean))
  assert.match(clean, /^Cloudflare 429 \(3040\): see \[url\]/)
  assert.equal(sanitizeErrorDetail('   '), null)
  assert.equal(sanitizeErrorDetail(42), null)
  assert.equal(toAiEventRow({ route: 'image', outcome: 'transient', engine: 'stock', errorCode: 'rate_limit', errorDetail: 'Cloudflare 429 (3040): limite' }).error_detail, 'Cloudflare 429 (3040): limite')
})

test('admin "Último erro" carries the stored provider message', () => {
  const now = Date.now()
  const row = { created_at: new Date(now - 60_000).toISOString(), route: 'image', provider: 'cloudflare', model: 'm', outcome: 'transient', engine: 'stock', latency_ms: 100, quality_score: null, retries: 0, error_code: 'rate_limit', error_detail: 'Cloudflare 429 (3040): limite momentâneo', user_id: null }
  const extras = { providers: [], maxText: 1, maxImages: 1, maxRewrite: 1 }
  assert.equal(aggregateAiHealth([row], '24h', now, 'supabase', extras).lastError?.message, 'Cloudflare 429 (3040): limite momentâneo')
  assert.equal(aggregateAiHealth([{ ...row, error_detail: undefined }], '24h', now, 'supabase', extras).lastError?.message, null)
})
