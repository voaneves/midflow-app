/**
 * Server configuration. Secrets live ONLY here (process.env) and never reach the browser.
 * Copy `.env.example` to `.env` and fill it in. `npm run server` loads `.env` automatically.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name]
  const v = Number(raw)
  return raw !== undefined && raw.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : fallback
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

export const config = {
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
    timeoutMs: num('AI_TIMEOUT_MS', 90_000),
    maxRetries: num('AI_MAX_RETRIES', 2),
    /** Minimum quality score (0–100) a pack must reach before we stop repairing it. */
    minQuality: num('AI_MIN_QUALITY', 85),
    /** Extra "fix these problems" rounds when the first answer misses the quality bar. */
    repairRounds: num('AI_REPAIR_ROUNDS', 1),
    /** true → when the AI is down, answer 503 instead of falling back to templates. */
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
    bodyBytes: num('MAX_BODY_BYTES', 256 * 1024),
  },

  /** Comma-separated list of extra origins allowed to call the API (same origin is always allowed). */
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  /** Protects /api/admin/*. Empty disables the admin endpoints. */
  adminToken: (process.env.ADMIN_TOKEN || '').trim(),

  /** Set when running behind a reverse proxy (Render, Railway, Fly, nginx) so rate limits see the real IP. */
  trustProxy: bool('TRUST_PROXY', false),
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
