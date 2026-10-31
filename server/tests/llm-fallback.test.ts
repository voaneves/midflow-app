import assert from 'node:assert/strict'
import { test } from 'node:test'

// Configure before the modules read process.env (each test file runs in its own process).
process.env.GEMINI_API_KEY = 'test-key'
process.env.AI_PROVIDER = 'gemini'
process.env.AI_MODEL = 'model-main'
process.env.AI_FALLBACK_MODELS = 'model-backup'
process.env.AI_MAX_RETRIES = '0'

const { callLLM } = await import('../ai/llm.ts')

test('quota on the main model → backup model answers', async () => {
  const seen: string[] = []
  globalThis.fetch = (async (url: string) => {
    seen.push(url.includes('model-main') ? 'main' : 'backup')
    if (url.includes('model-main')) return new Response('{"error":{"message":"quota"}}', { status: 429 })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"status":"ok"}' }] } }] }), { status: 200 })
  }) as typeof fetch

  const r = await callLLM({ system: 's', user: 'u' })
  assert.equal(r.ok, true)
  assert.equal(r.model, 'model-backup')
  assert.deepEqual(r.data, { status: 'ok' })
  assert.deepEqual(seen, ['main', 'backup'])
})

test('invalid key (401) does not waste calls on backup models', async () => {
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    return new Response('{"error":{"message":"API key not valid"}}', { status: 401 })
  }) as typeof fetch
  const r = await callLLM({ system: 's', user: 'u' })
  assert.equal(r.ok, false)
  assert.equal(calls, 1)
  assert.match(r.error ?? '', /Chave de API inválida/)
})
