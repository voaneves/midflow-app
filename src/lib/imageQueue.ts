/**
 * Loads AI card images (signed `/api/image?...&ai=1&sig=...` URLs) one at a time.
 *
 * A generated pack has ~8 cards and the browser would fetch all 8 URLs in parallel, which starts 8 Workers AI calls at once
 * and trips the provider's burst limit (HTTP 429). Here the URLs go through a FIFO queue with concurrency 1: each one is
 * fetched in full, so the response lands in the browser's HTTP cache (AI images are `immutable`, 30 days), and only then
 * does the <img> get its `src`. The <img> then renders from cache; it never triggers a second generation.
 *
 * - identical URLs share one load (dedupe);
 * - a load that nobody waits for any more (component unmounted) leaves the queue, or is aborted if already running;
 * - non-AI URLs (stock photos, catalog) never come through here: callers use them directly.
 *
 * No DOM or React in this file, so node can test it.
 */

export type ImageLoader = (url: string, signal: AbortSignal) => Promise<void>

export interface ImageQueueOptions {
  /** How many AI images load at the same time. */
  concurrency?: number
  load?: ImageLoader
  /** A single image that takes longer than this is given up on (the caller falls back to a stock photo). */
  timeoutMs?: number
  /** A running load nobody waits for is aborted after this long (absorbs React StrictMode's mount/unmount/mount). */
  abortGraceMs?: number
}

export interface ImageQueue {
  /** Resolves once `url` is in the browser cache; rejects on failure, timeout or abort. */
  load(url: string, signal?: AbortSignal): Promise<void>
  isReady(url: string): boolean
  /** Waits for every URL (failures included) and never rejects: used before exporting. */
  settle(urls: string[], signal?: AbortSignal): Promise<void>
  /** Queued + running loads. */
  readonly size: number
}

/** True for the signed AI image URLs that spend the paid image model. */
export function isAiImageUrl(url: string | undefined): boolean {
  return !!url && url.includes('/api/image') && /[?&]ai=1(?:&|$)/.test(url)
}

const abortError = () => new DOMException('Carregamento cancelado', 'AbortError')

/** Default loader: downloads the whole body so the HTTP cache holds it. Same credentials mode as `<img crossorigin="anonymous">`. */
const fetchIntoCache: ImageLoader = async (url, signal) => {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  await res.arrayBuffer()
}

interface Entry {
  url: string
  waiters: number
  started: boolean
  settled: boolean
  ctl: AbortController
  promise: Promise<void>
  resolve: () => void
  reject: (e: unknown) => void
  grace?: ReturnType<typeof setTimeout>
}

const READY_CAP = 500

export function createImageQueue(opts: ImageQueueOptions = {}): ImageQueue {
  const { concurrency = 1, load = fetchIntoCache, timeoutMs = 90_000, abortGraceMs = 1000 } = opts
  const entries = new Map<string, Entry>()
  const waiting: Entry[] = []
  const ready = new Set<string>()
  let running = 0

  const markReady = (url: string) => {
    if (ready.size >= READY_CAP) ready.delete(ready.values().next().value as string)
    ready.add(url)
  }

  function pump() {
    while (running < concurrency && waiting.length) {
      const e = waiting.shift()!
      running++
      e.started = true
      const timer = setTimeout(() => e.ctl.abort(new Error('tempo limite excedido')), timeoutMs)
      let run: Promise<void>
      try {
        run = load(e.url, e.ctl.signal)
      } catch (err) {
        run = Promise.reject(err)
      }
      run.then(
        () => {
          markReady(e.url)
          e.resolve()
        },
        (err) => e.reject(err),
      ).finally(() => {
        clearTimeout(timer)
        clearTimeout(e.grace)
        e.settled = true
        entries.delete(e.url)
        running--
        pump()
      })
    }
  }

  function release(e: Entry) {
    e.waiters--
    if (e.waiters > 0 || e.settled) return
    if (!e.started) {
      // Never started: drop it from the queue, nothing is generated.
      waiting.splice(waiting.indexOf(e), 1)
      e.settled = true
      entries.delete(e.url)
      e.reject(abortError())
      return
    }
    e.grace = setTimeout(() => {
      if (e.waiters === 0 && !e.settled) e.ctl.abort(abortError())
    }, abortGraceMs)
  }

  function enqueue(url: string, signal?: AbortSignal): Promise<void> {
    if (ready.has(url)) return Promise.resolve()
    if (signal?.aborted) return Promise.reject(abortError())
    let e = entries.get(url)
    if (!e) {
      let resolve!: () => void
      let reject!: (e: unknown) => void
      const promise = new Promise<void>((res, rej) => {
        resolve = res
        reject = rej
      })
      promise.catch(() => undefined) // waiters handle the rejection; this keeps an abandoned entry from being "unhandled"
      e = { url, waiters: 0, started: false, settled: false, ctl: new AbortController(), promise, resolve, reject }
      entries.set(url, e)
      waiting.push(e)
    }
    const entry = e
    entry.waiters++
    clearTimeout(entry.grace)
    const result = new Promise<void>((resolve, reject) => {
      let done = false
      const onAbort = () => {
        if (done) return
        done = true
        reject(abortError())
        release(entry)
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      entry.promise.then(
        () => {
          if (done) return
          done = true
          signal?.removeEventListener('abort', onAbort)
          resolve()
        },
        (err) => {
          if (done) return
          done = true
          signal?.removeEventListener('abort', onAbort)
          reject(err)
        },
      )
    })
    pump()
    return result
  }

  return {
    load: enqueue,
    isReady: (url) => ready.has(url),
    settle: async (urls, signal) => {
      await Promise.allSettled([...new Set(urls)].map((u) => enqueue(u, signal)))
    },
    get size() {
      return waiting.length + running
    },
  }
}

/** The app-wide queue. */
export const aiImageQueue = createImageQueue()
