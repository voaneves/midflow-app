// Quick check of the key in .env:  npm run check:ai
import { callLLM } from '../ai/llm.ts'
import { config } from '../config.ts'
console.log(`Provedor: ${config.ai.provider} | modelo: ${config.ai.model}`)
const r = await callLLM({ system: 'Responda em JSON.', user: 'Retorne {"status":"ok"}', temperature: 0 })
console.log(r.ok ? `OK — a IA respondeu em ${r.latencyMs} ms: ${JSON.stringify(r.data)}` : `FALHOU (${r.status}): ${r.error}`)
