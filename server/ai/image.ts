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
export const imageHealth: { lastOkAt?: number; lastErrorAt?: number; lastError?: string } = {}

function fail(message: string): null {
  imageHealth.lastErrorAt = Date.now()
  imageHealth.lastError = message
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

async function cloudflare(prompt: string, kind: 'post' | 'story'): Promise<AIImage | null> {
  const { cfAccountId, cfApiToken, cfModel, timeoutMs } = config.image
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfAccountId)}/ai/run/${cfModel}`
  const isFlux = cfModel.includes('flux')
  const body = isFlux
    ? { prompt: (PROMPT_PREFIX + prompt).slice(0, 2048), steps: 6 }
    : { prompt: PROMPT_PREFIX + prompt, width: 1024, height: kind === 'story' ? 1536 : 1280, num_steps: 20 }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfApiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300)
      if (res.status === 401 || res.status === 403) return fail('Cloudflare: token inválido ou sem permissão "Workers AI".')
      if (res.status === 429) return fail('Cloudflare: cota gratuita diária esgotada (renova à meia-noite UTC).')
      if (res.status === 404 && text.includes('7003')) return fail('Cloudflare: CF_AI_ACCOUNT_ID inválido (confira o Account ID no painel).')
      return fail(`Cloudflare ${res.status}: ${text}`)
    }
    const parsed = await parseCloudflareImage(res)
    if ('error' in parsed) return fail(`Cloudflare: ${parsed.error}`)
    return ok({ ...parsed, source: 'cloudflare-ai' })
  } catch (err: any) {
    return fail(`Cloudflare: ${err?.name === 'TimeoutError' ? 'tempo limite excedido' : err?.message}`)
  }
}

async function gemini(prompt: string): Promise<AIImage | null> {
  const model = config.ai.imageModel
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.ai.geminiKey },
      signal: AbortSignal.timeout(config.image.timeoutMs),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: PROMPT_PREFIX + prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    })
    if (!res.ok) {
      if (res.status === 429) return fail(`Gemini ${model}: sem cota — imagens exigem faturamento ativo no Google.`)
      return fail(`Gemini ${model} respondeu ${res.status}`)
    }
    const json: any = await res.json()
    for (const part of json?.candidates?.[0]?.content?.parts || []) {
      if (part?.inlineData?.data) {
        const buffer = Buffer.from(part.inlineData.data, 'base64')
        if (buffer.length > 2000) return ok({ buffer, mimeType: part.inlineData.mimeType || 'image/png', source: 'gemini-image' })
      }
    }
    return fail(`Gemini ${model}: resposta sem imagem`)
  } catch (err: any) {
    return fail(`Gemini: ${err?.name === 'TimeoutError' ? 'tempo limite excedido' : err?.message}`)
  }
}

export async function generateAIImage(prompt: string, kind: 'post' | 'story' = 'post'): Promise<AIImage | null> {
  switch (config.image.provider) {
    case 'cloudflare':
      return cloudflare(prompt, kind)
    case 'gemini':
      return gemini(prompt)
    default:
      return null
  }
}
