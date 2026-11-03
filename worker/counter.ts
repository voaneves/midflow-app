/**
 * Durable Object that backs the global daily AI budgets (see wrangler.jsonc "durable_objects" / "migrations").
 * One instance per counter key, e.g. "daily:text:2026-11-03". Requests to a Durable Object are serialized, and storage
 * reads/writes are consistent, so concurrent isolates cannot overshoot the cap.
 */
import { DurableObject } from 'cloudflare:workers'
import { nextWindow, type StoredWindow } from './counterCore.ts'

export class Counter extends DurableObject {
  /** Counts one hit and returns the count in the current window and when it ends. */
  async hit(windowMs: number): Promise<StoredWindow> {
    const now = Date.now()
    const prev = await this.ctx.storage.get<StoredWindow>('w')
    const next = nextWindow(prev, windowMs, now)
    await this.ctx.storage.put('w', next)
    // Expired counters delete themselves, so old days do not pile up in storage.
    if (!prev || prev.resetAt <= now) await this.ctx.storage.setAlarm(next.resetAt + 60_000)
    return next
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll()
  }
}
