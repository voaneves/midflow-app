import type { IncomingMessage, ServerResponse } from 'http'
import { randomUUID } from 'node:crypto'
import { aiErrorKindOf, classifyAiError, rewriteWithAI, synthesizeContextualRewrite, type AIRewriteRequest, type AiErrorCode, type AiErrorKind } from './aiService.ts'
import { loadAiHealth, parseRange, recordAiCall, type AiOutcome } from './aihealth.ts'
import { clearStaffCache, optionalUser, requireStaff, requireUser, type StaffIdentity } from './authz.ts'
import type { AuthenticatedUser } from './auth.ts'
import {
  cancelStripeSubscription,
  checkQuota,
  createCheckoutSession,
  createPortalSession,
  effectivePlan,
  generationCost,
  handleStripeEvent,
  hasLiveSubscription,
  parseCheckoutRequest,
  usagePeriod,
  verifyStripeWebhook,
  type BillingPlanId,
} from './billing.ts'
import {
  anonymizeAiEvents,
  applySubscriptionUpdate,
  claimStripeEventState,
  DbError,
  deleteAuthUser,
  deleteUserReviews,
  findUserByEmail,
  getStaffRole,
  getSubscription,
  getUsage,
  incrementUsage,
  isStaffRole,
  listStaff,
  markStripeEventProcessed,
  releaseStripeEvent,
  removeStaffGuarded,
  setStaffRoleGuarded,
  type DbConfig,
} from './db/supabase.ts'
import {
  createReview,
  getReview,
  isReviewStatus,
  listMyReviews,
  listReviews,
  parseOutputs,
  parseReviewPatch,
  parseReviewRequest,
  reviseReview,
  REVIEW_BODY_BYTES,
  updateReview,
} from './reviews.ts'
import { callLLM, llmHealth } from './ai/llm.ts'
import { generatePack, type ModelCaller, type PackResult } from './ai/pipeline.ts'
import { openIssues } from './ai/quality.ts'
import type { GenerateParams } from './ai/types.ts'
import { aiEnabled, anonAiMode, config, getBillingConfig, getDbConfig, imageAiEnabled, imageModelName, runningOnWorker, stripeWebhookSecret } from './config.ts'
import { imageHealth } from './ai/image.ts'
import { refundUsage, reserveUsage } from './db/usage.ts'
import { applyCors, clientIp, consumeDailyBudget, HttpError, rateLimit, readJson, readRawBody, sendJson } from './http.ts'
import { aiImageAuthorized, buildApiImageUrl, isEditorialPhotoId, resolveContextualImage, selectContextualPhotoId, selectEditorialPhotoId } from './imageService.ts'
import { CLIENT_EVENT_TYPES, COMMENT_MAX_CHARS, logEvent, metrics, type EventType } from './telemetry.ts'

const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`

/* ---------------- input sanitizing ---------------- */

const HEX = /^#[0-9a-f]{3,8}$/i
const SLUG = /^[a-z0-9-]{1,40}$/i
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const color = (v: unknown) => (typeof v === 'string' && HEX.test(v) ? v : undefined)
const slug = (v: unknown) => (typeof v === 'string' && SLUG.test(v) ? v : undefined)
const int = (v: unknown, min: number, max: number, fallback: number) => {
  if (v === null || v === undefined || v === '') return fallback
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback

const IMAGE_TYPES = ['fotos', 'ilustracoes', 'render', 'misto'] as const
const STYLES = ['moderno', 'minimalista', 'elegante', 'colorido', 'natural', 'premium'] as const

function sanitizeParams(raw: any): GenerateParams {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'params é obrigatório.')
  const brandName = text(raw.brandName, 80).trim()
  if (!brandName) throw new HttpError(400, 'Informe o nome da marca.')
  const pal = raw.palette || {}
  return {
    brandName,
    handle: text(raw.handle, 40),
    segment: slug(raw.segment) || 'outro',
    themeId: slug(raw.themeId),
    customTheme: text(raw.customTheme, 160),
    city: text(raw.city, 80),
    about: text(raw.about, 1500),
    audience: text(raw.audience, 600),
    topics: text(raw.topics, 800),
    references: text(raw.references, 600),
    objective: slug(raw.objective) || 'atrair',
    objectiveOther: text(raw.objectiveOther, 200),
    tones: Array.isArray(raw.tones) ? raw.tones.map(slug).filter(Boolean).slice(0, 4) : [],
    style: oneOf(raw.style, STYLES, 'moderno'),
    imageType: oneOf(raw.imageType, IMAGE_TYPES, 'fotos'),
    palette: {
      dark: color(pal.dark) || '#1F2937',
      mid: color(pal.mid) || '#4B5563',
      soft: color(pal.soft) || '#E5E7EB',
      light: color(pal.light) || '#F9FAFB',
      accent: color(pal.accent) || '#14B8A6',
    },
    postFormat: raw.postFormat === '1:1' ? '1:1' : '4:5',
    posts: raw.posts !== false,
    stories: raw.stories !== false,
    seed: int(raw.seed, 1, 1_000_000, Date.now() % 100000),
  }
}

/* ---------------- pack → creatives (what the front-end renders) ---------------- */

const STYLE_HARMONY: Record<string, string[]> = {
  moderno: ['moderno', 'elegante', 'premium', 'moderno'],
  elegante: ['elegante', 'premium', 'minimalista', 'elegante'],
  premium: ['premium', 'elegante', 'natural', 'premium'],
  minimalista: ['minimalista', 'elegante', 'moderno', 'natural'],
  natural: ['natural', 'elegante', 'premium', 'minimalista'],
  colorido: ['colorido', 'moderno', 'elegante', 'colorido'],
}

/**
 * `aiImageSlots` is how many cards may be given a signed AI image URL (the first ones, in build order); the rest get stock
 * images. 0 = the caller may not spend the paid image model (anonymous on a signed-in-only AI, or over the daily image cap).
 */
function toGeneration(params: GenerateParams, version: number, result: PackResult, aiImageSlots = Infinity) {
  const baseSeed = (params.seed || 1) + version * 97
  let slotsLeft = aiImageSlots
  const usedPhotoIds = new Set<string>()
  const usedEditorialIds = new Set<string>()
  const usedEditorialByKind = { post: new Set<string>(), story: new Set<string>() }
  const postStyles = STYLE_HARMONY[params.style] || [params.style]

  const image = (p: { imagePrompt?: string; headline: string; sub?: string }, kind: 'post' | 'story', order: number, style: string) => {
    const seed = baseSeed + order * (kind === 'post' ? 31 : 37)
    const fallback = selectContextualPhotoId({
      text: `${p.headline} ${p.sub || ''} ${p.imagePrompt || ''} ${params.customTheme || ''} ${params.topics || ''}`,
      segment: params.segment,
      themeId: params.themeId,
      order,
      seed,
      usedIds: usedPhotoIds,
    })
    const editorial = selectEditorialPhotoId({
      segment: params.segment,
      themeId: params.themeId,
      customTheme: params.customTheme,
      headline: p.headline,
      prompt: p.imagePrompt,
      order,
      seed,
      usedIds: usedEditorialIds,
      usedSameKind: usedEditorialByKind[kind],
    })
    return buildApiImageUrl({
      prompt: p.imagePrompt,
      headline: p.headline,
      sub: p.sub,
      segment: params.segment,
      themeId: params.themeId,
      customTheme: params.customTheme,
      topics: params.topics,
      imageType: params.imageType,
      style,
      kind,
      order,
      seed,
      dark: params.palette.dark,
      mid: params.palette.mid,
      accent: params.palette.accent,
      light: params.palette.light,
      fallback,
      editorial,
      // Every card asks for an AI image; /api/image falls back to Pixabay/catalog when AI is off, failing or over the limit.
      forceAi: config.image.autoGenerate && imageAiEnabled() && slotsLeft-- > 0,
    })
  }

  const brandTag = `#${params.brandName.normalize('NFD').replace(/[^A-Za-z0-9]/g, '')}`

  const posts = result.pack.posts.map((p, i) => {
    const order = i + 1
    const style = postStyles[(i + version - 1) % postStyles.length] || params.style
    return {
      id: uid('post'),
      kind: 'post' as const,
      order,
      themeId: params.themeId || 'custom',
      variant: p.variant,
      tag: p.tag,
      headline: p.headline,
      highlight: p.highlight,
      sub: p.sub,
      bullets: p.bullets,
      icons: p.icons,
      quote: p.quote,
      price: p.price,
      cta: p.cta,
      photo: image(p, 'post', order, style),
      caption: p.caption,
      hashtags: p.hashtags.length ? p.hashtags : [brandTag],
      palette: params.palette,
      style,
    }
  })

  const stories = result.pack.stories.map((s, i) => {
    const order = i + 1
    return {
      id: uid('story'),
      kind: 'story' as const,
      order,
      themeId: params.themeId || 'custom',
      variant: i === 0 && s.poll?.length ? 'poll' : i === 1 && s.bullets?.length ? 'list' : 'photo',
      headline: s.headline,
      highlight: s.highlight,
      poll: s.poll,
      bullets: s.bullets,
      sub: s.sub || '',
      cta: s.cta,
      photo: image(s, 'story', order + 4, params.style),
      caption: s.caption,
      hashtags: [brandTag],
      palette: params.palette,
      style: params.style,
    }
  })

  return {
    id: uid('gen'),
    createdAt: Date.now(),
    version,
    themeLabel: result.pack.themeLabel,
    params,
    posts: params.posts ? posts : [],
    stories: params.stories ? stories : [],
    engine: result.engine,
    model: result.model,
    quality: { score: result.report.score, passed: result.report.passed, repaired: result.repaired },
    aiError: result.engine === 'template' && !config.isProd ? result.aiError : undefined, // internal reason; logged server-side
    processingTimeMs: result.latencyMs,
  }
}

/* ---------------- routes ---------------- */

/** Model caller used when the daily AI cap is reached: fails fast so the pipeline answers with templates. */
const capReached: ModelCaller = async () => ({
  ok: false,
  engine: 'none',
  model: 'daily-cap',
  latencyMs: 0,
  attempts: 0,
  error: 'Limite diário de uso da IA atingido.',
})

/** Model caller for anonymous requests when ANON_AI=template: never reaches a paid model. */
const accountRequiredCaller: ModelCaller = async () => ({
  ok: false,
  engine: 'none',
  model: 'account-required',
  latencyMs: 0,
  attempts: 0,
  error: 'Crie uma conta gratuita para gerar com IA.',
})

type Handler = (req: IncomingMessage, res: ServerResponse, url: URL, params: string[]) => Promise<void>

/* ---------------- accounts, quota and AI outcome ---------------- */

const PLAN_NAMES: Record<BillingPlanId, string> = { start: 'Start', pro: 'Pro', business: 'Business' }

interface Gate {
  user: AuthenticatedUser | null
  /** Set only when the user's usage is tracked (signed in and Supabase configured and reachable). */
  db: DbConfig | null
  plan?: BillingPlanId
  /** Usage after the reservation (or the current usage when nothing was reserved). */
  used?: number
  limit?: number
  /** Units reserved up front (atomically) and not yet settled by chargeUsage. */
  reserved: number
}

/**
 * Optional account: no token = anonymous (see anonBlocked); an invalid token = 401; a valid one is checked against the
 * monthly allowance of its plan. Without Supabase, or when it is unreachable, the quota is skipped rather than blocking the customer.
 *
 * With `reserve` (default) the cost is reserved atomically in the database before any paid AI call, so parallel requests
 * can never push usage past the limit; chargeUsage() later keeps what was delivered and refunds the rest.
 * Without it (rewrites and editor images, which are not counted) the allowance is only checked.
 */
async function quotaGate(req: IncomingMessage, cost: number, opts: { reserve?: boolean } = {}): Promise<Gate> {
  const user = await optionalUser(req)
  const db = getDbConfig()
  if (!user || !db) return { user, db: null, reserved: 0 }
  let reserved = 0
  try {
    const plan = effectivePlan(await getSubscription(db, user.id))
    const period = usagePeriod()
    const limit = checkQuota(plan, 0, cost).limit
    let used: number
    if (opts.reserve !== false && cost > 0) {
      const after = await reserveUsage(db, user.id, period, cost, limit)
      if (after !== null) {
        reserved = cost
        used = after
      } else {
        used = await getUsage(db, user.id, period).catch(() => limit)
        throw quotaExceeded(plan, limit, used)
      }
    } else {
      used = await getUsage(db, user.id, period)
      const q = checkQuota(plan, used, cost)
      if (!q.allowed) throw quotaExceeded(plan, limit, used)
    }
    return { user, db, plan, used, limit, reserved }
  } catch (err) {
    if (err instanceof HttpError) throw err
    // Fail open only when the database cannot be reached at all (fetch itself threw: DNS, connection, timeout), so a Supabase
    // outage does not take the product down with it. When the database ANSWERS with an error (a rejected call, a missing
    // function, a 5xx) or the answer is unreadable, the quota cannot be enforced and paid AI would run unmetered: fail closed.
    if (isNetworkError(err)) {
      console.warn('[MIDFLOW] quota check skipped: database unreachable')
      return { user, db: null, reserved }
    }
    console.warn(`[MIDFLOW] quota check failed${err instanceof DbError ? ` (database answered ${err.status})` : ''}: refusing the request`)
    throw new HttpError(503, 'Não foi possível verificar seu plano agora. Tente novamente em instantes.')
  }
}

/** fetch() rejects with a TypeError when there is no connection (DNS, refused, reset) and with an abort/timeout error when it times out. */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  const name = (err as { name?: unknown } | null)?.name
  return name === 'AbortError' || name === 'TimeoutError'
}

function quotaExceeded(plan: BillingPlanId, limit: number, used: number): HttpError {
  return new HttpError(402, `Você já usou os ${limit} conteúdos do plano ${PLAN_NAMES[plan]} neste mês. Faça upgrade para continuar.`, {
    code: 'quota_exceeded',
    plan,
    limit,
    used,
  })
}

/**
 * Settles a reservation: keeps `cost` units (what was delivered) and refunds the rest; charges the difference if more
 * than reserved was delivered. Returns the usage to report, or undefined when not tracked. Safe to call with cost 0
 * (full refund), which is also how a request that fails after reserving gives its units back.
 */
async function chargeUsage(gate: Gate, cost: number): Promise<{ plan: BillingPlanId; used: number; limit: number } | undefined> {
  if (!gate.user || !gate.db || !gate.plan || gate.limit === undefined) return undefined
  const period = usagePeriod()
  let used = gate.used ?? 0
  try {
    if (cost < gate.reserved) {
      used = (await refundUsage(gate.db, gate.user.id, period, gate.reserved - cost)) ?? Math.max(0, used - (gate.reserved - cost))
    } else if (cost > gate.reserved) {
      used = await incrementUsage(gate.db, gate.user.id, period, cost - gate.reserved)
    }
    gate.reserved = 0
    return { plan: gate.plan, used, limit: gate.limit }
  } catch {
    console.warn('[MIDFLOW] usage settlement failed')
    return undefined
  }
}

/**
 * Anonymous caller on a paid AI route: 'off' answers 401; true means "template only" (no paid text or image model).
 * Check aiEnabled() / imageAiEnabled() separately for what is actually configured.
 */
function anonTemplateOnly(gate: Gate): boolean {
  if (gate.user) return false
  const mode = anonAiMode()
  if (mode === 'off') throw new HttpError(401, 'Entre na sua conta para gerar conteúdo com IA.', { code: 'auth_required' })
  return mode === 'template'
}

interface AiFailure {
  kind: AiErrorKind | null
  code: AiErrorCode | null
  retryable: boolean
  /** Template answer because the caller has no account (reported as kind daily_cap + `code: "account_required"`). */
  accountRequired?: boolean
}

/** Why the answer is not model output. Null kind = the model answered. Only transient failures are worth retrying. */
function aiFailure(engine: string, aiAllowed: boolean, aiError: string | undefined, accountRequired = false): AiFailure {
  if (engine !== 'template') return { kind: null, code: null, retryable: false }
  const code: AiErrorCode = !aiAllowed ? 'daily_cap' : !aiEnabled() ? 'not_configured' : classifyAiError(aiError)
  const kind = aiErrorKindOf(code)
  return { kind, code, retryable: kind === 'transient', ...(accountRequired ? { accountRequired: true } : {}) }
}

const isAdminCaller = async (req: IncomingMessage) => {
  try {
    await requireStaff(req, ['admin'])
    return true
  } catch {
    return false
  }
}

const requireDb = (): DbConfig => {
  const db = getDbConfig()
  if (!db) throw new HttpError(501, 'Recurso disponível apenas com o banco de dados configurado.')
  return db
}

const actorOf = (s: StaffIdentity) => ({ role: s.role, userId: s.userId, label: s.label })

/** Unexpected database failures on admin/customer routes become a clear 503 instead of a generic 500. */
async function withDb<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (err) {
    if (err instanceof HttpError) throw err
    console.warn('[MIDFLOW] database request failed')
    throw new HttpError(503, 'Banco de dados indisponível no momento. Tente novamente.')
  }
}

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,120}\.[^\s@<>"']{2,24}$/

const routes: Record<string, Handler> = {
  'GET /api/health': async (_req, res) => {
    sendJson(res, 200, { status: 'ok', version: config.version, uptime: Math.round(process.uptime()) })
  },

  /** Honest status of the AI: shown on the Settings page. Never exposes keys. */
  /**
   * Public: only whether AI is on. Details (vendor, model, errors) are internal — shown outside
   * production or with the ADMIN_TOKEN (Authorization: Bearer …).
   */
  'GET /api/status': async (req, res) => {
    if (config.isProd && !(await isAdminCaller(req))) {
      sendJson(res, 200, { aiEnabled: aiEnabled(), imageAi: imageAiEnabled() })
      return
    }
    sendJson(res, 200, {
      aiEnabled: aiEnabled(),
      provider: config.ai.provider,
      model: config.ai.model,
      imageProvider: config.image.provider,
      imageModel: imageModelName(),
      imageAuto: config.image.autoGenerate && imageAiEnabled(),
      stockFallback: config.image.pixabayKey ? 'pixabay' : 'catalog',
      imageLastError: imageHealth.lastErrorAt && (!imageHealth.lastOkAt || imageHealth.lastErrorAt > imageHealth.lastOkAt) ? imageHealth.lastError : null,
      minQuality: config.ai.minQuality,
      lastOkAt: llmHealth.lastOkAt ?? null,
      lastErrorAt: llmHealth.lastErrorAt ?? null,
      lastError: llmHealth.lastError ?? null,
    })
  },

  /** Real round-trip to the model. Reports failure as failure. */
  'POST /api/test-ai': async (req, res) => {
    // Admin only in production and on the Worker, including `wrangler dev` (editors get 403). Open only for a local dev server.
    // A real, billed model call: 5 per hour per IP.
    if (config.isProd || runningOnWorker()) await requireStaff(req, ['admin'])
    await rateLimit(req, 'test', config.limits.testAiPerHour)
    if (!aiEnabled()) {
      sendJson(res, 200, {
        ok: false,
        message: 'Nenhuma chave de IA configurada no servidor. Defina GEMINI_API_KEY (ou OPENAI_API_KEY) no .env e reinicie.',
      })
      return
    }
    const r = await callLLM({ system: 'Responda em JSON.', user: 'Retorne exatamente {"status":"ok"}', temperature: 0 })
    sendJson(res, 200, {
      ok: r.ok,
      provider: r.engine,
      model: r.model,
      latencyMs: r.latencyMs,
      message: r.ok ? `Conexão com ${r.engine} (${r.model}) funcionando — ${r.latencyMs} ms.` : `Falha: ${r.error}`,
    })
  },

  'GET /api/image': async (req, res, url) => {
    const q = url.searchParams
    // The paid image model is only used for URLs this server signed (ai=1 plus a valid sig). Anything else gets the stock fallback.
    // The raw query string must also be the canonical spelling, so one signed URL cannot fan out into variants that miss the cache.
    const aiAuthorized = aiImageAuthorized(q, url.search) && imageAiEnabled()
    let forceAi = aiAuthorized
    if (forceAi) {
      // Over the AI image limit → serve the stock-photo fallback instead of a broken image.
      try {
        await rateLimit(req, 'ai-image', config.limits.aiImagePerHour)
      } catch (err) {
        if (!(err instanceof HttpError) || err.status !== 429) throw err
        forceAi = false
      }
    }
    if (!forceAi) await rateLimit(req, 'image', config.limits.imagePerHour)
    const imageStarted = Date.now()
    let imageCapped = false
    const result = await resolveContextualImage({
      prompt: text(q.get('prompt'), 400) || undefined,
      headline: text(q.get('headline'), 120) || undefined,
      segment: slug(q.get('segment')) || 'beleza',
      themeId: slug(q.get('theme')),
      imageType: oneOf(q.get('type'), IMAGE_TYPES, 'fotos'),
      style: oneOf(q.get('style'), STYLES, 'moderno'),
      kind: q.get('kind') === 'story' ? 'story' : 'post',
      order: int(q.get('order'), 1, 12, 1),
      seed: int(q.get('seed'), 1, 10_000_000, 101),
      dark: color(q.get('dark')),
      mid: color(q.get('mid')),
      accent: color(q.get('accent')),
      light: color(q.get('light')),
      fallback: slug(q.get('fallback')),
      editorial: isEditorialPhotoId(q.get('photo')) ? q.get('photo')! : undefined,
      forceAi,
      // Checked only on a cache miss, right before the paid image model is called.
      aiGate: async () => {
        const allowed = await consumeDailyBudget('image', config.limits.dailyMaxImages)
        if (!allowed) imageCapped = true
        return allowed
      },
    })
    // One AI-health row per real AI attempt (cache hits are not attempts). Auth/permission/token problems count as 'config'.
    const imageFailure = (): { kind: AiErrorKind; code: AiErrorCode } => {
      if (imageCapped) return { kind: 'daily_cap', code: 'daily_cap' }
      const code: AiErrorCode = imageHealth.lastErrorAt && imageHealth.lastErrorAt >= imageStarted && imageHealth.lastCode ? imageHealth.lastCode : 'provider_error'
      return { kind: aiErrorKindOf(code), code }
    }
    if (forceAi && !result.source.endsWith('-cache')) {
      const failure = result.ai ? null : imageFailure()
      recordAiCall({
        route: 'image',
        provider: config.image.provider,
        model: imageModelName() ?? undefined,
        outcome: result.ai ? 'ok' : (failure?.kind ?? 'transient'),
        engine: result.ai ? 'ai' : result.source === 'pixabay' || result.source === 'editorial-hd' ? 'stock' : 'procedural',
        latencyMs: Date.now() - imageStarted,
        errorCode: failure?.code ?? null,
      })
    }
    res.statusCode = 200
    res.setHeader('Content-Type', result.mimeType)
    // An AI image is tied to its URL (prompt + seed): keep it, so thumbnail, preview and PNG export match.
    // A fallback served in place of an AI image is cached briefly, so a later view can still get the AI one.
    const asked = aiAuthorized
    res.setHeader('Cache-Control', result.ai ? 'public, max-age=2592000, immutable' : asked ? 'public, max-age=300' : 'public, max-age=86400')
    res.setHeader('X-Midflow-Image-AI', result.ai ? '1' : '0')
    if (result.credit) res.setHeader('X-Midflow-Photo-Credit', encodeURIComponent(result.credit))
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (!config.isProd) res.setHeader('X-Midflow-Image-Source', result.source) // vendor names stay internal
    // SVG artwork must never run scripts, even if opened directly.
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'")
    res.end(result.buffer)
  },

  'POST /api/generate-image': async (req, res) => {
    await rateLimit(req, 'generate-image', config.limits.generateImagePerHour)
    // Signed-in accounts with no allowance left cannot spend AI images (checked, not charged). Anonymous callers follow ANON_AI:
    // 'off' answers 401 here; 'template' returns a stock image URL (never a signed AI one) flagged with code "account_required".
    const gate = await quotaGate(req, 1, { reserve: false })
    const anonTemplate = anonTemplateOnly(gate)
    const accountRequired = anonTemplate && imageAiEnabled()
    // Per-user daily cap (UTC day): the same counter also covers the card image URLs /api/generate signs for this user.
    // Over it the answer is an unsigned stock URL flagged `daily_user_limit`; the request itself is not an error.
    const userCapped =
      !!gate.user && !anonTemplate && imageAiEnabled() && !(await consumeDailyBudget(`img:${gate.user.id}`, config.limits.dailyMaxImagesPerUser))
    const body = await readJson(req)
    const seed = int(body.seed, 1, 10_000_000, Math.floor(Math.random() * 100000))
    const segment = slug(body.segment) || 'beleza'
    const order = int(body.order, 1, 12, 1)
    const fallback = selectContextualPhotoId({
      text: `${text(body.prompt, 400)} ${text(body.headline, 120)} ${slug(body.themeId) || ''}`,
      segment,
      themeId: slug(body.themeId),
      order,
      seed,
    })
    const imageUrl = buildApiImageUrl({
      prompt: text(body.prompt, 400),
      headline: text(body.headline, 120),
      segment,
      themeId: slug(body.themeId),
      imageType: oneOf(body.imageType, IMAGE_TYPES, 'fotos'),
      style: oneOf(body.style, STYLES, 'moderno'),
      kind: body.kind === 'story' ? 'story' : 'post',
      order,
      seed,
      dark: color(body.palette?.dark),
      mid: color(body.palette?.mid),
      accent: color(body.palette?.accent),
      light: color(body.palette?.light),
      fallback,
      forceAi: !anonTemplate && !userCapped,
    })
    sendJson(res, 200, {
      success: true,
      imageUrl,
      seed,
      aiEnabled: imageAiEnabled() && !accountRequired && !userCapped,
      ...(accountRequired ? { code: 'account_required' } : userCapped ? { code: 'daily_user_limit' } : {}),
    })
  },

  'POST /api/generate': async (req, res) => {
    await rateLimit(req, 'generate', config.limits.generatePerHour)
    const body = await readJson(req)
    const params = sanitizeParams(body.params)
    const version = int(body.version, 1, 999, 1)
    // Signed-in accounts are checked against their plan before any paid AI call; anonymous/demo is unchanged.
    // The cost is reserved atomically here, so parallel requests cannot exceed the plan; it is settled (or refunded) below.
    const gate = await quotaGate(req, generationCost(params.posts ? 4 : 0, params.stories ? 1 : 0))
    let result: PackResult
    let failure: AiFailure
    let generation: ReturnType<typeof toGeneration>
    let accountRequired = false
    try {
      // Anonymous callers (ANON_AI=template) get the honest template result without touching a paid model or the daily budget,
      // and their cards get stock images, never a signed AI image URL.
      const anonTemplate = anonTemplateOnly(gate)
      accountRequired = anonTemplate && aiEnabled()
      // Global daily cap: over it, the template engine answers (reported as engine 'template', never as AI).
      const aiAllowed = accountRequired ? false : !aiEnabled() || (await consumeDailyBudget('text', config.limits.dailyMaxText))
      result = await generatePack(params, version, accountRequired ? accountRequiredCaller : aiAllowed ? undefined : capReached)
      failure = aiFailure(result.engine, aiAllowed, result.aiError, accountRequired)
      // Each signed AI card image URL is one image against the user's daily image cap (the same counter as /api/generate-image),
      // so the free retries of an uncharged template result cannot be used to mint unlimited paid images. Cards past the cap get stock photos.
      let aiImageSlots = anonTemplate ? 0 : Infinity
      if (gate.user && !anonTemplate && config.image.autoGenerate && imageAiEnabled()) {
        const cards = (params.posts ? result.pack.posts.length : 0) + (params.stories ? result.pack.stories.length : 0)
        const userId = gate.user.id
        const granted = await Promise.all(Array.from({ length: cards }, () => consumeDailyBudget(`img:${userId}`, config.limits.dailyMaxImagesPerUser)))
        aiImageSlots = granted.filter(Boolean).length
      }
      generation = toGeneration(params, version, result, aiImageSlots)
    } catch (err) {
      await chargeUsage(gate, 0) // nothing was delivered: give the reservation back
      throw err
    }

    logEvent({
      type: 'generation',
      generationId: generation.id,
      brandName: params.brandName,
      segment: params.segment,
      objective: params.objective,
      style: params.style,
      version,
      engine: result.engine,
      model: result.model,
      score: result.report.score,
      passed: result.report.passed,
      repaired: result.repaired,
      calls: result.calls,
      latencyMs: result.latencyMs,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      openIssues: openIssues(result.report),
      aiError: result.engine === 'template' ? result.aiError : undefined,
    })
    if (failure.kind && !accountRequired) logEvent({ type: 'ai_unavailable', route: 'generate', aiErrorKind: failure.kind, errorCode: failure.code })
    if (!accountRequired) recordAiCall({
      route: 'generate',
      provider: config.ai.provider,
      model: result.model,
      outcome: (failure.kind ?? (result.repaired ? 'repaired' : 'ok')) as AiOutcome,
      engine: result.engine,
      latencyMs: result.latencyMs,
      qualityScore: result.report.score,
      retries: Math.max(0, result.calls - 1),
      errorCode: failure.code,
      userId: gate.user?.id,
    })
    console.log(
      `[MIDFLOW] V${version} "${params.brandName}" (${params.segment}) → ${result.engine} nota ${result.report.score}${result.repaired ? ' (revisado)' : ''} em ${result.latencyMs} ms`,
    )

    // Only AI-delivered content is charged. A template answer, whatever the reason (transient failure, daily cap, AI not configured),
    // gives the reservation back in full: the client retries a transient one by itself, and nothing paid was delivered.
    const delivered = generationCost(generation.posts.length, generation.stories.length)
    const usage = await chargeUsage(gate, failure.kind ? 0 : delivered)
    sendJson(res, 200, {
      success: true,
      generation,
      aiErrorKind: failure.kind,
      retryable: failure.retryable,
      ...(failure.accountRequired ? { code: 'account_required' } : {}),
      ...(usage ? { usage } : {}),
    })
  },

  'POST /api/rewrite': async (req, res) => {
    await rateLimit(req, 'rewrite', config.limits.rewritePerHour)
    const body = await readJson(req)
    const c = body.creative || {}
    const payload: AIRewriteRequest = {
      creative: {
        headline: text(c.headline, 200) || text(body.text, 200) || 'Destaque especial',
        highlight: text(c.highlight, 80),
        sub: text(c.sub, 300),
        bullets: Array.isArray(c.bullets) ? c.bullets.map((b: unknown) => text(b, 120)).slice(0, 5) : undefined,
        cta: text(c.cta, 60) || 'Saiba mais',
        caption: text(c.caption, 2200),
        hashtags: Array.isArray(c.hashtags) ? c.hashtags.map((h: unknown) => text(h, 40)).slice(0, 15) : undefined,
      },
      mode: oneOf(body.mode, ['vendedor', 'curto', 'sofisticado', 'descontraido', 'educativo'] as const, 'vendedor'),
      brandName: text(body.brandName, 80),
      segment: slug(body.segment),
      city: text(body.city, 80),
      seed: int(body.seed, 1, 1_000_000, 1),
    }
    // Rewrites are not counted against the monthly allowance, but an account with none left cannot spend AI on them.
    const gate = await quotaGate(req, 1, { reserve: false })
    // Anonymous callers (ANON_AI=template) get the honest template rewrite; 'off' already answered 401 in anonTemplateOnly().
    const accountRequired = anonTemplateOnly(gate) && aiEnabled()
    // Daily budgets: first the caller's own (per account, or per IP for anonymous callers in ANON_AI=open), then the global rewrite
    // budget, which is separate from the text budget so rewrites can never starve /api/generate. Over either → honest template rewrite.
    const subject = gate.user ? gate.user.id : `ip:${clientIp(req)}`
    const aiAllowed = accountRequired
      ? false
      : !aiEnabled() ||
        ((await consumeDailyBudget(`rewrite:${subject}`, config.limits.dailyMaxRewritePerUser)) && (await consumeDailyBudget('rewrite', config.limits.dailyMaxRewrite)))
    const started = Date.now()
    const result: Awaited<ReturnType<typeof rewriteWithAI>> = aiAllowed
      ? await rewriteWithAI(payload)
      : {
          success: true,
          engine: 'template',
          aiError: accountRequired ? 'Crie uma conta gratuita para gerar com IA.' : 'Limite diário de uso da IA atingido.',
          data: synthesizeContextualRewrite({ ...payload, brandName: payload.brandName || 'Sua Marca' }),
        }
    const failure = aiFailure(result.engine, aiAllowed, result.aiError, accountRequired)
    logEvent({ type: 'rewrite', engine: result.engine, mode: payload.mode, brandName: payload.brandName })
    if (failure.kind && !accountRequired) logEvent({ type: 'ai_unavailable', route: 'rewrite', aiErrorKind: failure.kind, errorCode: failure.code })
    if (!accountRequired) recordAiCall({
      route: 'rewrite',
      provider: config.ai.provider,
      model: result.model,
      outcome: (failure.kind ?? 'ok') as AiOutcome,
      engine: result.engine,
      latencyMs: result.latencyMs ?? Date.now() - started,
      errorCode: failure.code,
      userId: gate.user?.id,
    })
    sendJson(res, 200, {
      success: true,
      engine: result.engine,
      data: result.data,
      aiErrorKind: failure.kind,
      retryable: failure.retryable,
      ...(failure.accountRequired ? { code: 'account_required' } : {}),
    })
  },

  /** Client rating of a generation (1–5) + optional comment — the main POC quality signal. */
  'POST /api/feedback': async (req, res) => {
    await rateLimit(req, 'events', config.limits.eventsPerHour)
    const body = await readJson(req, 8 * 1024)
    const rating = int(body.rating, 1, 5, 0)
    if (!rating) throw new HttpError(400, 'rating deve ser de 1 a 5.')
    logEvent({
      type: 'feedback',
      generationId: text(body.generationId, 40),
      rating,
      comment: text(body.comment, COMMENT_MAX_CHARS).trim() || undefined,
      brandName: text(body.brandName, 80),
      engine: text(body.engine, 20),
    })
    sendJson(res, 200, { success: true })
  },

  /** Usage events (download, edit, save…) for the POC metrics. */
  'POST /api/event': async (req, res) => {
    await rateLimit(req, 'events', config.limits.eventsPerHour)
    const body = await readJson(req, 4 * 1024)
    const type = body.type as EventType
    if (!CLIENT_EVENT_TYPES.includes(type)) throw new HttpError(400, 'Tipo de evento inválido.')
    logEvent({
      type,
      generationId: text(body.generationId, 40) || undefined,
      count: int(body.count, 1, 100, 1),
      brandName: text(body.brandName, 80) || undefined,
    })
    sendJson(res, 204, null)
  },

  /** POC dashboard data. Admin only: the ADMIN_TOKEN or a signed-in staff member with role "admin" (editors get 403). */
  'GET /api/admin/metrics': async (req, res, url) => {
    await requireStaff(req, ['admin'])
    sendJson(res, 200, metrics(int(url.searchParams.get('days'), 1, 365, 30)))
  },

  /** AI health dashboard: success rate, fallbacks by cause, latency percentiles, image sources, daily caps. Admin only. */
  'GET /api/admin/ai-health': async (req, res, url) => {
    await requireStaff(req, ['admin'])
    sendJson(res, 200, await withDb(() => loadAiHealth(parseRange(url.searchParams.get('range')))))
  },

  /** Who is calling: lets the client render the admin area by role. */
  'GET /api/admin/me': async (req, res) => {
    const staff = await requireStaff(req)
    sendJson(res, 200, { role: staff.role, userId: staff.userId, via: staff.via })
  },

  /* ---- review requests ---- */

  /** Customer asks for a human review of a generation. Anonymous allowed; a valid Bearer token links it to the account. */
  'POST /api/review': async (req, res) => {
    await rateLimit(req, 'review', config.limits.reviewPerHour)
    const user = await optionalUser(req)
    const input = parseReviewRequest(await readJson(req, REVIEW_BODY_BYTES))
    const { id } = await withDb(() => createReview(input, user?.id ?? null, getDbConfig()))
    sendJson(res, 201, { id })
  },

  /** The signed-in customer's own requests, with status and the revised creatives once an editor delivers them. */
  'GET /api/reviews/mine': async (req, res) => {
    const user = await requireUser(req)
    const db = getDbConfig()
    sendJson(res, 200, { items: db ? await withDb(() => listMyReviews(db, user.id)) : [] })
  },

  'GET /api/admin/reviews': async (req, res, url) => {
    await requireStaff(req)
    const status = url.searchParams.get('status')
    if (status && !isReviewStatus(status)) throw new HttpError(400, 'Status inválido.')
    const filter = status && isReviewStatus(status) ? status : null
    sendJson(res, 200, await withDb(() => listReviews(getDbConfig(), filter)))
  },

  /* ---- staff management (admin only) ---- */

  'GET /api/admin/staff': async (req, res) => {
    await requireStaff(req, ['admin'])
    const db = requireDb()
    const rows = await withDb(() => listStaff(db))
    sendJson(res, 200, {
      items: rows.map((r) => ({ userId: r.user_id, email: r.email, name: r.name, role: r.role, createdAt: r.created_at, createdBy: r.created_by })),
    })
  },

  'POST /api/admin/staff': async (req, res) => {
    const actor = await requireStaff(req, ['admin'])
    const db = requireDb()
    const body = await readJson(req, 4 * 1024)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'E-mail inválido.')
    if (!isStaffRole(body.role)) throw new HttpError(400, 'Perfil inválido. Use admin ou editor.')
    const role = body.role
    const staff = await withDb(async () => {
      const found = await findUserByEmail(db, email)
      if (!found) throw new HttpError(404, 'Nenhuma conta confirmada encontrada com este e-mail. Peça para a pessoa criar a conta e confirmar o e-mail primeiro.')
      // The last-admin check and the write happen in one database function under an advisory lock (no race between two demotions).
      if ((await setStaffRoleGuarded(db, found.id, role, actor.userId)) === 'last_admin') {
        throw new HttpError(409, 'Não é possível rebaixar o último administrador.')
      }
      clearStaffCache(found.id)
      return { userId: found.id, email: found.email, name: found.name, role }
    })
    sendJson(res, 200, { staff })
  },

  /* ---- billing (Stripe) ---- */

  /**
   * LGPD art. 18: deletes the signed-in customer's account and everything tied to it.
   * Order matters and every step before the last one is safe to retry:
   *   1. last-admin guard, 2. cancel the Stripe subscription (failure aborts), 3. erase review requests and detach AI rows,
   *   4. delete the Supabase Auth user (cascades to profile, brands, generations, library, subscription, usage, staff row).
   */
  'POST /api/account/delete': async (req, res) => {
    await rateLimit(req, 'account-delete', config.limits.accountDeletePerHour)
    const db = getDbConfig()
    if (!db) throw new HttpError(501, 'A exclusão de conta está disponível apenas com o banco de dados configurado.')
    const user = await requireUser(req, 'Entre na sua conta para excluí-la.')
    const body = await readJson(req, 2 * 1024)
    if (body?.confirm !== 'EXCLUIR') throw new HttpError(400, 'Digite EXCLUIR para confirmar a exclusão da conta.')

    await withDb(async () => {
      // Staff members leave the staff table first, through the advisory-locked guard, so two admins deleting themselves
      // at the same moment can never leave the panel without an admin.
      const staffRole = await getStaffRole(db, user.id)
      if (staffRole && (await removeStaffGuarded(db, user.id)) === 'last_admin') {
        throw new HttpError(409, 'Você é a única pessoa administradora. Passe a administração para outra pessoa antes de excluir a conta.')
      }
      try {
        const sub = await getSubscription(db, user.id)
        const stripeId = sub?.stripe_subscription_id
        if (stripeId && sub.status !== 'canceled') {
          const billing = getBillingConfig()
          const cancelled = billing ? await cancelStripeSubscription(billing, stripeId) : { ok: false }
          if (!cancelled.ok) {
            throw new HttpError(502, 'Não foi possível cancelar sua assinatura agora, então a conta não foi excluída. Tente novamente em instantes ou fale com o suporte.')
          }
        }

        await deleteUserReviews(db, user.id)
        await anonymizeAiEvents(db, user.id)
        await deleteAuthUser(db, user.id)
      } catch (err) {
        // The account still exists: give the staff role back so a retry (or the panel) keeps working.
        if (staffRole) await setStaffRoleGuarded(db, user.id, staffRole, null).catch(() => undefined)
        clearStaffCache(user.id)
        throw err
      }
      clearStaffCache(user.id)
    })
    logEvent({ type: 'account_deleted' }) // no user id, e-mail or brand: only the fact that it happened
    sendJson(res, 200, { success: true })
  },

  /** Starts a Stripe Checkout for the signed-in user. The browser names a plan and interval; prices stay on the server. */
  'POST /api/billing/checkout': async (req, res) => {
    await rateLimit(req, 'billing', config.limits.billingPerHour)
    const cfg = getBillingConfig()
    const db = getDbConfig()
    if (!cfg || !db) throw new HttpError(503, 'Pagamentos indisponíveis no momento.')
    const user = await requireUser(req, 'Entre na sua conta para assinar.')
    const parsed = parseCheckoutRequest(await readJson(req, 4 * 1024))
    if (!parsed) throw new HttpError(400, 'Plano inválido.')
    let sub: Awaited<ReturnType<typeof getSubscription>>
    try {
      sub = await getSubscription(db, user.id)
    } catch {
      throw new HttpError(503, 'Não foi possível verificar sua assinatura agora. Tente novamente em instantes.')
    }
    // A second subscription would bill twice. Plan changes and cancellation go through the Stripe Customer Portal (POST /api/billing/portal).
    if (hasLiveSubscription(sub)) throw new HttpError(409, 'Você já tem uma assinatura ativa. Use "Gerenciar assinatura" para trocar de plano ou cancelar.')
    const r = await createCheckoutSession(cfg, { userId: user.id, email: user.email, plan: parsed.plan, interval: parsed.interval, customerId: sub?.stripe_customer_id })
    if (!r.ok) throw new HttpError(r.status, r.error)
    sendJson(res, 200, { url: r.url })
  },

  /**
   * Stripe Customer Portal: the signed-in customer manages the plan, payment method and cancellation on Stripe's hosted page.
   * The customer id comes from the subscriptions table (written by the webhook), never from the browser.
   */
  'POST /api/billing/portal': async (req, res) => {
    await rateLimit(req, 'billing', config.limits.billingPerHour)
    const cfg = getBillingConfig()
    const db = getDbConfig()
    if (!cfg || !db) throw new HttpError(503, 'Pagamentos indisponíveis no momento.')
    const user = await requireUser(req, 'Entre na sua conta para gerenciar a assinatura.')
    let sub: Awaited<ReturnType<typeof getSubscription>>
    try {
      sub = await getSubscription(db, user.id)
    } catch {
      throw new HttpError(503, 'Não foi possível verificar sua assinatura agora. Tente novamente em instantes.')
    }
    if (!sub?.stripe_customer_id) throw new HttpError(404, 'Nenhuma assinatura encontrada.')
    const r = await createPortalSession(cfg, { customerId: sub.stripe_customer_id })
    if (!r.ok) throw new HttpError(r.status, r.error)
    sendJson(res, 200, { url: r.url })
  },

  /**
   * Stripe to server. No auth and no CORS: the signature over the raw body is the credential.
   * The body and the signature header are never logged.
   */
  'POST /api/billing/webhook': async (req, res) => {
    const secret = stripeWebhookSecret()
    const db = getDbConfig()
    if (!secret || !db) throw new HttpError(503, 'Pagamentos indisponíveis no momento.')
    const raw = await readRawBody(req, 256 * 1024)
    const header = req.headers['stripe-signature']
    const verified = await verifyStripeWebhook(raw, Array.isArray(header) ? header[0] : header, secret)
    if (!verified.ok) {
      sendJson(res, 400, { error: verified.reason })
      return
    }
    const event = verified.event
    let claim: Awaited<ReturnType<typeof claimStripeEventState>>
    try {
      claim = await claimStripeEventState(db, event.id)
    } catch {
      throw new HttpError(500, 'retry')
    }
    if (claim === 'processed') {
      sendJson(res, 200, { received: true, duplicate: true })
      return
    }
    if (claim === 'in_flight') {
      // Another delivery is still applying this event and may yet fail: a 2xx now would make Stripe stop retrying an event
      // that is not persisted. 503 keeps it retrying until the claim is processed (duplicate) or goes stale (taken over).
      throw new HttpError(503, 'retry')
    }
    try {
      const update = handleStripeEvent(event, getBillingConfig() ?? { prices: {} })
      if (update && !(await applySubscriptionUpdate(db, update))) console.warn('[billing] subscription owner unknown for event', event.id)
      await markStripeEventProcessed(db, event.id)
    } catch (err) {
      if (err instanceof DbError && err.status === 409 && err.code === '23505') {
        // The Stripe customer or subscription id already belongs to another account row. Retrying cannot fix that, so
        // answer 2xx (Stripe would otherwise retry for days) and leave the trace for a human.
        console.error('[billing] unique violation applying event', event.id, event.type)
        await markStripeEventProcessed(db, event.id).catch(() => undefined)
        sendJson(res, 200, { received: true, ignored: true })
        return
      }
      await releaseStripeEvent(db, event.id).catch(() => undefined) // let Stripe retry
      throw new HttpError(500, 'retry')
    }
    sendJson(res, 200, { received: true })
  },
}

/** Routes with a path parameter. Captured groups are passed to the handler as `params`. */
const UUID_PATH = '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'
const paramRoutes: { method: string; re: RegExp; handler: Handler }[] = [
  {
    method: 'GET',
    re: new RegExp(`^/api/admin/reviews/${UUID_PATH}$`),
    handler: async (req, res, _url, [id]) => {
      await requireStaff(req)
      sendJson(res, 200, await withDb(() => getReview(getDbConfig(), id.toLowerCase())))
    },
  },
  {
    method: 'PATCH',
    re: new RegExp(`^/api/admin/reviews/${UUID_PATH}$`),
    handler: async (req, res, _url, [id]) => {
      const staff = await requireStaff(req)
      const db = requireDb()
      const patch = parseReviewPatch(await readJson(req, 8 * 1024))
      sendJson(res, 200, { item: await withDb(() => updateReview(db, id.toLowerCase(), patch, actorOf(staff))) })
    },
  },
  {
    method: 'POST',
    re: new RegExp(`^/api/admin/reviews/${UUID_PATH}/revision$`),
    handler: async (req, res, _url, [id]) => {
      const staff = await requireStaff(req)
      const db = requireDb()
      const body = await readJson(req, REVIEW_BODY_BYTES)
      const outputs = parseOutputs(body?.outputs, { required: true })
      sendJson(res, 200, { item: await withDb(() => reviseReview(db, id.toLowerCase(), outputs, actorOf(staff))) })
    },
  },
  {
    method: 'DELETE',
    re: new RegExp(`^/api/admin/staff/${UUID_PATH}$`),
    handler: async (req, res, _url, [userId]) => {
      await requireStaff(req, ['admin'])
      const db = requireDb()
      const target = userId.toLowerCase()
      await withDb(async () => {
        const result = await removeStaffGuarded(db, target)
        if (result === 'not_found') throw new HttpError(404, 'Pessoa não encontrada na equipe.')
        if (result === 'last_admin') throw new HttpError(409, 'Não é possível remover o último administrador.')
        clearStaffCache(target)
      })
      sendJson(res, 200, { success: true })
    },
  },
]

const REQUEST_ID = /^[\w-]{8,64}$/

/** One JSON line per request. Only method, path (no query string), status, duration and request id: no body, token or IP. */
function logRequest(method: string, path: string, status: number, startedAt: number, requestId: string) {
  if (!config.logRequests) return
  console.log(JSON.stringify({ level: 'info', msg: 'api', method, path, status, ms: Date.now() - startedAt, requestId }))
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', 'http://localhost')
  const pathname = url.pathname.replace(/\/+$/, '') || '/'
  if (!pathname.startsWith('/api/')) return false

  const startedAt = Date.now()
  const incoming = String(req.headers['x-request-id'] || '')
  const requestId = REQUEST_ID.test(incoming) ? incoming : randomUUID()
  res.setHeader('X-Request-Id', requestId)
  const method = req.method || 'GET'

  try {
    applyCors(req, res)
    if (method === 'OPTIONS') {
      sendJson(res, 204, null)
      return true
    }

    let handler: Handler | undefined = routes[`${method} ${pathname}`]
    let params: string[] = []
    if (!handler) {
      for (const r of paramRoutes) {
        const m = r.method === method ? r.re.exec(pathname) : null
        if (m) {
          handler = r.handler
          params = m.slice(1)
          break
        }
      }
    }
    if (!handler) {
      const exists = Object.keys(routes).some((k) => k.endsWith(` ${pathname}`)) || paramRoutes.some((r) => r.re.test(pathname))
      sendJson(res, exists ? 405 : 404, { error: exists ? 'Método não permitido.' : 'Rota não encontrada.' })
      return true
    }

    try {
      await handler(req, res, url, params)
    } catch (err: any) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, ...err.extra })
      } else {
        console.error(JSON.stringify({ level: 'error', msg: 'unhandled', method, path: pathname, requestId, error: String(err?.message || err).slice(0, 300) }))
        if (!res.headersSent) sendJson(res, 500, { error: 'Erro interno. Tente novamente.' })
      }
    }
    return true
  } finally {
    logRequest(method, pathname, res.statusCode, startedAt, requestId)
  }
}
