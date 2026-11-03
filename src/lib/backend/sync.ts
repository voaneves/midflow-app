import type { Brand, LibraryItem, PlanId } from '../types.ts'
import { isPermanentRowError } from './errors.ts'
import type { Backend } from './types.ts'

/** The slice of app state that is mirrored to the repository. */
export interface SyncState {
  user: { id?: string } | null
  brands: Brand[]
  brand: Brand
  library: LibraryItem[]
  plan: PlanId
  used: number
}

export interface SyncStore<S extends SyncState> {
  getState: () => S
  setState: (partial: Partial<S>) => void
  subscribe: (listener: (s: S, prev: S) => void) => () => void
}

export interface SyncOptions {
  /** Brands with these ids are demo data and never uploaded. */
  demoBrandIds: string[]
  debounceMs?: number
  /** Called after remote data replaced the local copy, so the store can rebuild derived drafts. */
  onRemoteBrands?: (brands: Brand[]) => void
  /** The auth session ended elsewhere (expired, signed out in another tab). */
  onSessionEnded?: () => void
  /** Rows the backend permanently refuses (size/check limits). Called at most once per sync instance, i.e. once per session. */
  onRowsSkipped?: () => void
}

const keyOf = (b: Brand) => b.id ?? b.name

/**
 * Keeps brands and library in sync with the repository for the signed-in user.
 * - hydrate(): remote wins when it has data; otherwise local data is uploaded once.
 * - afterwards every store change is pushed (debounced) as an upsert/delete diff.
 * Demo sessions (no user.id) never sync.
 */
export function createSync<S extends SyncState>(store: SyncStore<S>, getBackend: () => Promise<Backend>, opts: SyncOptions) {
  const debounceMs = opts.debounceMs ?? 1500
  let syncedUser: string | null = null
  let hydrating: Promise<void> | null = null
  const sentBrands = new Map<string, Brand>()
  const sentLibrary = new Map<string, LibraryItem>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let skippedNotified = false

  const isDemoOnly = (brands: Brand[]) => brands.every((b) => opts.demoBrandIds.includes(b.id ?? ''))
  const remember = (brands: Brand[], library: LibraryItem[]) => {
    sentBrands.clear()
    sentLibrary.clear()
    brands.forEach((b) => sentBrands.set(keyOf(b), b))
    library.forEach((l) => sentLibrary.set(l.id, l))
  }

  async function flush() {
    const s = store.getState()
    const uid = s.user?.id
    if (!uid || syncedUser !== uid) return
    const { repo } = await getBackend()
    const brands = s.brands.filter((b) => !opts.demoBrandIds.includes(b.id ?? ''))
    const dirtyBrands = brands.filter((b) => sentBrands.get(keyOf(b)) !== b)
    const goneBrands = [...sentBrands.keys()].filter((id) => !brands.some((b) => keyOf(b) === id))
    const dirtyLib = s.library.filter((l) => sentLibrary.get(l.id) !== l)
    const goneLib = [...sentLibrary.keys()].filter((id) => !s.library.some((l) => l.id === id))
    // Fast path: one request per table. On failure, retry row by row so one oversized row cannot block the rest.
    const push = async <T>(rows: T[], batch: (r: T[]) => Promise<void>, done: (r: T) => void) => {
      if (!rows.length) return
      try {
        await batch(rows)
        rows.forEach(done)
        return
      } catch (e) {
        if (rows.length === 1 && isPermanentRowError(e)) return skip(rows[0], done, e)
        if (rows.length === 1) return void console.warn('[MIDFLOW] Sincronização adiada:', e)
      }
      let transient = 0
      for (const row of rows) {
        try {
          await batch([row])
          done(row)
          transient = 0
        } catch (e) {
          if (isPermanentRowError(e)) skip(row, done, e)
          else {
            // Transient: the row stays dirty and is retried on the next change. Offline? Stop hammering after a few misses.
            console.warn('[MIDFLOW] Sincronização adiada:', e)
            if (++transient >= 3) return
          }
        }
      }
    }
    // A refused row is remembered as handled, so it is not re-sent until the user edits it (a new object).
    const skip = <T>(row: T, done: (r: T) => void, e: unknown) => {
      done(row)
      console.warn('[MIDFLOW] Item grande demais para sincronizar; mantido apenas neste navegador:', e)
      if (!skippedNotified) {
        skippedNotified = true
        opts.onRowsSkipped?.()
      }
    }
    await push(dirtyBrands, (r) => repo.upsertBrands(r), (b) => sentBrands.set(keyOf(b), b))
    await push(goneBrands, (r) => repo.deleteBrands(r), (id) => sentBrands.delete(id))
    await push(dirtyLib, (r) => repo.upsertLibrary(r), (l) => sentLibrary.set(l.id, l))
    await push(goneLib, (r) => repo.deleteLibrary(r), (id) => sentLibrary.delete(id))
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => void flush(), debounceMs)
  }

  async function refreshPlan() {
    const { repo } = await getBackend()
    const pu = await repo.getPlanUsage().catch(() => null)
    if (pu) store.setState({ plan: pu.plan, used: pu.used } as Partial<S>)
  }

  async function runHydrate(uid: string) {
    const { repo } = await getBackend()
    const [remoteBrands, remoteLibrary] = await Promise.all([repo.listBrands(), repo.listLibrary()])
    if (store.getState().user?.id !== uid) return // signed out or switched while loading
    if (remoteBrands.length) {
      store.setState({ brands: remoteBrands, brand: remoteBrands[0], library: remoteLibrary } as Partial<S>)
      opts.onRemoteBrands?.(remoteBrands)
      remember(remoteBrands, remoteLibrary)
    } else {
      const s = store.getState()
      const hasOwnData = !isDemoOnly(s.brands)
      remember([], [])
      if (hasOwnData) {
        syncedUser = uid
        await flush()
      }
    }
    syncedUser = uid
    await refreshPlan()
  }

  /** Idempotent per user; concurrent callers share the same run. */
  function hydrate(uid: string): Promise<void> {
    if (syncedUser === uid) return Promise.resolve()
    hydrating ??= runHydrate(uid)
      .catch((e) => console.warn('[MIDFLOW] Não foi possível carregar seus dados:', e))
      .finally(() => {
        hydrating = null
      })
    return hydrating
  }

  function stop() {
    clearTimeout(timer)
    syncedUser = null
    remember([], [])
  }

  /** Subscribes to store changes and to the auth provider. Returns a disposer. */
  function start(): () => void {
    const offStore = store.subscribe((s, prev) => {
      if (!s.user?.id) {
        if (prev.user?.id) stop()
        return
      }
      if (s.brands !== prev.brands || s.library !== prev.library) schedule()
    })
    let offAuth = () => {}
    let cancelled = false
    void getBackend().then(async ({ auth }) => {
      if (cancelled) return
      const session = await auth.getSession()
      const uid = store.getState().user?.id
      if (session && uid === session.user.id) void hydrate(session.user.id)
      else if (uid && !session) opts.onSessionEnded?.() // persisted login whose session expired
      offAuth = auth.onChange((next) => {
        if (!next && store.getState().user?.id) opts.onSessionEnded?.()
      })
    })
    return () => {
      cancelled = true
      offStore()
      offAuth()
      clearTimeout(timer)
    }
  }

  return { start, hydrate, flush, refreshPlan, stop }
}
