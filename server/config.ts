import pkg from '../package.json' with { type: 'json' }
import { billingConfigFromEnv } from './billing.ts'
import { dbConfigFromEnv } from './db/supabase.ts'

/**
 * Server configuration. Secrets live ONLY here (process.env) and never reach the browser.
 * Copy `.env.example` to `.env` and fill it in. `npm run server` loads `.env` automatically.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name]
  const v = Number(raw)
  return raw !== undefined && raw.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : fallback
}

/** Optional cap: unset or invalid = no cap (Infinity); 0 = always use the fallback. */
function cap(name: string): number {
  const raw = process.env[name]
  const v = Number(raw)
  return raw !== undefined && raw.trim() !== '' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : Infinity
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase()
  if (v === undefined || v === '') return fallback
  return v === '1' || v === 'true' || v === 'yes'
}

const geminiKey = (process.env.GEMINI_API_KEY || '').trim()
const openaiKey = (process.env.OPENAI_API_KEY || '').trim()

export type ProviderId = 'gemini' | 'openai' | 'none'

function pickProvider(): ProviderId {
  const wanted = (process.env.AI_PROVIDER || '').trim().toLowerCase()
  if (wanted === 'gemini' && geminiKey) return 'gemini'
  if (wanted === 'openai' && openaiKey) return 'openai'
  if (wanted === 'none') return 'none'
  if (geminiKey) return 'gemini'
  if (openaiKey) return 'openai'
  return 'none'
}

const provider = pickProvider()

/** ADMIN_TOKEN is a shared secret guarding admin routes: anything shorter than 32 characters is guessable, so it is ignored. */
export const ADMIN_TOKEN_MIN_CHARS = 32
function adminTokenFromEnv(): string {
  const raw = (process.env.ADMIN_TOKEN || '').trim()
  if (raw && raw.length < ADMIN_TOKEN_MIN_CHARS) {
    console.warn(`[MIDFLOW] ADMIN_TOKEN ignored: it must have at least ${ADMIN_TOKEN_MIN_CHARS} characters.`)
    return ''
  }
  return raw
}

// CF_AI_* (not CF_API_TOKEN, which wrangler reserves for its own login). Old names still accepted.
const cfAccountId = (process.env.CF_AI_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || '').trim()
const cfApiToken = (process.env.CF_AI_TOKEN || process.env.CF_API_TOKEN || '').trim()

export type ImageProviderId = 'cloudflare' | 'gemini' | 'none'

/** IMAGE_PROVIDER wins; otherwise Cloudflare when its credentials exist, then Gemini (paid tier only). */
function pickImageProvider(): ImageProviderId {
  const wanted = (process.env.IMAGE_PROVIDER || '').trim().toLowerCase()
  if (wanted === 'none') return 'none'
  if (wanted === 'cloudflare' && cfAccountId && cfApiToken) return 'cloudflare'
  if (wanted === 'gemini' && geminiKey) return 'gemini'
  if (cfAccountId && cfApiToken) return 'cloudflare'
  if (geminiKey && (process.env.AI_IMAGE_MODEL ?? 'x').trim()) return 'gemini'
  return 'none'
}

/** Build identifier for /api/health: GIT_SHA (short) when set, else the package.json version. */
const version = (process.env.GIT_SHA || '').trim().slice(0, 12) || pkg.version

export const config = {
  version,
  port: num('PORT', 3000),
  isProd: process.env.NODE_ENV === 'production',

  ai: {
    provider,
    geminiKey,
    openaiKey,
    /** Text model. Override with AI_MODEL when the provider retires a model. */
    model: (process.env.AI_MODEL || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-3.5-flash-lite')).trim(),
    /** Backup models tried in order when the main one hits quota/overload (comma separated). */
    fallbackModels: (process.env.AI_FALLBACK_MODELS ?? (provider === 'gemini' ? 'gemini-3.1-flash-lite,gemini-3.5-flash' : ''))
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    /** Gemini image model (paid tier only). Empty disables Gemini images. */
    imageModel: (process.env.AI_IMAGE_MODEL ?? 'gemini-3.1-flash-lite-image').trim(),
    /**
     * Gemini 3+ reasoning depth: minimal | low | medium | high. Empty = model default (slow: tens of seconds
     * on the full pack schema). "low" keeps the copy quality and answers in a few seconds.
     */
    thinkingLevel: (process.env.AI_THINKING_LEVEL ?? 'low').trim().toLowerCase(),
    timeoutMs: num('AI_TIMEOUT_MS', 90_000),
    maxRetries: num('AI_MAX_RETRIES', 2),
    /** Minimum quality score (0–100) a pack must reach before we stop repairing it. */
    minQuality: num('AI_MIN_QUALITY', 85),
    /** Extra "fix these problems" rounds when the first answer misses the quality bar. */
    repairRounds: num('AI_REPAIR_ROUNDS', 1),
    /**
     * DEPRECATED, still read but no longer blocks anything. When the AI fails the API now always answers with the
     * honest template result (engine "template") plus `aiErrorKind` / `retryable`, and the client decides whether to retry.
     */
    requireLlm: bool('AI_REQUIRE_LLM', false),
  },

  image: {
    provider: pickImageProvider(),
    cfAccountId,
    cfApiToken,
    /** Workers AI text-to-image model. flux-1-schnell is fast and cheap on the free daily allowance. */
    cfModel: (process.env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell').trim(),
    timeoutMs: num('IMAGE_TIMEOUT_MS', 60_000),
    /** true → every generated card gets an AI image; false → only the editor's "Gerar nova imagem IA" button. */
    autoGenerate: bool('AI_IMAGES_AUTO', true),
    /** Stock photo fallback when AI images fail or hit the limit (server-side key only). */
    pixabayKey: (process.env.PIXABAY_API_KEY || '').trim(),
  },

  limits: {
    /** Per IP, per hour. */
    generatePerHour: num('RATE_GENERATE_PER_HOUR', 30),
    rewritePerHour: num('RATE_REWRITE_PER_HOUR', 120),
    aiImagePerHour: num('RATE_AI_IMAGE_PER_HOUR', 160), // 8 per generation → 20 generations/hour
    imagePerHour: num('RATE_IMAGE_PER_HOUR', 1500),
    eventsPerHour: num('RATE_EVENTS_PER_HOUR', 600),
    generateImagePerHour: num('RATE_GENERATE_IMAGE_PER_HOUR', 120),
    /** POST /api/review: review requests per IP. */
    reviewPerHour: num('RATE_REVIEW_PER_HOUR', 10),
    /** POST /api/billing/checkout per IP. */
    billingPerHour: num('RATE_BILLING_PER_HOUR', 30),
    /** POST /api/account/delete per IP. */
    accountDeletePerHour: num('RATE_ACCOUNT_DELETE_PER_HOUR', 5),
    /** POST /api/test-ai (a real, billed model round-trip) per IP. */
    testAiPerHour: num('RATE_TEST_AI_PER_HOUR', 5),
    /** Global daily caps on paid AI calls (all clients together, per UTC day). Unset = unlimited. */
    dailyMaxText: cap('AI_DAILY_MAX_TEXT'),
    dailyMaxImages: cap('AI_DAILY_MAX_IMAGES'),
    /** Global daily cap on rewrites, separate from the text cap so rewrites can never starve /api/generate. */
    dailyMaxRewrite: num('AI_DAILY_MAX_REWRITE', 300),
    /** Per signed-in user per UTC day (anonymous callers in ANON_AI=open are counted per IP instead). */
    dailyMaxRewritePerUser: num('AI_DAILY_MAX_REWRITE_PER_USER', 60),
    /** AI images per signed-in user per UTC day: editor requests plus the signed card image URLs issued by /api/generate. */
    dailyMaxImagesPerUser: num('AI_DAILY_MAX_IMAGES_PER_USER', 40),
    bodyBytes: num('MAX_BODY_BYTES', 256 * 1024),
  },

  /** Comma-separated list of extra origins allowed to call the API (same origin is always allowed). */
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  /** Protects /api/admin/*. Empty disables the admin endpoints. A token shorter than 32 characters is ignored. */
  adminToken: adminTokenFromEnv(),

  // TRUST_PROXY ('cloudflare' | number of proxies) is parsed per request in http.ts (proxyTrustFromEnv).

  /** One JSON log line per API request (method, path, status, ms, requestId). */
  logRequests: bool('LOG_REQUESTS', true),

  /** Events older than this are pruned from the local event log. */
  eventsRetentionDays: num('EVENTS_RETENTION_DAYS', 90),

  /** Resolved review requests (briefing, comment, contact e-mail) older than this are deleted from Supabase. 0 = keep. */
  reviewsRetentionDays: num('REVIEWS_RETENTION_DAYS', 365),
  /** Server-synced generations older than this are deleted from Supabase. 0 = keep (default). */
  generationsRetentionDays: num('GENERATIONS_RETENTION_DAYS', 0),
}

export function aiEnabled() {
  return config.ai.provider !== 'none'
}

export function imageAiEnabled() {
  return config.image.provider !== 'none'
}

export function imageModelName() {
  return config.image.provider === 'cloudflare'
    ? config.image.cfModel
    : config.image.provider === 'gemini'
      ? config.ai.imageModel
      : null
}

/* ---------------- backend (Supabase / Stripe) ----------------
 * Read from the environment on every call, not at import time: on the Cloudflare Worker the bindings
 * are only copied into process.env when a request arrives, and tests flip them between cases.
 * Everything is optional; with nothing set the API behaves as before (anonymous, no quotas, no billing). */

/** Supabase JWT secret (HS256) used to verify user tokens. */
export const supabaseJwtSecret = (): string | undefined => process.env.SUPABASE_JWT_SECRET?.trim() || undefined

/** Service-role Supabase access, or null when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. */
export const getDbConfig = () => dbConfigFromEnv(process.env)

/** Stripe checkout configuration, or null without STRIPE_SECRET_KEY. */
export const getBillingConfig = () => billingConfigFromEnv(process.env)

export const stripeWebhookSecret = (): string | undefined => process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined

/* ---------------- anonymous AI access and signed image URLs ---------------- */

export type AnonAiMode = 'open' | 'template' | 'off'

/**
 * What a request without a signed-in account may do on the paid AI routes (/api/generate, /api/rewrite, editor images).
 *  - open:     anonymous callers get the AI (only sensible without accounts, e.g. local development).
 *  - template: anonymous callers get the honest template result (engine "template"), never a paid model call.
 *  - off:      anonymous callers get 401 asking them to sign in.
 * Default: "template" when Supabase accounts are configured, otherwise "open". Read on every call (Worker env arrives per request).
 */
export function anonAiMode(): AnonAiMode {
  const wanted = (process.env.ANON_AI || '').trim().toLowerCase()
  if (wanted === 'open' || wanted === 'template' || wanted === 'off') return wanted
  return getDbConfig() ? 'template' : 'open'
}

/** HMAC key that signs AI image URLs (/api/image?ai=1&sig=...). Server secret only; unset = signing disabled. */
export const imageUrlSecret = (): string | undefined => process.env.IMAGE_URL_SECRET?.trim() || undefined

/** True on the Cloudflare Worker runtime (including `wrangler dev`). */
export const runningOnWorker = (): boolean => typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'
