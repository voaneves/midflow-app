import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLocalAuth, createLocalRepository } from '../../src/lib/backend/local.ts'
import { createSync, type SyncState } from '../../src/lib/backend/sync.ts'
import type { Backend, Repository } from '../../src/lib/backend/types.ts'
import type { Brand, LibraryItem } from '../../src/lib/types.ts'

const brand = (id: string, name = id): Brand => ({ id, name, handle: id, segment: 'beleza', city: '', about: '', audience: '', colors: [], tones: [], style: 'moderno' })
const lib = (id: string) => ({ id, savedAt: 1 }) as unknown as LibraryItem

function fakeStore(initial: Partial<SyncState>) {
  let state: SyncState = { user: { id: 'u1' }, brands: [], brand: brand('x'), library: [], plan: 'start', used: 0, ...initial }
  const listeners = new Set<(s: SyncState, p: SyncState) => void>()
  return {
    getState: () => state,
    setState: (p: Partial<SyncState>) => {
      const prev = state
      state = { ...state, ...p }
      listeners.forEach((l) => l(state, prev))
    },
    subscribe: (l: (s: SyncState, p: SyncState) => void) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
  }
}

function fakeBackend(remote: { brands?: Brand[]; library?: LibraryItem[]; plan?: { plan: 'pro'; used: number; status: string } }) {
  const log: string[] = []
  const repo: Repository = {
    ...createLocalRepository(),
    kind: 'supabase',
    listBrands: async () => remote.brands ?? [],
    listLibrary: async () => remote.library ?? [],
    getPlanUsage: async () => remote.plan ?? null,
    upsertBrands: async (b) => void (b.length && log.push(`upsertBrands:${b.map((x) => x.id).join(',')}`)),
    deleteBrands: async (ids) => void (ids.length && log.push(`deleteBrands:${ids.join(',')}`)),
    upsertLibrary: async (i) => void (i.length && log.push(`upsertLibrary:${i.map((x) => x.id).join(',')}`)),
    deleteLibrary: async (ids) => void (ids.length && log.push(`deleteLibrary:${ids.join(',')}`)),
  }
  const backend: Backend = { kind: 'supabase', auth: createLocalAuth(), repo }
  return { log, getBackend: async () => backend }
}

const opts = { demoBrandIds: ['brand_aurora'], debounceMs: 5 }

test('hydrate replaces local data with remote data and loads the plan', async () => {
  const store = fakeStore({ brands: [brand('brand_aurora')] })
  const { getBackend, log } = fakeBackend({ brands: [brand('b1')], library: [lib('l1')], plan: { plan: 'pro', used: 7, status: 'active' } })
  const sync = createSync(store, getBackend, opts)
  await sync.hydrate('u1')
  assert.deepEqual(store.getState().brands.map((b) => b.id), ['b1'])
  assert.deepEqual(store.getState().library.map((l) => l.id), ['l1'])
  assert.equal(store.getState().plan, 'pro')
  assert.equal(store.getState().used, 7)
  assert.deepEqual(log, [], 'nothing is uploaded when the remote already has data')
})

test('hydrate uploads local data once when the account is empty, but never the demo brand', async () => {
  const mine = fakeStore({ brands: [brand('b9')], library: [lib('l9')] })
  const a = fakeBackend({})
  await createSync(mine, a.getBackend, opts).hydrate('u1')
  assert.deepEqual(a.log, ['upsertBrands:b9', 'upsertLibrary:l9'])

  const demo = fakeStore({ brands: [brand('brand_aurora')], library: [lib('seed1')] })
  const b = fakeBackend({})
  await createSync(demo, b.getBackend, opts).hydrate('u1')
  assert.deepEqual(b.log, [])
})

test('changes after hydrate are pushed as a debounced diff; unchanged items are skipped', async () => {
  const b1 = brand('b1')
  const store = fakeStore({ brands: [b1], library: [lib('l1')] })
  const { getBackend, log } = fakeBackend({ brands: [b1], library: store.getState().library })
  const sync = createSync(store, getBackend, opts)
  const stop = sync.start()
  await sync.hydrate('u1')

  store.setState({ brands: [b1, brand('b2')], library: [] })
  store.setState({ brands: [b1, brand('b2', 'renamed')] })
  await new Promise((r) => setTimeout(r, 40))
  assert.deepEqual(log, ['upsertBrands:b2', 'deleteLibrary:l1'])
  stop()
})

test('demo sessions and signed-out state never sync', async () => {
  const store = fakeStore({ user: { id: undefined }, brands: [brand('b1')] })
  const { getBackend, log } = fakeBackend({})
  const sync = createSync(store, getBackend, opts)
  const stop = sync.start()
  store.setState({ brands: [brand('b1'), brand('b2')] })
  await new Promise((r) => setTimeout(r, 30))
  await sync.flush()
  assert.deepEqual(log, [])
  stop()
})

test('the local adapter accepts any credentials and its repository is a no-op', async () => {
  const auth = createLocalAuth()
  const seen: (string | null)[] = []
  const off = auth.onChange((s) => seen.push(s?.user.email ?? null))
  const res = await auth.signIn({ email: 'ana@example.com', password: 'x' })
  assert.equal(res.ok && res.session?.user.name, 'ana')
  assert.equal((await auth.getSession())?.accessToken, null)
  await auth.signOut()
  assert.equal(await auth.getSession(), null)
  assert.deepEqual(seen, ['ana@example.com', null])
  off()
  assert.deepEqual(await createLocalRepository().listBrands(), [])
})
