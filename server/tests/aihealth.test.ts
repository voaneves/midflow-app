import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aiErrorKindOf, classifyAiError } from '../aiService.ts'
import { aggregateAiHealth, parseRange, percentile, toAiEventRow, type AiEventRow, type AiHealthExtras } from '../aihealth.ts'

const NOW = Date.parse('2026-11-03T12:30:00.000Z')
const extras: AiHealthExtras = { providers: [{ name: 'gemini', configured: true, model: 'm' }], maxText: 100, maxImages: Infinity, maxRewrite: 300 }

const row = (minutesAgo: number, over: Partial<AiEventRow> = {}): AiEventRow => ({
  created_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
  route: 'generate',
  provider: 'gemini',
  model: 'm',
  outcome: 'ok',
  engine: 'gemini',
  latency_ms: 1000,
  quality_score: 90,
  retries: 0,
  error_code: null,
  user_id: null,
  ...over,
})

test('percentile uses nearest rank', () => {
  assert.equal(percentile([], 0.5), null)
  assert.equal(percentile([7], 0.95), 7)
  assert.equal(percentile([50, 10, 40, 20, 30], 0.5), 30)
  assert.equal(percentile([50, 10, 40, 20, 30], 0.95), 50)
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1)
  assert.equal(percentile(hundred, 0.5), 50)
  assert.equal(percentile(hundred, 0.95), 95)
  assert.equal(percentile(hundred, 1), 100)
})

test('aggregation: totals, success rate, fallbacks by kind, latency and quality', () => {
  const rows = [
    row(5, { latency_ms: 1000, quality_score: 95 }),
    row(10, { outcome: 'repaired', latency_ms: 2000, quality_score: 80 }),
    row(15, { latency_ms: 3000, quality_score: 90 }),
    row(20, { outcome: 'transient', engine: 'template', latency_ms: 4000, quality_score: 60, error_code: 'timeout' }),
    row(25, { outcome: 'daily_cap', engine: 'template', latency_ms: 0, quality_score: null, error_code: 'daily_cap' }),
    row(30, { outcome: 'config', engine: 'template', latency_ms: 10, quality_score: null, error_code: 'not_configured', route: 'rewrite' }),
    row(60 * 30), // 30 hours ago: outside the 24h range
  ]
  const h = aggregateAiHealth(rows, '24h', NOW, 'supabase', extras)
  assert.equal(h.totals.calls, 6)
  assert.equal(h.totals.ok, 3)
  assert.equal(h.totals.fallback, 3)
  assert.equal(h.totals.successRate, 50)
  assert.deepEqual(h.totals.fallbackByKind, { transient: 1, daily_cap: 1, config: 1 })
  // latencies sorted: 0, 10, 1000, 2000, 3000, 4000 -> p50 = 3rd value, p95 = last
  assert.equal(h.latency.p50, 1000)
  assert.equal(h.latency.p95, 4000)
  // scores: 95, 80, 90, 60 -> avg 81.25 -> 81.3 (one decimal); below 85: 80 and 60
  assert.equal(h.quality.avg, 81.3)
  assert.equal(h.quality.belowThreshold, 2)
  assert.equal(h.lastError?.outcome, 'transient')
  assert.equal(h.lastError?.errorCode, 'timeout')
  assert.equal(h.storage, 'supabase')
  assert.deepEqual(h.providers, extras.providers)
})

test('aggregation: empty range gives nulls and zeros, not NaN', () => {
  const h = aggregateAiHealth([], '7d', NOW, 'events', extras)
  assert.equal(h.totals.calls, 0)
  assert.equal(h.totals.successRate, null)
  assert.equal(h.latency.p50, null)
  assert.equal(h.quality.avg, null)
  assert.equal(h.lastError, null)
  assert.equal(h.series.length, 7)
})

test('aggregation: hourly buckets for 24h, daily otherwise, empty buckets are kept', () => {
  const rows = [row(5), row(10, { outcome: 'transient', engine: 'template', latency_ms: 500 }), row(60 * 3, { latency_ms: 2500 })]
  const h = aggregateAiHealth(rows, '24h', NOW, 'supabase', extras)
  assert.equal(h.series.length, 24)
  assert.equal(h.series.at(-1)?.bucket, '2026-11-03T12:00:00.000Z')
  const last = h.series.at(-1)!
  assert.equal(last.calls, 2)
  assert.equal(last.ok, 1)
  assert.equal(last.fallback, 1)
  assert.equal(last.p95, 1000)
  assert.equal(h.series.reduce((n, b) => n + b.calls, 0), 3)
  assert.ok(h.series.some((b) => b.calls === 0 && b.p95 === null))

  const week = aggregateAiHealth([row(60 * 24 * 2)], '7d', NOW, 'supabase', extras)
  assert.equal(week.series.length, 7)
  assert.equal(week.series.at(-1)?.bucket, '2026-11-03T00:00:00.000Z')
  assert.equal(week.series.find((b) => b.calls === 1)?.bucket, '2026-11-01T00:00:00.000Z')
  assert.equal(aggregateAiHealth([], '30d', NOW, 'supabase', extras).series.length, 30)
})

test('aggregation: image sources and today\'s budget use (daily-cap rows do not consume budget)', () => {
  const rows = [
    row(1, { route: 'image', engine: 'ai' }),
    row(2, { route: 'image', engine: 'ai' }),
    row(3, { route: 'image', engine: 'stock', outcome: 'transient' }),
    row(4, { route: 'image', engine: 'procedural', outcome: 'daily_cap' }),
    row(5, { route: 'generate' }),
    row(6, { route: 'rewrite' }),
    row(7, { route: 'generate', outcome: 'daily_cap', engine: 'template' }),
  ]
  const h = aggregateAiHealth(rows, '24h', NOW, 'supabase', extras)
  assert.deepEqual(h.images, { ai: 2, stock: 1, procedural: 1 })
  assert.deepEqual(h.dailyCap.text, { used: 1, max: 100 }, 'text counts generate only')
  assert.deepEqual(h.dailyCap.rewrite, { used: 1, max: 300 })
  assert.deepEqual(h.dailyCap.images, { used: 3, max: null })
})

test('parseRange only accepts the three ranges', () => {
  assert.equal(parseRange('7d'), '7d')
  assert.equal(parseRange('30d'), '30d')
  assert.equal(parseRange('24h'), '24h')
  assert.equal(parseRange('90d'), '24h')
  assert.equal(parseRange(undefined), '24h')
})

test('toAiEventRow keeps only short fixed-vocabulary values', () => {
  const r = toAiEventRow({
    route: 'generate',
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite',
    outcome: 'ok',
    engine: 'gemini',
    latencyMs: 12.7,
    qualityScore: 150,
    retries: 2,
    errorCode: 'Resposta contendo o briefing do cliente',
    userId: 'not-a-uuid',
  })
  assert.equal(r.error_code, null)
  assert.equal(r.user_id, null)
  assert.equal(r.latency_ms, 13)
  assert.equal(r.quality_score, 100)
  assert.equal(r.model, 'gemini-3.5-flash-lite')

  const odd = toAiEventRow({ route: 'bogus' as never, outcome: 'weird' as never, engine: '<script>alert(1)</script>'.repeat(5), model: 'x'.repeat(500) })
  assert.equal(odd.route, 'generate')
  assert.equal(odd.outcome, 'transient')
  assert.ok(!/[<>()]/.test(odd.engine))
  assert.ok(odd.engine.length <= 24)
  assert.ok((odd.model ?? '').length <= 80)
})

test('error classification maps provider messages to kinds', () => {
  const cases: [string | undefined, string, string][] = [
    [undefined, 'not_configured', 'config'],
    ['Nenhuma chave de IA configurada no servidor.', 'not_configured', 'config'],
    ['Limite diário de uso da IA atingido.', 'daily_cap', 'daily_cap'],
    ['Chave de API inválida ou sem permissão para este modelo.', 'invalid_key', 'config'],
    ['Modelo "x" não encontrado. Ajuste AI_MODEL no .env.', 'model_not_found', 'config'],
    ['Limite de uso/cota do provedor de IA atingido. Tente em alguns minutos.', 'rate_limit', 'transient'],
    ['Tempo limite de 60s excedido.', 'timeout', 'transient'],
    ['Provedor de IA instável no momento.', 'provider_error', 'transient'],
    ['Resposta da IA abaixo do padrão mínimo (nota 40).', 'low_quality', 'transient'],
    ['Resposta da IA não é um JSON válido.', 'bad_response', 'transient'],
    ['fetch failed', 'network', 'transient'],
  ]
  for (const [message, code, kind] of cases) {
    assert.equal(classifyAiError(message), code, String(message))
    assert.equal(aiErrorKindOf(classifyAiError(message)), kind, String(message))
  }
})
