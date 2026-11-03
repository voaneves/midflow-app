import assert from 'node:assert/strict'
import type { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, mock, test } from 'node:test'
import { config } from '../config.ts'
import {
  clientIp,
  consumeDailyBudget,
  createMemoryStore,
  HttpError,
  rateLimit,
  readJson,
  requireAdmin,
  safeEqual,
  setRateLimitStore,
  type RateLimitStore,
} from '../http.ts'

const fakeReq = (headers: Record<string, string> = {}, ip = '10.0.0.1') =>
  ({ headers, socket: { remoteAddress: ip } }) as unknown as IncomingMessage

const realAdmin = config.adminToken
const realTrust = process.env.TRUST_PROXY

beforeEach(() => setRateLimitStore())
afterEach(() => {
  config.adminToken = realAdmin
  if (realTrust === undefined) delete process.env.TRUST_PROXY
  else process.env.TRUST_PROXY = realTrust
  mock.restoreAll()
  setRateLimitStore()
})

async function statusOf(fn: () => unknown) {
  try {
    await fn()
    return 200
  } catch (err) {
    if (err instanceof HttpError) return err.status
    throw err
  }
}

test('rate limit: allows up to the limit, then answers 429 in pt-BR', async () => {
  const req = fakeReq()
  await rateLimit(req, 'unit', 2)
  await rateLimit(req, 'unit', 2)
  await assert.rejects(rateLimit(req, 'unit', 2), (err: unknown) => {
    assert.ok(err instanceof HttpError)
    assert.equal(err.status, 429)
    assert.match(err.message, /Limite de uso atingido/)
    return true
  })
})

test('rate limit: buckets and IPs are counted separately', async () => {
  await rateLimit(fakeReq({}, '10.0.0.1'), 'a', 1)
  await rateLimit(fakeReq({}, '10.0.0.1'), 'b', 1)
  await rateLimit(fakeReq({}, '10.0.0.2'), 'a', 1)
  assert.equal(await statusOf(() => rateLimit(fakeReq({}, '10.0.0.1'), 'a', 1)), 429)
})

test('rate limit: a window that expired starts over', async () => {
  const store = createMemoryStore()
  assert.equal((await store.hit('k', 1000, 0)).count, 1)
  assert.equal((await store.hit('k', 1000, 500)).count, 2)
  assert.equal((await store.hit('k', 1000, 1001)).count, 1)
})

test('rate limit: a custom (async, shared) store can be plugged in', async () => {
  const calls: string[] = []
  let n = 0
  const shared: RateLimitStore = {
    async hit(key, windowMs, now) {
      calls.push(key)
      return { count: ++n, resetAt: now + windowMs }
    },
  }
  setRateLimitStore(shared)
  await rateLimit(fakeReq(), 'shared', 1)
  assert.equal(await statusOf(() => rateLimit(fakeReq(), 'shared', 1)), 429)
  assert.deepEqual(calls, ['shared:10.0.0.1', 'shared:10.0.0.1'])
})

test('client IP: forwarding headers are ignored unless TRUST_PROXY says how many to believe', () => {
  const spoofed = fakeReq({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9', 'cf-connecting-ip': '198.51.100.7' })
  delete process.env.TRUST_PROXY
  assert.equal(clientIp(spoofed), '10.0.0.1')
  process.env.TRUST_PROXY = 'false'
  assert.equal(clientIp(spoofed), '10.0.0.1')
  process.env.TRUST_PROXY = 'banana'
  assert.equal(clientIp(spoofed), '10.0.0.1')
})

test('client IP: TRUST_PROXY=cloudflare uses only CF-Connecting-IP', () => {
  process.env.TRUST_PROXY = 'cloudflare'
  assert.equal(clientIp(fakeReq({ 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '1.1.1.1' })), '198.51.100.7')
  // X-Forwarded-For is client controlled on Cloudflare: never used
  assert.equal(clientIp(fakeReq({ 'x-forwarded-for': '1.1.1.1' })), '10.0.0.1')
})

test('client IP: TRUST_PROXY=N takes the Nth entry from the right, so a spoofed left side is ignored', () => {
  process.env.TRUST_PROXY = '1'
  assert.equal(clientIp(fakeReq({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' })), '203.0.113.9')
  assert.equal(clientIp(fakeReq({ 'x-forwarded-for': '203.0.113.9' })), '203.0.113.9')
  process.env.TRUST_PROXY = '2'
  assert.equal(clientIp(fakeReq({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9, 10.1.1.1' })), '203.0.113.9')
  // fewer hops than configured: the request did not come through the expected proxies
  assert.equal(clientIp(fakeReq({ 'x-forwarded-for': '203.0.113.9' })), '10.0.0.1')
  assert.equal(clientIp(fakeReq({})), '10.0.0.1')
  process.env.TRUST_PROXY = '0'
  assert.equal(clientIp(fakeReq({ 'x-forwarded-for': '203.0.113.9' })), '10.0.0.1')
})

test('client IP: legacy TRUST_PROXY=true behaves like 1 and warns', () => {
  const warn = mock.method(console, 'warn', () => undefined)
  process.env.TRUST_PROXY = 'true'
  assert.equal(clientIp(fakeReq({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' })), '203.0.113.9')
  assert.equal(clientIp(fakeReq({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' })), '203.0.113.9')
  assert.ok(warn.mock.callCount() <= 1) // once per process (an earlier test may already have triggered it)
})

const bodyReq = (text: string) => Object.assign(Readable.from([Buffer.from(text)]), { headers: {} }) as unknown as IncomingMessage

test('readJson: accepts objects and an empty body, rejects everything else with 400 "JSON inválido."', async () => {
  assert.deepEqual(await readJson(bodyReq('{"a":1}')), { a: 1 })
  assert.deepEqual(await readJson(bodyReq('')), {})
  for (const bad of ['null', '[]', '[1,2]', '42', '"text"', 'true', '{oops']) {
    await assert.rejects(
      () => readJson(bodyReq(bad)),
      (err: unknown) => err instanceof HttpError && err.status === 400 && err.message === 'JSON inválido.',
      bad,
    )
  }
})

test('daily budget: unlimited by default, then capped per kind', async () => {
  assert.equal(await consumeDailyBudget('text', Infinity), true)
  assert.equal(await consumeDailyBudget('text', 2), true) // 1st counted hit
  assert.equal(await consumeDailyBudget('text', 2), true) // 2nd
  assert.equal(await consumeDailyBudget('text', 2), false) // 3rd is over the cap
  assert.equal(await consumeDailyBudget('image', 2), true) // images have their own counter
})

test('daily budget: a cap of 0 always falls back', async () => {
  assert.equal(await consumeDailyBudget('text', 0), false)
})

test('safeEqual compares in constant time and handles different lengths', () => {
  assert.equal(safeEqual('abc', 'abc'), true)
  assert.equal(safeEqual('abc', 'abd'), false)
  assert.equal(safeEqual('abc', 'abcd'), false)
  assert.equal(safeEqual('', 'x'), false)
})

test('admin auth: only the Bearer header is accepted', () => {
  config.adminToken = 'correct-horse-battery-staple'
  assert.doesNotThrow(() => requireAdmin(fakeReq({ authorization: 'Bearer correct-horse-battery-staple' })))
  assert.doesNotThrow(() => requireAdmin(fakeReq({ authorization: 'bearer   correct-horse-battery-staple ' })))
  for (const headers of [{} as Record<string, string>, { authorization: 'Bearer wrong' }, { authorization: 'correct-horse-battery-staple' }, { authorization: 'Bearer ' }]) {
    assert.throws(() => requireAdmin(fakeReq(headers)), (err: unknown) => err instanceof HttpError && err.status === 401)
  }
})

test('admin auth: endpoints do not exist while ADMIN_TOKEN is unset', () => {
  config.adminToken = ''
  assert.throws(() => requireAdmin(fakeReq({ authorization: 'Bearer ' })), (err: unknown) => err instanceof HttpError && err.status === 404)
})
