/**
 * One place that talks to the text model. Handles timeouts, retries with backoff,
 * structured JSON output and clear error reporting (no silent failures).
 */
import { config } from '../config.ts'

export interface LLMRequest {
  system: string
  user: string
  /** Gemini responseSchema (OpenAPI subset). OpenAI uses JSON mode + our own validation. */
  schema?: Record<string, unknown>
  temperature?: number
}

export interface LLMResult {
  ok: boolean
  data?: any
  engine: 'gemini' | 'openai' | 'none'
  model: string
  latencyMs: number
  attempts: number
  error?: string
  /** HTTP status of the last failed call (401 = bad key, 404 = model not found, 429 = quota…) */
  status?: number
  usage?: { inputTokens?: number; outputTokens?: number }
}

/** Last provider error, shown on the Settings page and /api/status so problems are visible. */
export const llmHealth: { lastOkAt?: number; lastErrorAt?: number; lastError?: string; lastStatus?: number } = {}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504])

export function parseJsonText(raw: string): any {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced?.[1]?.trim() ?? trimmed
  try {
    return JSON.parse(body)
  } catch {
    const a = body.indexOf('{')
    const b = body.lastIndexOf('}')
    if (a !== -1 && b > a) return JSON.parse(body.slice(a, b + 1))
    throw new Error('Resposta da IA não é um JSON válido.')
  }
}

function describe(status: number | undefined, text: string, model: string): string {
  if (status === 400 && /API key/i.test(text)) return 'Chave de API inválida.'
  if (status === 401 || status === 403) return 'Chave de API inválida ou sem permissão para este modelo.'
  if (status === 404) return `Modelo "${model}" não encontrado. Ajuste AI_MODEL no .env.`
  if (status === 429) return 'Limite de uso/cota do provedor de IA atingido. Tente em alguns minutos.'
  if (status && status >= 500) return 'Provedor de IA instável no momento.'
  return text.slice(0, 200) || 'Falha desconhecida no provedor de IA.'
}

async function callGemini(req: LLMRequest, signal: AbortSignal, model: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    // Key in a header, not the URL, so it never shows up in proxy/access logs.
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.ai.geminiKey },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: [{ text: req.user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        ...(req.schema ? { responseSchema: req.schema } : {}),
        temperature: req.temperature ?? 0.85,
      },
    }),
  })
  const text = await res.text()
  if (!res.ok) return { ok: false as const, status: res.status, text }
  const json = JSON.parse(text)
  const parts: any[] = json.candidates?.[0]?.content?.parts ?? []
  const out = parts.map((p) => p.text ?? '').join('')
  if (!out) {
    const reason = json.candidates?.[0]?.finishReason || json.promptFeedback?.blockReason || 'vazia'
    return { ok: false as const, status: 502, text: `Resposta ${reason} do modelo.` }
  }
  return {
    ok: true as const,
    out,
    usage: { inputTokens: json.usageMetadata?.promptTokenCount, outputTokens: json.usageMetadata?.candidatesTokenCount },
  }
}

async function callOpenAI(req: LLMRequest, signal: AbortSignal, model: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.openaiKey}` },
    signal,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: `${req.system}\nResponda SOMENTE com um objeto JSON válido.` },
        { role: 'user', content: req.user },
      ],
      response_format: { type: 'json_object' },
      temperature: req.temperature ?? 0.85,
    }),
  })
  const text = await res.text()
  if (!res.ok) return { ok: false as const, status: res.status, text }
  const json = JSON.parse(text)
  const out = json.choices?.[0]?.message?.content
  if (!out) return { ok: false as const, status: 502, text: 'Resposta vazia do modelo.' }
  return {
    ok: true as const,
    out,
    usage: { inputTokens: json.usage?.prompt_tokens, outputTokens: json.usage?.completion_tokens },
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Errors where another model may still work (quota, overload, timeout, model retired). */
const TRY_NEXT_MODEL = new Set([404, 408, 429, 500, 502, 503, 504])

export async function callLLM(req: LLMRequest): Promise<LLMResult> {
  const start = Date.now()
  const engine = config.ai.provider
  const models = [config.ai.model, ...config.ai.fallbackModels.filter((m) => m !== config.ai.model)]
  if (engine === 'none') {
    return { ok: false, engine, model: models[0], latencyMs: 0, attempts: 0, error: 'Nenhuma chave de IA configurada no servidor.' }
  }

  let attempts = 0
  let lastStatus: number | undefined
  let lastError = ''
  let model = models[0]
  for (model of models) {
    for (let tryNo = 0; tryNo <= config.ai.maxRetries; tryNo++) {
      attempts++
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs)
      try {
        const r = engine === 'gemini' ? await callGemini(req, controller.signal, model) : await callOpenAI(req, controller.signal, model)
        if (r.ok) {
          const data = parseJsonText(r.out)
          llmHealth.lastOkAt = Date.now()
          return { ok: true, data, engine, model, latencyMs: Date.now() - start, attempts, usage: r.usage }
        }
        lastStatus = r.status
        lastError = describe(r.status, r.text, model)
        // 429 = quota: retrying the same model right away won't help, go to the next one.
        if (!RETRYABLE.has(r.status) || r.status === 429) break
      } catch (err: any) {
        lastStatus = err?.name === 'AbortError' ? 408 : undefined
        lastError = err?.name === 'AbortError' ? `Tempo limite de ${config.ai.timeoutMs / 1000}s excedido.` : String(err?.message || err)
      } finally {
        clearTimeout(timer)
      }
      if (tryNo < config.ai.maxRetries) await sleep(1000 * 3 ** tryNo)
    }
    if (lastStatus === undefined || !TRY_NEXT_MODEL.has(lastStatus)) break
    console.warn(`[MIDFLOW AI] ${engine}/${model} indisponível (${lastError}) — tentando o próximo modelo.`)
  }

  llmHealth.lastErrorAt = Date.now()
  llmHealth.lastError = lastError
  llmHealth.lastStatus = lastStatus
  console.warn(`[MIDFLOW AI] ${engine} falhou após ${attempts} tentativa(s): ${lastError}`)
  return { ok: false, engine, model, latencyMs: Date.now() - start, attempts, error: lastError, status: lastStatus }
}
