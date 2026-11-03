/**
 * Plan limits shared by the browser and the API (quota checks, Stripe price mapping).
 * Pure data, no imports: safe to load from Node, the Cloudflare Worker and Vite.
 * Kept in sync with PLANS in src/lib/data.ts by server/tests/billing.test.ts.
 */
export type BillingPlanId = 'start' | 'pro' | 'business'

export interface PlanLimit {
  /** Contents per calendar month (a post or a Stories sequence counts as 1). */
  contents: number
  profiles: number
  variations: number
  /** Monthly list price in BRL. */
  priceBrl: number
}

export const PLAN_LIMITS: Record<BillingPlanId, PlanLimit> = {
  start: { contents: 20, profiles: 1, variations: 1, priceBrl: 47 },
  pro: { contents: 60, profiles: 2, variations: 2, priceBrl: 77 },
  business: { contents: 150, profiles: 5, variations: 4, priceBrl: 127 },
}

export const BILLING_PLAN_IDS = Object.keys(PLAN_LIMITS) as BillingPlanId[]

export const isBillingPlan = (v: unknown): v is BillingPlanId => typeof v === 'string' && Object.hasOwn(PLAN_LIMITS, v)

const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due'])

/**
 * The plan whose limits apply. No subscription, or one that ended, falls back to the Start allowance.
 * Shared by the API (quota) and the browser (usage meter) so both always agree.
 */
export function effectiveBillingPlan(sub: { plan?: string | null; status?: string | null } | null | undefined): BillingPlanId {
  return sub && isBillingPlan(sub.plan) && ENTITLED_STATUSES.has(sub.status ?? '') ? sub.plan : 'start'
}
