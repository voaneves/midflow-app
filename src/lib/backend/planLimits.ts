/**
 * Plan limits shared by the browser and the API (quota checks, Stripe price mapping).
 * Pure data, no imports: safe to load from Node, the Cloudflare Worker and Vite.
 * Kept in sync with PLANS in src/lib/data.ts by server/tests/billing.test.ts.
 */
/** Plans sold through Stripe. Only these are ever stored in subscriptions.plan (CHECK start|pro|business). */
export type PaidPlanId = 'start' | 'pro' | 'business'
/** Every plan whose limits can apply. 'free' is the fallback for accounts without a paid subscription and is never stored. */
export type BillingPlanId = 'free' | PaidPlanId

export interface PlanLimit {
  /** Contents per calendar month (a post or a Stories sequence counts as 1). */
  contents: number
  profiles: number
  variations: number
  /** Monthly list price in BRL. */
  priceBrl: number
}

export const PLAN_LIMITS: Record<BillingPlanId, PlanLimit> = {
  free: { contents: 5, profiles: 1, variations: 1, priceBrl: 0 },
  start: { contents: 20, profiles: 1, variations: 1, priceBrl: 47 },
  pro: { contents: 60, profiles: 2, variations: 2, priceBrl: 77 },
  business: { contents: 150, profiles: 5, variations: 4, priceBrl: 127 },
}

export const PAID_PLAN_IDS: PaidPlanId[] = ['start', 'pro', 'business']

export const isBillingPlan = (v: unknown): v is BillingPlanId => typeof v === 'string' && Object.hasOwn(PLAN_LIMITS, v)

/** True for the plans that can be bought and stored (everything except 'free'). */
export const isPaidPlan = (v: unknown): v is PaidPlanId => typeof v === 'string' && (PAID_PLAN_IDS as string[]).includes(v)

const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due'])

/**
 * The plan whose limits apply. No subscription, or one that ended, falls back to the free allowance (5 contents/month).
 * Shared by the API (quota) and the browser (usage meter) so both always agree.
 */
export function effectiveBillingPlan(sub: { plan?: string | null; status?: string | null } | null | undefined): BillingPlanId {
  return sub && isPaidPlan(sub.plan) && ENTITLED_STATUSES.has(sub.status ?? '') ? sub.plan : 'free'
}
