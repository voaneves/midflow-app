import type { IncomingMessage, ServerResponse } from 'http'
import { rewriteWithAI, type AIRewriteRequest } from './aiService.ts'
import { callLLM, llmHealth } from './ai/llm.ts'
import { generatePack, type PackResult } from './ai/pipeline.ts'
import { openIssues } from './ai/quality.ts'
import type { GenerateParams } from './ai/types.ts'
import { aiEnabled, config, imageAiEnabled, imageModelName } from './config.ts'
import { imageHealth } from './ai/image.ts'
import { applyCors, HttpError, rateLimit, readJson, requireAdmin, sendJson } from './http.ts'
import { buildApiImageUrl, isEditorialPhotoId, resolveContextualImage, selectContextualPhotoId, selectEditorialPhotoId } from './imageService.ts'
import { CLIENT_EVENT_TYPES, logEvent, metrics, type EventType } from './telemetry.ts'

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

function toGeneration(params: GenerateParams, version: number, result: PackResult) {
  const baseSeed = (params.seed || 1) + version * 97
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
      forceAi: config.image.autoGenerate && imageAiEnabled(),
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

type Handler = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>

const routes: Record<string, Handler> = {
  'GET /api/health': async (_req, res) => {
    sendJson(res, 200, { status: 'ok', uptime: Math.round(process.uptime()) })
  },

  /** Honest status of the AI: shown on the Settings page. Never exposes keys. */
  /**
   * Public: only whether AI is on. Details (vendor, model, errors) are internal — shown outside
   * production or with the ADMIN_TOKEN (Authorization: Bearer … or ?token=…).
   */
  'GET /api/status': async (req, res, url) => {
    if (config.isProd) {
      try {
        requireAdmin(req, url)
      } catch {
        sendJson(res, 200, { aiEnabled: aiEnabled(), imageAi: imageAiEnabled() })
        return
      }
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
  'POST /api/test-ai': async (req, res, url) => {
    if (config.isProd) requireAdmin(req, url)
    rateLimit(req, 'test', 20)
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
    let forceAi = q.get('ai') === '1' && imageAiEnabled()
    if (forceAi) {
      // Over the AI image limit → serve the stock-photo fallback instead of a broken image.
      try {
        rateLimit(req, 'ai-image', config.limits.aiImagePerHour)
      } catch (err) {
        if (!(err instanceof HttpError) || err.status !== 429) throw err
        forceAi = false
      }
    }
    if (!forceAi) rateLimit(req, 'image', config.limits.imagePerHour)
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
    })
    res.statusCode = 200
    res.setHeader('Content-Type', result.mimeType)
    // An AI image is tied to its URL (prompt + seed): keep it, so thumbnail, preview and PNG export match.
    // A fallback served in place of an AI image is cached briefly, so a later view can still get the AI one.
    const asked = q.get('ai') === '1' && imageAiEnabled()
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
      forceAi: true,
    })
    sendJson(res, 200, { success: true, imageUrl, seed, aiEnabled: imageAiEnabled() })
  },

  'POST /api/generate': async (req, res) => {
    rateLimit(req, 'generate', config.limits.generatePerHour)
    const body = await readJson(req)
    const params = sanitizeParams(body.params)
    const version = int(body.version, 1, 999, 1)

    const result = await generatePack(params, version)
    if (result.engine === 'template' && config.ai.requireLlm) {
      throw new HttpError(503, config.isProd ? 'A IA está indisponível no momento. Tente novamente em instantes.' : `A IA está indisponível no momento (${result.aiError}). Tente novamente em instantes.`)
    }
    const generation = toGeneration(params, version, result)

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
    console.log(
      `[MIDFLOW] V${version} "${params.brandName}" (${params.segment}) → ${result.engine} nota ${result.report.score}${result.repaired ? ' (revisado)' : ''} em ${result.latencyMs} ms`,
    )
    sendJson(res, 200, { success: true, generation })
  },

  'POST /api/rewrite': async (req, res) => {
    rateLimit(req, 'rewrite', config.limits.rewritePerHour)
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
    const result = await rewriteWithAI(payload)
    logEvent({ type: 'rewrite', engine: result.engine, mode: payload.mode, brandName: payload.brandName })
    sendJson(res, 200, { success: true, engine: result.engine, data: result.data })
  },

  /** Client rating of a generation (1–5) + optional comment — the main POC quality signal. */
  'POST /api/feedback': async (req, res) => {
    rateLimit(req, 'events', config.limits.eventsPerHour)
    const body = await readJson(req, 8 * 1024)
    const rating = int(body.rating, 1, 5, 0)
    if (!rating) throw new HttpError(400, 'rating deve ser de 1 a 5.')
    logEvent({
      type: 'feedback',
      generationId: text(body.generationId, 40),
      rating,
      comment: text(body.comment, 1000).trim() || undefined,
      brandName: text(body.brandName, 80),
      engine: text(body.engine, 20),
    })
    sendJson(res, 200, { success: true })
  },

  /** Usage events (download, edit, save…) for the POC metrics. */
  'POST /api/event': async (req, res) => {
    rateLimit(req, 'events', config.limits.eventsPerHour)
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

  /** POC dashboard data. Requires ADMIN_TOKEN (header "Authorization: Bearer …" or ?token=…). */
  'GET /api/admin/metrics': async (req, res, url) => {
    requireAdmin(req, url)
    sendJson(res, 200, metrics(int(url.searchParams.get('days'), 1, 365, 30)))
  },
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', 'http://localhost')
  const pathname = url.pathname.replace(/\/+$/, '') || '/'
  if (!pathname.startsWith('/api/')) return false

  applyCors(req, res)
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, null)
    return true
  }

  const handler = routes[`${req.method} ${pathname}`]
  if (!handler) {
    const exists = Object.keys(routes).some((k) => k.endsWith(` ${pathname}`))
    sendJson(res, exists ? 405 : 404, { error: exists ? 'Método não permitido.' : 'Rota não encontrada.' })
    return true
  }

  try {
    await handler(req, res, url)
  } catch (err: any) {
    if (err instanceof HttpError) {
      sendJson(res, err.status, { error: err.message })
    } else {
      console.error(`[MIDFLOW] Erro em ${req.method} ${pathname}:`, err)
      if (!res.headersSent) sendJson(res, 500, { error: 'Erro interno. Tente novamente.' })
    }
  }
  return true
}
