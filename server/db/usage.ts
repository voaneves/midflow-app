/**
 * Atomic quota reservation on top of the SQL functions public.reserve_usage / public.refund_usage
 * (supabase/migrations/20261103030000_usage_reservation.sql). Service role only.
 */
import { dbHeaders, dbRequest, type DbConfig, type Fetch } from './supabase.ts'

/**
 * Reserves `cost` units of the monthly allowance in one atomic statement.
 * Returns the new total for the period, or null when it would exceed `limit` (nothing is reserved then).
 */
export async function reserveUsage(cfg: DbConfig, userId: string, period: string, cost: number, limit: number, f: Fetch = fetch): Promise<number | null> {
  const out = await dbRequest(
    cfg,
    'rpc/reserve_usage',
    { method: 'POST', headers: dbHeaders(cfg), body: JSON.stringify({ p_user: userId, p_period: period, p_cost: cost, p_limit: limit }) },
    f,
  )
  return out === null || out === undefined ? null : Number(out)
}

/** Gives back reserved units (never below zero). Returns the new total, or null when there is no counter row. */
export async function refundUsage(cfg: DbConfig, userId: string, period: string, cost: number, f: Fetch = fetch): Promise<number | null> {
  const out = await dbRequest(
    cfg,
    'rpc/refund_usage',
    { method: 'POST', headers: dbHeaders(cfg), body: JSON.stringify({ p_user: userId, p_period: period, p_cost: cost }) },
    f,
  )
  return out === null || out === undefined ? null : Number(out)
}
