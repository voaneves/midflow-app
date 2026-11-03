/**
 * Shared counters for the Worker: pure logic plus the adapter that plugs a Durable Object namespace into
 * server/http.ts (setRateLimitStore). Kept free of "cloudflare:*" imports so it can be unit tested in Node.
 */
import { createMemoryStore, type CounterHit, type RateLimitStore } from '../server/http.ts'

export interface StoredWindow {
  count: number
  resetAt: number
}

/** Fixed window: a new one opens when none is active or the previous one has ended. */
export function nextWindow(prev: StoredWindow | undefined, windowMs: number, now: number): StoredWindow {
  if (!prev || prev.resetAt <= now) return { count: 1, resetAt: now + windowMs }
  return { count: prev.count + 1, resetAt: prev.resetAt }
}

/** The part of a Durable Object namespace binding that doStore uses. */
export interface CounterNamespace {
  idFromName(name: string): unknown
  get(id: unknown): { hit(windowMs: number): Promise<CounterHit> }
}

/** Counters that must be exact across every isolate: the global daily AI budgets. Everything else stays in memory. */
export const isSharedKey = (key: string): boolean => key.startsWith('daily:')

/**
 * RateLimitStore backed by one Durable Object per shared key (a single-threaded, strongly consistent counter).
 * Other keys go to a per-isolate memory store. If the Durable Object is unreachable the hit is counted locally,
 * so a platform error degrades the cap to per-isolate instead of failing the request.
 */
export function doStore(ns: CounterNamespace, local: RateLimitStore = createMemoryStore(), shared: (key: string) => boolean = isSharedKey): RateLimitStore {
  return {
    async hit(key, windowMs, now) {
      if (!shared(key)) return local.hit(key, windowMs, now)
      try {
        return await ns.get(ns.idFromName(key)).hit(windowMs)
      } catch (err) {
        console.error('[MIDFLOW] shared counter unavailable, counting locally:', err instanceof Error ? err.message : err)
        return local.hit(key, windowMs, now)
      }
    },
  }
}
