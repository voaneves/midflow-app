import assert from 'node:assert/strict'
import { test } from 'node:test'

// Configure before the modules read process.env (each test file runs in its own process).
process.env.GEMINI_API_KEY = 'test-key'
process.env.AI_PROVIDER = 'gemini'
process.env.AI_MODEL = 'gemini-3.5-flash-lite'
process.env.AI_FALLBACK_MODELS = 'gemini-3.1-flash-lite'
process.env.AI_MAX_RETRIES = '2'
process.env.AI_TIMEOUT_MS = '50'
delete process.env.AI_THINKING_LEVEL

const { callLLM, supportsThinkingLevel } = await import('../ai/llm.ts')
const { themeLabelOf } = await import('../aiService.ts')

const ok = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"status":"ok"}' }] } }] }), { status: 200 })

test('Gemini 3+ calls ask for a low thinking level by default', async () => {
  const bodies: any[] = []
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)))
    return ok()
  }) as typeof fetch
  const r = await callLLM({ system: 's', user: 'u' })
  assert.equal(r.ok, true)
  assert.equal(bodies.length, 1)
  assert.deepEqual(bodies[0].generationConfig.thinkingConfig, { thinkingLevel: 'low' })
})

test('a model that rejects the thinking level is retried once without it', async () => {
  const bodies: any[] = []
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    bodies.push(body)
    if (body.generationConfig.thinkingConfig) {
      return new Response('{"error":{"message":"Invalid value for thinking_level"}}', { status: 400 })
    }
    return ok()
  }) as typeof fetch
  const r = await callLLM({ system: 's', user: 'u' })
  assert.equal(r.ok, true)
  assert.equal(r.model, 'gemini-3.5-flash-lite')
  assert.equal(bodies.length, 2)
  assert.equal(bodies[1].generationConfig.thinkingConfig, undefined)
})

test('a timeout goes straight to the next model instead of retrying the slow one', async () => {
  const seen: string[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const main = url.includes('gemini-3.5-flash-lite')
    seen.push(main ? 'main' : 'backup')
    if (!main) return ok()
    return new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    })
  }) as typeof fetch
  const r = await callLLM({ system: 's', user: 'u' })
  assert.equal(r.ok, true)
  assert.equal(r.model, 'gemini-3.1-flash-lite')
  assert.deepEqual(seen, ['main', 'backup'])
})

test('thinkingLevel is only sent to Gemini 3 and later', () => {
  assert.equal(supportsThinkingLevel('gemini-3.5-flash-lite'), true)
  assert.equal(supportsThinkingLevel('gemini-3.1-flash-lite'), true)
  assert.equal(supportsThinkingLevel('gemini-2.5-flash'), false)
  assert.equal(supportsThinkingLevel('gpt-4o-mini'), false)
})

test('a theme from another niche does not label the prompt', () => {
  assert.equal(themeLabelOf('servicos', 'cabelo'), undefined)
  assert.equal(themeLabelOf('beleza', 'cabelo'), 'Cuidados e Tratamentos Capilares')
  assert.equal(themeLabelOf('servicos', 'produtividade'), 'Estratégia Prática de Gestão')
  // Ids shared by several niches keep a neutral label.
  assert.equal(themeLabelOf('servicos', 'promo'), 'Promoção da Semana')
})
