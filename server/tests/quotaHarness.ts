/**
 * Shared setup for the quota / anonymous-AI tests: the real route handler on a local port, with Supabase and
 * Stripe replaced by the in-memory fake. Call `setupHarness()` once at the top of a test file.
 */
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, before, beforeEach } from 'node:test'
import { createFakeBackend } from './fakeBackend.ts'
import { fakeGeminiFetch } from './fakeGemini.ts'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'midflow-quota-'))
process.env.EVENTS_FILE = path.join(tmpDir, 'events.jsonl') // must be set before telemetry.ts loads

const SERVER_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_JWT_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'ANON_AI', 'IMAGE_URL_SECRET']
for (const n of SERVER_ENV) delete process.env[n]

const { config } = await import('../config.ts')
const { setRateLimitStore } = await import('../http.ts')
const { handleApiRequest } = await import('../routes.ts')
const { signHs256Jwt } = await import('../auth.ts')
const { clearStaffCache } = await import('../authz.ts')
const { resetAiPrune } = await import('../aihealth.ts')

export { config }
export const be = createFakeBackend()
export const realFetch = globalThis.fetch
export const JWT_SECRET = 'test-jwt-secret-value'
export const ids = {
  customer: '33333333-3333-4333-8333-333333333333',
  other: '44444444-4444-4444-8444-444444444444',
}
export const period = () => new Date().toISOString().slice(0, 7)

export const generateBody = {
  params: { brandName: 'Studio Teste', segment: 'beleza', city: 'São Paulo', about: 'Salão de beleza com foco em cabelo.', topics: 'hidratação, corte' },
  version: 1,
}

export function enableSupabase() {
  process.env.SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET
}

export const tokenFor = (sub: string) =>
  signHs256Jwt({ sub, email: `${sub.slice(0, 4)}@example.com`, aud: 'authenticated', role: 'authenticated', iss: 'https://fake.supabase.co/auth/v1', exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET)

/** Pretends a paid AI provider is configured; its HTTP calls hit the fake and are recorded in `be.calls` (answered 599). */
export function enableGemini() {
  config.ai.provider = 'gemini'
  config.ai.geminiKey = 'test-key'
}

/** A model that answers: generate returns an AI-delivered pack for generateBody (the only content that is charged), rewrite an AI rewrite. */
export function deliverAiPacks() {
  enableGemini()
  globalThis.fetch = fakeGeminiFetch(be.fetch, generateBody.params)
}

export let base = ''

export async function call(method: string, route: string, opts: { body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  let body: string | undefined
  if (opts.body !== undefined) {
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
  return { status: res.status, json, headers: res.headers }
}

export const aiCalls = () => be.calls.filter((c) => c.includes('googleapis'))

export function setupHarness() {
  let server: http.Server
  const real = {
    provider: config.ai.provider,
    geminiKey: config.ai.geminiKey,
    maxRetries: config.ai.maxRetries,
    fallbackModels: config.ai.fallbackModels,
    limits: { ...config.limits },
    logRequests: config.logRequests,
    isProd: config.isProd,
    imageProvider: config.image.provider,
  }

  before(async () => {
    globalThis.fetch = be.fetch // server-side fetches go to the fake; the test client keeps realFetch
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
    globalThis.fetch = be.fetch
    setRateLimitStore()
    clearStaffCache()
    resetAiPrune()
    be.reset()
    config.logRequests = false
    config.isProd = false
    config.ai.provider = 'none'
    config.ai.maxRetries = 0
    config.ai.fallbackModels = []
    // Per-IP hourly limits are not what these tests exercise.
    config.limits.generatePerHour = 1000
    config.limits.rewritePerHour = 1000
    config.limits.generateImagePerHour = 1000
    for (const n of SERVER_ENV) delete process.env[n]
  })

  afterEach(() => {
    config.ai.provider = real.provider
    config.ai.geminiKey = real.geminiKey
    config.ai.maxRetries = real.maxRetries
    config.ai.fallbackModels = real.fallbackModels
    Object.assign(config.limits, real.limits)
    config.logRequests = real.logRequests
    config.isProd = real.isProd
    config.image.provider = real.imageProvider
  })
}
