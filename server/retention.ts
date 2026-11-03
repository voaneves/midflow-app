/**
 * Data retention for the personal data kept in Supabase, applied lazily (no cron, no timers: the Worker forbids both).
 * Same pattern as the ai_events prune in aihealth.ts: it rides on a request, runs at most once a day per instance,
 * and a failure only logs a short warning. Service role only (it deletes across users).
 *
 *   REVIEWS_RETENTION_DAYS      resolved review requests (briefing, comment, contact e-mail); default 365, 0 = keep
 *   GENERATIONS_RETENTION_DAYS  synced generations; default 0 = keep (customers' history is part of the product)
 *
 * Open review requests are never pruned: only status "resolved", measured from resolved_at.
 * review_events rows go with their request (on delete cascade).
 */
import { config } from './config.ts'
import { dbHeaders, dbRequest, type DbConfig, type Fetch } from './db/supabase.ts'

const DAY_MS = 86_400_000
let lastPrune = 0

/** Test hook: lets the daily prune run again. */
export function resetRetentionPrune() {
  lastPrune = 0
}

export interface RetentionResult {
  ran: boolean
  reviews: boolean
  generations: boolean
}

/** Runs the pending prunes when at least a day has passed since the last run. Never throws. */
export async function pruneRetention(
  db: DbConfig,
  f: Fetch = fetch,
  now = Date.now(),
  days: { reviews: number; generations: number } = { reviews: config.reviewsRetentionDays, generations: config.generationsRetentionDays },
): Promise<RetentionResult> {
  const result: RetentionResult = { ran: false, reviews: false, generations: false }
  if (now - lastPrune <= DAY_MS) return result
  if (!(days.reviews > 0) && !(days.generations > 0)) return result
  lastPrune = now
  result.ran = true

  const cutoff = (d: number) => encodeURIComponent(new Date(now - d * DAY_MS).toISOString())
  const del = async (path: string) => {
    try {
      await dbRequest(db, path, { method: 'DELETE', headers: dbHeaders(db) }, f)
      return true
    } catch {
      console.warn('[MIDFLOW] retention prune failed')
      return false
    }
  }
  if (days.reviews > 0) result.reviews = await del(`review_requests?status=eq.resolved&resolved_at=lt.${cutoff(days.reviews)}`)
  if (days.generations > 0) result.generations = await del(`generations?created_at=lt.${cutoff(days.generations)}`)
  return result
}
