import assert from 'node:assert/strict'
import { test } from 'node:test'
import { doStore, isSharedKey, nextWindow, type CounterNamespace, type StoredWindow } from '../../worker/counterCore.ts'

/** A fake Durable Object namespace: one serialized counter per name, using the same logic as worker/counter.ts. */
function fakeNamespace() {
  const state = new Map<string, StoredWindow>()
  const ns: CounterNamespace & { failing: boolean; ids: string[] } = {
    failing: false,
    ids: [],
    idFromName(name) {
      ns.ids.push(name)
      return name
    },
    get(id) {
      return {
        hit: async (windowMs) => {
          if (ns.failing) throw new Error('do unavailable')
          const next = nextWindow(state.get(id as string), windowMs, 1_000)
          state.set(id as string, next)
          return next
        },
      }
    },
  }
  return ns
}

test('nextWindow opens, increments and rolls over', () => {
  const w1 = nextWindow(undefined, 1000, 5000)
  assert.deepEqual(w1, { count: 1, resetAt: 6000 })
  assert.deepEqual(nextWindow(w1, 1000, 5500), { count: 2, resetAt: 6000 })
  assert.deepEqual(nextWindow(w1, 1000, 6000), { count: 1, resetAt: 7000 })
})

test('only daily budget keys are shared; per-IP keys stay in memory', async () => {
  assert.equal(isSharedKey('daily:text:2026-11-03'), true)
  assert.equal(isSharedKey('generate:1.2.3.4'), false)
  const ns = fakeNamespace()
  const store = doStore(ns)
  await store.hit('generate:1.2.3.4', 60_000, Date.now())
  assert.deepEqual(ns.ids, [])
  const hit = await store.hit('daily:text:2026-11-03', 86_400_000, Date.now())
  assert.equal(hit.count, 1)
  assert.deepEqual(ns.ids, ['daily:text:2026-11-03'])
})

test('two stores sharing one namespace (two isolates) count together', async () => {
  const ns = fakeNamespace()
  const a = doStore(ns)
  const b = doStore(ns)
  const results = await Promise.all([a.hit('daily:image:d', 1000, 0), b.hit('daily:image:d', 1000, 0), a.hit('daily:image:d', 1000, 0)])
  assert.deepEqual(results.map((r) => r.count).sort(), [1, 2, 3])
})

test('an unavailable Durable Object degrades to the local counter instead of failing', async () => {
  const ns = fakeNamespace()
  ns.failing = true
  const store = doStore(ns)
  const first = await store.hit('daily:text:d', 1000, 10)
  const second = await store.hit('daily:text:d', 1000, 20)
  assert.equal(first.count, 1)
  assert.equal(second.count, 2)
})
