import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { describeGeminiFailure, generateAIImage, geminiImageBody, imageHealth, imageRetry, isGeminiRateLimit, parseGeminiError } from '../ai/image.ts'
import { config } from '../config.ts'

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(5000, 1)])
const okBody = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }), { headers: { 'content-type': 'application/json' } })
const err = (status: number, code: number, st: string, message: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { code, status: st, message } }), { status, headers: { 'content-type': 'application/json', ...headers } })

const realFetch = globalThis.fetch
const real = { provider: config.image.provider, key: config.ai.geminiKey, model: config.ai.imageModel, timeoutMs: config.image.timeoutMs }
const realRetry = { ...imageRetry }
let bodies: any[] = []
let urls: string[] = []
let waits: number[] = []

beforeEach(() => {
  config.image.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  config.ai.imageModel = 'gemini-3.1-flash-lite-image'
  bodies = []
  urls = []
  waits = []
  imageRetry.sleep = async (ms) => void waits.push(ms)
  delete imageHealth.lastError
  delete imageHealth.lastCode
  delete imageHealth.lastErrorAt
})

afterEach(() => {
  globalThis.fetch = realFetch
  config.image.provider = real.provider
  config.ai.geminiKey = real.key
  config.ai.imageModel = real.model
  config.image.timeoutMs = real.timeoutMs
  imageRetry.sleep = realRetry.sleep
})

const script = (...responses: (() => Response)[]) => {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    urls.push(String(url))
    bodies.push(JSON.parse(String(init.body)))
    return responses[Math.min(bodies.length - 1, responses.length - 1)]()
  }) as typeof fetch
}

test('request asks for an image only, with the aspect ratio of the card kind', async () => {
  script(okBody, okBody)
  assert.ok(await generateAIImage('a cake', 'post'))
  assert.ok(await generateAIImage('a story', 'story'))
  assert.deepEqual(bodies[0].generationConfig, { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:5', imageSize: '1K' } })
  assert.deepEqual(bodies[1].generationConfig, { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16', imageSize: '1K' } })
  assert.match(urls[0], /models\/gemini-3\.1-flash-lite-image:generateContent$/)
  assert.match(bodies[0].contents[0].parts[0].text, /a cake$/)
})

test('geminiImageBody: minimal shape is the old one', () => {
  assert.deepEqual(geminiImageBody('x', 'story', true).generationConfig, { responseModalities: ['TEXT', 'IMAGE'] })
})

test('400 about imageConfig: one retry with the old minimal body, then the image arrives', async () => {
  script(() => err(400, 400, 'INVALID_ARGUMENT', 'Invalid JSON payload received. Unknown name "imageConfig" at generation_config'), okBody)
  const img = await generateAIImage('a cake')
  assert.ok(img)
  assert.equal(img.source, 'gemini-image')
  assert.equal(bodies.length, 2)
  assert.ok(bodies[0].generationConfig.imageConfig)
  assert.deepEqual(bodies[1].generationConfig, { responseModalities: ['TEXT', 'IMAGE'] })
})

test('400 that is not about the image options is not retried and keeps the provider message', async () => {
  script(() => err(400, 400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.'))
  assert.equal(await generateAIImage('a cake'), null)
  assert.equal(bodies.length, 1)
  assert.equal(imageHealth.lastError, 'Gemini gemini-3.1-flash-lite-image respondeu 400 (INVALID_ARGUMENT) — API key not valid. Please pass a valid API key.')
})

test('429 RESOURCE_EXHAUSTED about billing/quota: no retry, pt-BR text, rate_limit', async () => {
  script(() => err(429, 429, 'RESOURCE_EXHAUSTED', 'You exceeded your current quota, please check your plan and billing details. limit: 0'))
  assert.equal(await generateAIImage('a cake'), null)
  assert.equal(bodies.length, 1)
  assert.deepEqual(waits, [])
  assert.equal(imageHealth.lastCode, 'rate_limit')
  assert.match(imageHealth.lastError!, /^Gemini gemini-3\.1-flash-lite-image 429 \(RESOURCE_EXHAUSTED\): cota\/limite atingido — confira o faturamento da chave — You exceeded/)
})

test('429 per-minute rate limit: retried with backoff, then succeeds', async () => {
  script(() => err(429, 429, 'RESOURCE_EXHAUSTED', 'Rate limit exceeded: too many requests per minute.'), okBody)
  assert.ok(await generateAIImage('a cake'))
  assert.equal(bodies.length, 2)
  assert.deepEqual(waits, [1500])
})

test('429 per-minute: "retry in Ns" in the message and Retry-After are respected; gives up after two retries', async () => {
  script(() => err(429, 429, 'RESOURCE_EXHAUSTED', 'Rate limit exceeded per minute. Please retry in 2.5s.'))
  assert.equal(await generateAIImage('a cake'), null)
  assert.equal(bodies.length, 3)
  assert.deepEqual(waits, [2500, 2500])
  assert.equal(imageHealth.lastCode, 'rate_limit')

  bodies = []
  waits = []
  script(() => err(429, 429, 'RESOURCE_EXHAUSTED', 'Too many requests per minute', { 'retry-after': '3' }), okBody)
  assert.ok(await generateAIImage('a cake'))
  assert.deepEqual(waits, [3000])
})

test('403 is invalid_key with the provider detail; 503 keeps status and message', async () => {
  script(() => err(403, 403, 'PERMISSION_DENIED', 'The caller does not have permission'))
  assert.equal(await generateAIImage('a cake'), null)
  assert.equal(imageHealth.lastCode, 'invalid_key')
  assert.match(imageHealth.lastError!, /chave sem permissão \(403\) \(PERMISSION_DENIED\) — The caller does not have permission/)

  script(() => err(503, 503, 'UNAVAILABLE', 'The model is overloaded. See https://ai.google.dev/gemini-api/docs?key=AIzaSyA1234567890123456789012345678901'))
  assert.equal(await generateAIImage('a cake'), null)
  assert.equal(imageHealth.lastCode, 'provider_error')
  assert.equal(imageHealth.lastError, 'Gemini gemini-3.1-flash-lite-image respondeu 503 (UNAVAILABLE) — The model is overloaded. See [url]')
})

test('error parsing and classification helpers', () => {
  assert.deepEqual(parseGeminiError('{"error":{"code":429,"message":"Quota  exceeded","status":"RESOURCE_EXHAUSTED"}}'), { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' })
  assert.equal(parseGeminiError('not json'), null)
  assert.equal(parseGeminiError('{"error":{}}'), null)
  assert.equal(isGeminiRateLimit({ message: 'Too many requests per minute' }), true)
  assert.equal(isGeminiRateLimit({ message: 'Quota exceeded for free tier, per minute' }), false)
  assert.equal(isGeminiRateLimit({ message: 'Check your plan and billing details' }), false)
  assert.equal(isGeminiRateLimit(null), false)
  assert.equal(describeGeminiFailure('m', 500, 'oops'), 'Gemini m respondeu 500')
})
