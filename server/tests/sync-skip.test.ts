import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RepoError } from '../../src/lib/backend/errors.ts'
import { createLocalAuth, createLocalRepository } from '../../src/lib/backend/local.ts'
import { createSync, type SyncState } from '../../src/lib/backend/sync.ts'
import type { Backend, Repository } from '../../src/lib/backend/types.ts'
import type { Brand, LibraryItem } from '../../src/lib/types.ts'

const brand = (id: string): Brand => ({ id, name: id, handle: id, segment: 'beleza', city: '', about: '', audience: '', colors: [], tones: [], style: 'moderno' })
const lib = (id: string) => ({ id, savedAt: 1 }) as unknown as LibraryItem

function fakeStore(initial: Partial<SyncState>) {
  let state: SyncState = { user: { id: 'u1' }, brands: [], brand: brand('x'), library: [], plan: 'start', used: 0, ...initial }
  return {
    getState: () => state,
    setState: (p: Partial<SyncState>) => void (state = { ...state, ...p }),
    subscribe: () => () => {},
  }
}

/** A repository that stores rows, but rejects any batch containing a row listed in `bad` (with the given SQLSTATE). */
function backendRejecting(bad: Record<string, string>, transientFail = new Set<string>()) {
  const saved = new Set<string>()
  const calls: string[][] = []
  const check = (ids: string[]) => {
    calls.push(ids)
    for (const id of ids) {
      if (bad[id]) throw new RepoError('new row violates check constraint', bad[id])
      if (transientFail.has(id)) throw new RepoError('network down')
    }
  }
  const repo: Repository = {
    ...createLocalRepository(),
    kind: 'supabase',
    upsertLibrary: async (items) => {
      check(items.map((i) => i.id))
      items.forEach((i) => saved.add(i.id))
    },
    upsertBrands: async (items) => {
      check(items.map((i) => i.id ?? ''))
      items.forEach((i) => saved.add(i.id ?? ''))
    },
  }
  const backend: Backend = { kind: 'supabase', auth: createLocalAuth(), repo }
  return { saved, calls, getBackend: async () => backend }
}

async function started(store: ReturnType<typeof fakeStore>, getBackend: () => Promise<Backend>, onRowsSkipped: () => void) {
  const sync = createSync(store, getBackend, { demoBrandIds: [], debounceMs: 5, onRowsSkipped })
  await sync.hydrate('u1') // empty remote + own data: uploads once through flush()
  return sync
}

test('a row refused with 23514 is skipped; the rest of the batch still syncs and the user is told once', async () => {
  const store = fakeStore({ brands: [brand('b1')], library: [lib('l1'), lib('huge'), lib('l3')] })
  const { saved, getBackend } = backendRejecting({ huge: '23514' })
  let notices = 0
  const sync = await started(store, getBackend, () => notices++)
  assert.deepEqual([...saved].sort(), ['b1', 'l1', 'l3'])
  assert.equal(notices, 1)

  // Later changes keep syncing and the refused row is not retried (nor announced again) until it changes.
  store.setState({ library: [...store.getState().library, lib('l4')] })
  await sync.flush()
  assert.ok(saved.has('l4'))
  assert.equal(notices, 1)
})

test('54000 (row limit) is treated like a check violation', async () => {
  const store = fakeStore({ brands: [brand('b1')], library: [lib('big'), lib('ok')] })
  const { saved, getBackend } = backendRejecting({ big: '54000' })
  let notices = 0
  await started(store, getBackend, () => notices++)
  assert.deepEqual([...saved].sort(), ['b1', 'ok'])
  assert.equal(notices, 1)
})

test('a transient failure keeps the row dirty and is retried on the next flush without a notice', async () => {
  const flaky = new Set(['l2'])
  const store = fakeStore({ brands: [brand('b1')], library: [lib('l1'), lib('l2')] })
  const { saved, getBackend } = backendRejecting({}, flaky)
  let notices = 0
  const sync = await started(store, getBackend, () => notices++)
  assert.deepEqual([...saved].sort(), ['b1', 'l1'])
  flaky.clear()
  await sync.flush()
  assert.deepEqual([...saved].sort(), ['b1', 'l1', 'l2'])
  assert.equal(notices, 0)
})

test('an edited row that was refused is sent again', async () => {
  const bad: Record<string, string> = { l1: '23514' }
  const store = fakeStore({ brands: [brand('b1')], library: [lib('l1')] })
  const { saved, getBackend } = backendRejecting(bad)
  const sync = await started(store, getBackend, () => {})
  assert.deepEqual([...saved], ['b1'])
  delete bad.l1
  store.setState({ library: [{ ...lib('l1'), savedAt: 2 }] })
  await sync.flush()
  assert.deepEqual([...saved].sort(), ['b1', 'l1'])
})
