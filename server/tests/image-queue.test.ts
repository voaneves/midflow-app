import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createImageQueue, isAiImageUrl } from '../../src/lib/imageQueue.ts'

/** A loader whose calls are finished by hand, so the test controls the order. */
function manual() {
  const started: string[] = []
  const pending = new Map<string, { ok: () => void; fail: (e: Error) => void; signal: AbortSignal }>()
  let active = 0
  let maxActive = 0
  const load = (url: string, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      started.push(url)
      active++
      maxActive = Math.max(maxActive, active)
      const done = () => void active--
      signal.addEventListener('abort', () => {
        done()
        reject(signal.reason)
      })
      pending.set(url, {
        signal,
        ok: () => {
          done()
          resolve()
        },
        fail: (e) => {
          done()
          reject(e)
        },
      })
    })
  return { load, started, pending, maxActive: () => maxActive }
}
const tick = () => new Promise((r) => setTimeout(r, 0))
const u = (n: number) => `/api/image?ai=1&seed=${n}&sig=x`

test('isAiImageUrl only matches signed AI image URLs', () => {
  assert.equal(isAiImageUrl('/api/image?type=fotos&ai=1&sig=abc'), true)
  assert.equal(isAiImageUrl('https://x.dev/api/image?ai=1'), true)
  assert.equal(isAiImageUrl('/api/image?type=fotos&ai=0'), false)
  assert.equal(isAiImageUrl('/api/image?photo=salon&type=fotos'), false)
  assert.equal(isAiImageUrl('/api/image?ai=10'), false)
  assert.equal(isAiImageUrl('/assets/photo.jpg?ai=1'), false)
  assert.equal(isAiImageUrl(undefined), false)
})

test('loads strictly one at a time, in FIFO order', async () => {
  const m = manual()
  const q = createImageQueue({ load: m.load })
  const done = [1, 2, 3, 4].map((n) => q.load(u(n)))
  await tick()
  assert.deepEqual(m.started, [u(1)], 'only the first one started')
  for (let n = 1; n <= 4; n++) {
    m.pending.get(u(n))!.ok()
    await tick()
    assert.deepEqual(m.started, [1, 2, 3, 4].slice(0, Math.min(4, n + 1)).map(u))
  }
  await Promise.all(done)
  assert.equal(m.maxActive(), 1)
  assert.equal(q.size, 0)
  assert.ok(q.isReady(u(3)))
})

test('identical URLs share one load; a ready URL resolves without loading again', async () => {
  const m = manual()
  const q = createImageQueue({ load: m.load })
  const a = q.load(u(1))
  const b = q.load(u(1))
  await tick()
  m.pending.get(u(1))!.ok()
  await Promise.all([a, b])
  assert.deepEqual(m.started, [u(1)])
  await q.load(u(1))
  assert.deepEqual(m.started, [u(1)])
})

test('a failure rejects, is not remembered, and the queue moves on', async () => {
  const m = manual()
  const q = createImageQueue({ load: m.load })
  const first = q.load(u(1))
  const second = q.load(u(2))
  await tick()
  m.pending.get(u(1))!.fail(new Error('HTTP 502'))
  await assert.rejects(first, /HTTP 502/)
  await tick()
  assert.deepEqual(m.started, [u(1), u(2)])
  assert.equal(q.isReady(u(1)), false)
  m.pending.get(u(2))!.ok()
  await second
  // retrying the failed URL goes through the loader again
  const again = q.load(u(1))
  await tick()
  assert.deepEqual(m.started, [u(1), u(2), u(1)])
  m.pending.get(u(1))!.ok()
  await again
})

test('abort: a queued item leaves the line and is never loaded', async () => {
  const m = manual()
  const q = createImageQueue({ load: m.load })
  const running = q.load(u(1))
  const ctl = new AbortController()
  const dropped = q.load(u(2), ctl.signal)
  const last = q.load(u(3))
  await tick()
  ctl.abort()
  await assert.rejects(dropped, { name: 'AbortError' })
  assert.equal(q.size, 2)
  m.pending.get(u(1))!.ok()
  await running
  await tick()
  assert.deepEqual(m.started, [u(1), u(3)])
  m.pending.get(u(3))!.ok()
  await last
})

test('abort: an item already loading is aborted once nobody waits for it, and the next one starts', async () => {
  const m = manual()
  const q = createImageQueue({ load: m.load, abortGraceMs: 0 })
  const ctl = new AbortController()
  const a = q.load(u(1), ctl.signal)
  const next = q.load(u(2))
  await tick()
  ctl.abort()
  await assert.rejects(a, { name: 'AbortError' })
  await tick()
  await tick()
  assert.equal(m.pending.get(u(1))!.signal.aborted, true)
  assert.deepEqual(m.started, [u(1), u(2)])
  m.pending.get(u(2))!.ok()
  await next
})

test('abort: with two waiters on one URL, one leaving does not cancel it', async () => {
  const m = manual()
  const q = createImageQueue({ load: m.load, abortGraceMs: 0 })
  const ctl = new AbortController()
  const a = q.load(u(1), ctl.signal)
  const b = q.load(u(1))
  await tick()
  ctl.abort()
  await assert.rejects(a, { name: 'AbortError' })
  await tick()
  assert.equal(m.pending.get(u(1))!.signal.aborted, false)
  m.pending.get(u(1))!.ok()
  await b
})

test('an already aborted signal rejects at once', async () => {
  const m = manual()
  const q = createImageQueue({ load: m.load })
  const ctl = new AbortController()
  ctl.abort()
  await assert.rejects(q.load(u(1), ctl.signal), { name: 'AbortError' })
  assert.deepEqual(m.started, [])
})

test('an image that never answers is given up on after the timeout', async () => {
  const m = manual()
  const q = createImageQueue({ load: m.load, timeoutMs: 20 })
  const slow = q.load(u(1))
  const next = q.load(u(2))
  await assert.rejects(slow, /tempo limite/)
  await tick()
  assert.deepEqual(m.started, [u(1), u(2)])
  m.pending.get(u(2))!.ok()
  await next
})

test('settle waits for everything and never rejects (export path)', async () => {
  const m = manual()
  const q = createImageQueue({ load: m.load })
  const s = q.settle([u(1), u(1), u(2)])
  await tick()
  m.pending.get(u(1))!.fail(new Error('boom'))
  await tick()
  m.pending.get(u(2))!.ok()
  await s
  assert.deepEqual(m.started, [u(1), u(2)])
})
