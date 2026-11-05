/**
 * AI image generation. One entry point, two providers:
 *  - Cloudflare Workers AI (free daily allowance — good for testing / POC)
 *  - Gemini image models "Nano Banana" (paid tier only)
 * Returns null on any failure; the caller then uses a curated photo, so the user always gets an image.
 */
import { config } from '../config.ts'

export interface AIImage {
  buffer: Buffer
  mimeType: string
  source: string
}

/** Last image error, shown by /api/status. */
export const imageHealth: { lastOkAt?: number; lastErrorAt?: number; lastError?: string; lastCode?: ImageErrorCode } = {}

/** Subset of the AI health error vocabulary that image failures use. */
export type ImageErrorCode = 'invalid_key' | 'model_not_found' | 'rate_limit' | 'timeout' | 'provider_error'

/** Maps an image failure message to a stable code. Auth/permission/token/account problems are 'invalid_key' (kind: config). */
export function classifyImageError(message: string): ImageErrorCode {
  const m = message.toLowerCase()
  if (/token|permiss|autoriz|unauthor|forbidden|api key|chave|account id|\b(401|403)\b/.test(m)) return 'invalid_key'
  if (/\b404\b|não encontrado|not found/.test(m)) return 'model_not_found'
  if (/cota|quota|\b429\b/.test(m)) return 'rate_limit'
  if (m.includes('tempo limite')) return 'timeout'
  return 'provider_error'
}

function fail(message: string, code?: ImageErrorCode): null {
  imageHealth.lastErrorAt = Date.now()
  imageHealth.lastError = message
  imageHealth.lastCode = code ?? classifyImageError(message)
  console.warn(`[MIDFLOW Image] ${message}`)
  return null
}

function ok(img: AIImage): AIImage {
  imageHealth.lastOkAt = Date.now()
  return img
}

const PROMPT_PREFIX = 'Professional high quality photograph for an Instagram post, natural light, no text, no letters, no logos, no watermark. '

/**
 * Workers AI answers in two shapes depending on the model:
 *  - JSON  { result: { image: "<base64>" } }   (flux-1-schnell)
 *  - raw   image/png bytes                      (stable-diffusion-xl and others)
 * Exported for tests.
 */
export async function parseCloudflareImage(res: Response): Promise<{ buffer: Buffer; mimeType: string } | { error: string }> {
  const type = res.headers.get('content-type') || ''
  if (type.startsWith('image/')) {
    const buffer = Buffer.from(await res.arrayBuffer())
    return buffer.length > 2000 ? { buffer, mimeType: type.split(';')[0] } : { error: 'imagem vazia' }
  }
  const json: any = await res.json().catch(() => null)
  if (!json) return { error: `resposta inesperada (${type || 'sem content-type'})` }
  if (json.success === false || json.errors?.length) {
    return { error: json.errors?.map((e: any) => e.message).join('; ') || 'erro desconhecido' }
  }
  const b64 = json.result?.image
  if (typeof b64 !== 'string' || !b64) return { error: 'resposta sem imagem' }
  const buffer = Buffer.from(b64, 'base64')
  // flux returns JPEG; sniff PNG just in case
  const mimeType = buffer[0] === 0x89 && buffer[1] === 0x50 ? 'image/png' : 'image/jpeg'
  return buffer.length > 2000 ? { buffer, mimeType } : { error: 'imagem vazia' }
}

/** Provider text that is safe to keep: one line, no URLs, no key-like strings, at most `max` chars. */
export function cleanProviderText(v: unknown, max = 160): string {
  if (typeof v !== 'string') return ''
  return v
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[redigido]')
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** First error of a Workers AI error body ({ errors: [{ code, message }] }); null when the body is not that shape. */
export function parseCloudflareError(text: string): { code?: number; message: string } | null {
  try {
    const json: any = JSON.parse(text)
    const first = Array.isArray(json?.errors) ? json.errors[0] : null
    const message = cleanProviderText(first?.message)
    if (!message) return null
    return { code: Number.isFinite(Number(first.code)) ? Number(first.code) : undefined, message }
  } catch {
    return null
  }
}

/** True when a 429 means the free daily allowance is used up (code 4006), as opposed to a momentary capacity limit (3040). */
export function isDailyAllocationError(e: { code?: number; message: string } | null): boolean {
  return !!e && (e.code === 4006 || /daily (free )?allocation|daily.*neurons/i.test(e.message))
}

const DAILY_EXHAUSTED = 'cota diária gratuita do Workers AI esgotada (10.000 neurons; renova à meia-noite UTC). Assine o Workers Paid para continuar.'

/**
 * After a daily-allocation 429 (4006) Workers AI is not called again until the next 00:00 UTC: the card goes straight to the
 * stock/catalog fallback instead of burning a request per image. Module-level, so best-effort per Worker isolate.
 */
export const cloudflareDaily = {
  until: 0,
  block(now = Date.now()) {
    const d = new Date(now)
    this.until = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
  },
  blocked: (now = Date.now()) => now < cloudflareDaily.until,
  reset() {
    this.until = 0
  },
}

/** pt-BR failure text for a non-OK Workers AI answer, keeping the provider's code and message (short, no URLs). */
export function describeCloudflareFailure(status: number, body: string): string {
  const err = parseCloudflareError(body)
  const detail = err ? `${err.code ? ` (${err.code})` : ''}: ${err.message}` : ''
  if (status === 429) {
    const code = err?.code ? ` (${err.code})` : ''
    if (isDailyAllocationError(err)) return `Cloudflare 429${code}: ${DAILY_EXHAUSTED}`
    return `Cloudflare 429${code}: limite momentâneo do Workers AI (muitas imagens ao mesmo tempo)${err ? ` — ${err.message}` : ''}`
  }
  return `Cloudflare ${status}${detail || `: ${body.replace(/\s+/g, ' ').slice(0, 160)}`}`
}

/** Retry policy for a 429 that looks like a momentary limit (Workers AI capacity, Gemini per-minute). Exported so tests can run without real waiting. */
export const imageRetry = {
  delaysMs: [1500, 4000],
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}

/** Retry-After header (seconds or HTTP date) in ms; null when absent or unusable. */
function retryAfterMs(res: Response): number | null {
  const v = res.headers.get('retry-after')
  if (!v) return null
  const secs = Number(v)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const at = Date.parse(v)
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null
}

async function cloudflare(prompt: string, kind: 'post' | 'story'): Promise<AIImage | null> {
  const { cfAccountId, cfApiToken, cfModel, timeoutMs } = config.image
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfAccountId)}/ai/run/${cfModel}`
  const isFlux = cfModel.includes('flux')
  const body = isFlux
    ? { prompt: (PROMPT_PREFIX + prompt).slice(0, 2048), steps: 6 }
    : { prompt: PROMPT_PREFIX + prompt, width: 1024, height: kind === 'story' ? 1536 : 1280, num_steps: 20 }

  if (cloudflareDaily.blocked()) return fail(`Cloudflare 429 (4006): ${DAILY_EXHAUSTED}`, 'rate_limit')

  const deadline = Date.now() + timeoutMs
  try {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfApiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      })
      if (res.ok) {
        const parsed = await parseCloudflareImage(res)
        if ('error' in parsed) return fail(`Cloudflare: ${parsed.error}`)
        return ok({ ...parsed, source: 'cloudflare-ai' })
      }
      const text = (await res.text()).slice(0, 600)
      if (res.status === 429) {
        // Burst limit: wait and try again (Retry-After wins over the fixed backoff), never past the overall timeout.
        const wait = retryAfterMs(res) ?? imageRetry.delaysMs[attempt]
        const daily = isDailyAllocationError(parseCloudflareError(text))
        if (daily) cloudflareDaily.block()
        if (!daily && wait !== undefined && attempt < imageRetry.delaysMs.length && Date.now() + wait < deadline) {
          await imageRetry.sleep(wait)
          continue
        }
        return fail(describeCloudflareFailure(429, text), 'rate_limit')
      }
      if (res.status === 401 || res.status === 403) return fail('Cloudflare: token inválido ou sem permissão "Workers AI".', 'invalid_key')
      if (res.status === 404 && text.includes('7003')) return fail('Cloudflare: CF_AI_ACCOUNT_ID inválido (confira o Account ID no painel).', 'invalid_key')
      return fail(describeCloudflareFailure(res.status, text))
    }
  } catch (err: any) {
    return fail(`Cloudflare: ${err?.name === 'TimeoutError' ? 'tempo limite excedido' : err?.message}`)
  }
}

/** Body for the Gemini image models: only an image back, with the card's aspect ratio. `minimal` is the old shape (no imageConfig). */
export function geminiImageBody(prompt: string, kind: 'post' | 'story', minimal = false) {
  return {
    contents: [{ role: 'user', parts: [{ text: PROMPT_PREFIX + prompt }] }],
    generationConfig: minimal
      ? { responseModalities: ['TEXT', 'IMAGE'] }
      : { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: kind === 'story' ? '9:16' : '4:5', imageSize: '1K' } },
  }
}

/** error.{code,status,message} of a Gemini error body; null when the body is not that shape. */
export function parseGeminiError(text: string): { code?: number; status?: string; message: string } | null {
  try {
    const e: any = JSON.parse(text)?.error
    const message = cleanProviderText(e?.message)
    if (!message && !e?.status) return null
    return {
      code: Number.isFinite(Number(e.code)) ? Number(e.code) : undefined,
      status: typeof e.status === 'string' ? e.status.replace(/[^A-Z_]/g, '').slice(0, 40) || undefined : undefined,
      message,
    }
  } catch {
    return null
  }
}

/** The 400 that means "this model does not take imageConfig / these modalities": worth one retry with the minimal body. */
const GEMINI_SHAPE_ERROR = /imageconfig|image_config|aspect.?ratio|imagesize|image_size|responsemodalit|response_modalit/i

/** A 429 that is a per-minute rate limit (retry helps), not billing or a quota that is not enabled (retry is pointless). */
export function isGeminiRateLimit(e: { message: string } | null): boolean {
  const m = e?.message ?? ''
  return /per ?minute|rate limit|too many requests|retry in|try again (in|later)/i.test(m) && !/billing|free[ _]tier|limit: ?0|per ?day|plan|not enabled/i.test(m)
}

/** pt-BR failure text for a non-OK Gemini answer, keeping the provider's code, status and message (short, no URLs). */
export function describeGeminiFailure(model: string, status: number, body: string): string {
  const err = parseGeminiError(body)
  const tag = err?.status ? ` (${err.status})` : ''
  const detail = err?.message ? ` — ${err.message}` : ''
  if (status === 429) return `Gemini ${model} 429${tag}: cota/limite atingido — confira o faturamento da chave${detail}`
  if (status === 401 || status === 403) return `Gemini ${model}: chave sem permissão (${status})${tag}${detail}`
  if (status === 400) return `Gemini ${model} respondeu 400${tag}${detail || ' (chave de API ou requisição inválida)'}`
  return `Gemini ${model} respondeu ${status}${tag}${detail}`
}

async function gemini(prompt: string, kind: 'post' | 'story' = 'post'): Promise<AIImage | null> {
  const model = config.ai.imageModel
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const deadline = Date.now() + config.image.timeoutMs
  const send = (minimal: boolean) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.ai.geminiKey },
      signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      body: JSON.stringify(geminiImageBody(prompt, kind, minimal)),
    })
  try {
    let minimal = false
    let retries = 0
    for (;;) {
      const res = await send(minimal)
      if (res.ok) {
        const json: any = await res.json()
        for (const part of json?.candidates?.[0]?.content?.parts || []) {
          if (part?.inlineData?.data) {
            const buffer = Buffer.from(part.inlineData.data, 'base64')
            if (buffer.length > 2000) return ok({ buffer, mimeType: part.inlineData.mimeType || 'image/png', source: 'gemini-image' })
          }
        }
        return fail(`Gemini ${model}: resposta sem imagem`)
      }
      const text = (await res.text()).slice(0, 1000)
      const err = parseGeminiError(text)
      if (res.status === 400 && !minimal && GEMINI_SHAPE_ERROR.test(err?.message ?? text)) {
        // The model does not accept the image options: ask the old way instead of breaking every image.
        minimal = true
        continue
      }
      if (res.status === 429) {
        const fromMessage = /retry in ([\d.]+)s/i.exec(err?.message ?? '')
        const wait = retryAfterMs(res) ?? (fromMessage ? Number(fromMessage[1]) * 1000 : undefined) ?? imageRetry.delaysMs[retries]
        if (isGeminiRateLimit(err) && wait !== undefined && retries < imageRetry.delaysMs.length && Date.now() + wait < deadline) {
          retries++
          await imageRetry.sleep(wait)
          continue
        }
        return fail(describeGeminiFailure(model, 429, text), 'rate_limit')
      }
      return fail(describeGeminiFailure(model, res.status, text), res.status === 401 || res.status === 403 ? 'invalid_key' : undefined)
    }
  } catch (err: any) {
    return fail(`Gemini: ${err?.name === 'TimeoutError' ? 'tempo limite excedido' : err?.message}`)
  }
}

export async function generateAIImage(prompt: string, kind: 'post' | 'story' = 'post'): Promise<AIImage | null> {
  switch (config.image.provider) {
    case 'cloudflare':
      return cloudflare(prompt, kind)
    case 'gemini':
      return gemini(prompt, kind)
    default:
      return null
  }
}
