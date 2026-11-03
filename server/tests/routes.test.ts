import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, before, beforeEach, test } from 'node:test'

// Events go to a throw-away file, never to server/data. Must be set before telemetry.ts loads.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'midflow-routes-'))
const eventsFile = path.join(tmpDir, 'events.jsonl')
process.env.EVENTS_FILE = eventsFile

const { config } = await import('../config.ts')
const { setRateLimitStore } = await import('../http.ts')
const { handleApiRequest } = await import('../routes.ts')
const { logEvent, pruneEvents, scrubText } = await import('../telemetry.ts')

const real = {
  adminToken: config.adminToken,
  provider: config.ai.provider,
  geminiKey: config.ai.geminiKey,
  requireLlm: config.ai.requireLlm,
  imageProvider: config.image.provider,
  cfAccountId: config.image.cfAccountId,
  cfApiToken: config.image.cfApiToken,
  pixabayKey: config.image.pixabayKey,
  limits: { ...config.limits },
  logRequests: config.logRequests,
  isProd: config.isProd,
}
const realFetch = globalThis.fetch

let server: http.Server
let base = ''

before(async () => {
  server = http.createServer(async (req, res) => {
    if (!(await handleApiRequest(req, res))) res.writeHead(404).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(() => {
  setRateLimitStore()
  config.logRequests = false
  config.isProd = false
})

afterEach(() => {
  config.adminToken = real.adminToken
  config.ai.provider = real.provider
  config.ai.geminiKey = real.geminiKey
  config.ai.requireLlm = real.requireLlm
  config.image.provider = real.imageProvider
  config.image.cfAccountId = real.cfAccountId
  config.image.cfApiToken = real.cfApiToken
  config.image.pixabayKey = real.pixabayKey
  Object.assign(config.limits, real.limits)
  config.logRequests = real.logRequests
  config.isProd = real.isProd
  globalThis.fetch = realFetch
})

/** Fails the test if anything tries to reach a paid AI provider. */
function forbidAiNetwork() {
  const urls: string[] = []
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    urls.push(String(input))
    return new Response('blocked in test', { status: 599 })
  }) as typeof fetch
  return urls
}

const post = (route: string, body: unknown, headers: Record<string, string> = {}) =>
  realFetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

const generateBody = {
  params: { brandName: 'Studio Teste', segment: 'beleza', city: 'São Paulo', about: 'Salão de beleza com foco em cabelo.', topics: 'hidratação, corte' },
  version: 1,
}

test('health reports status and version', async () => {
  const res = await realFetch(`${base}/api/health`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.status, 'ok')
  assert.equal(typeof body.version, 'string')
  assert.ok(body.version.length > 0)
  assert.equal(body.version, config.version)
})

test('every API answer carries an X-Request-Id; a sane incoming id is kept', async () => {
  const res = await realFetch(`${base}/api/nope`)
  assert.equal(res.status, 404)
  assert.match(res.headers.get('x-request-id') || '', /^[\w-]{8,64}$/)

  const kept = await realFetch(`${base}/api/health`, { headers: { 'X-Request-Id': 'client-req-12345' } })
  assert.equal(kept.headers.get('x-request-id'), 'client-req-12345')

  const unsafe = await realFetch(`${base}/api/health`, { headers: { 'X-Request-Id': 'bad id with spaces' } })
  assert.notEqual(unsafe.headers.get('x-request-id'), 'bad id with spaces')
})

test('each request writes one JSON log line without secrets or query strings', async () => {
  config.logRequests = true
  config.adminToken = 'super-secret-admin-token'
  const lines: string[] = []
  const origLog = console.log
  console.log = (...args: unknown[]) => void lines.push(args.map(String).join(' '))
  try {
    await realFetch(`${base}/api/admin/metrics?days=7`, { headers: { Authorization: 'Bearer super-secret-admin-token' } })
  } finally {
    console.log = origLog
  }
  const apiLines = lines.filter((l) => l.startsWith('{'))
  assert.equal(apiLines.length, 1)
  const entry = JSON.parse(apiLines[0])
  assert.equal(entry.method, 'GET')
  assert.equal(entry.path, '/api/admin/metrics')
  assert.equal(entry.status, 200)
  assert.equal(typeof entry.ms, 'number')
  assert.equal(typeof entry.requestId, 'string')
  assert.ok(!apiLines[0].includes('super-secret'))
  assert.ok(!apiLines[0].includes('days=7'))
})

test('POST /api/generate-image is rate limited (429)', async () => {
  config.limits.generateImagePerHour = 2
  const body = { prompt: 'salão de beleza', segment: 'beleza' }
  assert.equal((await post('/api/generate-image', body)).status, 200)
  assert.equal((await post('/api/generate-image', body)).status, 200)
  const limited = await post('/api/generate-image', body)
  assert.equal(limited.status, 429)
  assert.match((await limited.json()).error, /Limite de uso atingido/)
})

test('POST /api/generate is rate limited (429)', async () => {
  config.limits.generatePerHour = 1
  config.ai.provider = 'none' // template engine: no network
  assert.equal((await post('/api/generate', generateBody)).status, 200)
  assert.equal((await post('/api/generate', generateBody)).status, 429)
})

test('admin metrics: 401 with ?token=, 401 without credentials, 200 with the Bearer header', async () => {
  config.adminToken = 'test-admin-token-value'
  const viaQuery = await realFetch(`${base}/api/admin/metrics?token=test-admin-token-value`)
  assert.equal(viaQuery.status, 401)
  const anonymous = await realFetch(`${base}/api/admin/metrics`)
  assert.equal(anonymous.status, 401)
  const wrong = await realFetch(`${base}/api/admin/metrics`, { headers: { Authorization: 'Bearer nope' } })
  assert.equal(wrong.status, 401)
  const ok = await realFetch(`${base}/api/admin/metrics`, { headers: { Authorization: 'Bearer test-admin-token-value' } })
  assert.equal(ok.status, 200)
  assert.equal(typeof (await ok.json()).generations, 'number')
})

test('admin metrics: 404 when ADMIN_TOKEN is not configured', async () => {
  config.adminToken = ''
  assert.equal((await realFetch(`${base}/api/admin/metrics`)).status, 404)
})

test('status: details need the Bearer header in production, not ?token=', async () => {
  config.isProd = true
  config.adminToken = 'test-admin-token-value'
  const viaQuery = await (await realFetch(`${base}/api/status?token=test-admin-token-value`)).json()
  assert.equal(viaQuery.provider, undefined)
  const viaHeader = await (await realFetch(`${base}/api/status`, { headers: { Authorization: 'Bearer test-admin-token-value' } })).json()
  assert.ok('provider' in viaHeader)
})

test('daily text cap reached: generate answers with the template engine, without calling the AI', async () => {
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  config.limits.dailyMaxText = 0
  const urls = forbidAiNetwork()
  const res = await post('/api/generate', generateBody)
  assert.equal(res.status, 200)
  const { generation } = await res.json()
  assert.equal(generation.engine, 'template')
  assert.equal(generation.model, 'midflow-templates')
  assert.match(generation.aiError, /Limite diário/)
  assert.equal(generation.posts.length, 4)
  assert.equal(generation.stories.length, 4)
  assert.deepEqual(urls, [])
})

test('daily rewrite cap reached: rewrite answers with the template engine, without calling the AI', async () => {
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  config.limits.dailyMaxRewrite = 0
  const urls = forbidAiNetwork()
  const res = await post('/api/rewrite', {
    creative: { headline: 'Hidratação profunda', cta: 'Agendar', caption: 'Legenda' },
    mode: 'curto',
    brandName: 'Studio Teste',
    segment: 'beleza',
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.engine, 'template')
  assert.equal(body.aiErrorKind, 'daily_cap')
  assert.equal(body.retryable, false)
  assert.equal(typeof body.data.headline, 'string')
  assert.deepEqual(urls, [])
})

test('the text and rewrite budgets are separate: an exhausted text cap does not stop rewrites, and rewrites do not eat the text cap', async () => {
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
  config.limits.dailyMaxText = 1
  config.limits.dailyMaxRewrite = 100
  config.limits.dailyMaxRewritePerUser = 100
  const urls = forbidAiNetwork() // every provider call fails (599) → transient, but it did reach the provider
  const rewrite = { creative: { headline: 'Hidratação profunda', cta: 'Agendar', caption: 'Legenda' }, mode: 'curto', brandName: 'Studio Teste', segment: 'beleza' }
  for (let i = 0; i < 3; i++) await post('/api/rewrite', rewrite)
  const reachedByRewrites = urls.length
  assert.ok(reachedByRewrites >= 3, 'rewrites kept reaching the provider')
  await post('/api/generate', generateBody)
  assert.ok(urls.length > reachedByRewrites, 'generate still had its text budget')
})

test('daily image cap reached: /api/image serves the fallback, not an AI image', async () => {
  config.image.provider = 'cloudflare'
  config.image.cfAccountId = 'acc'
  config.image.cfApiToken = 'tok'
  config.limits.dailyMaxImages = 0
  const urls = forbidAiNetwork()
  const res = await realFetch(`${base}/api/image?ai=1&type=ilustracoes&segment=beleza&seed=4242&prompt=daily-cap-test`)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('x-midflow-image-ai'), '0')
  assert.ok((await res.arrayBuffer()).byteLength > 0)
  assert.deepEqual(urls.filter((u) => u.includes('cloudflare.com') || u.includes('googleapis.com')), [])
})

test('feedback comments are truncated and contact details are redacted before they are stored', async () => {
  const comment = `Adorei! Falem comigo em maria@exemplo.com ou +55 (11) 91234-5678. ${'x'.repeat(900)}`
  const res = await post('/api/feedback', { rating: 5, comment, generationId: 'gen_1', brandName: 'Studio Teste', engine: 'template' })
  assert.equal(res.status, 200)
  const stored = fs
    .readFileSync(eventsFile, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .find((e) => e.type === 'feedback')
  assert.ok(stored)
  assert.ok(stored.comment.length <= 500)
  assert.ok(!stored.comment.includes('maria@exemplo.com'))
  assert.ok(!stored.comment.includes('91234'))
  assert.match(stored.comment, /\[email\]/)
})

test('scrubText caps the length', () => {
  assert.equal(scrubText('a'.repeat(1000), 500).length, 500)
})

test('event log retention drops old events and keeps recent ones', () => {
  const file = path.join(tmpDir, 'retention.jsonl')
  const now = Date.now()
  const day = 86_400_000
  fs.writeFileSync(
    file,
    [
      { type: 'download', at: now - 120 * day },
      { type: 'download', at: now - 91 * day },
      { type: 'download', at: now - 10 * day },
      { type: 'edit', at: now },
    ]
      .map((e) => JSON.stringify(e))
      .join('\n') + '\n',
  )
  assert.equal(pruneEvents(90, now, file), 2)
  const left = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean)
  assert.equal(left.length, 2)
  assert.equal(pruneEvents(90, now, file), 0)
  assert.equal(pruneEvents(0, now, file), 0) // 0 = keep everything
  logEvent({ type: 'save' }) // the real (temp) log keeps working
})
