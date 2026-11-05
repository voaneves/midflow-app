/**
 * AI health: one row per AI attempt (generate, rewrite, image) and the admin aggregation over them.
 *
 * Recording is fire-and-forget and can never fail or slow a request. Rows hold only short, fixed-vocabulary values
 * (route, outcome, engine, a coarse error code, numbers): never prompts, briefing text or keys. The one free-text field,
 * `error_detail`, is the provider's short error message (see sanitizeErrorDetail): at most 200 chars, no URLs or token-like strings.
 * Storage: Supabase table `ai_events` when configured (survives Worker restarts), otherwise the local event log.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { imageHealth } from './ai/image.ts'
import { config, getDbConfig, imageModelName } from './config.ts'
import { DbError, dbHeaders, dbRequest, type DbConfig, type Fetch } from './db/supabase.ts'
import { pruneRetention, resetRetentionPrune } from './retention.ts'
import { logEvent, readEvents } from './telemetry.ts'

export type AiRoute = 'generate' | 'rewrite' | 'image'
export type AiOutcome = 'ok' | 'repaired' | 'transient' | 'daily_cap' | 'config'
export type AiRange = '24h' | '7d' | '30d'

const ROUTES: readonly string[] = ['generate', 'rewrite', 'image']
const OUTCOMES: readonly string[] = ['ok', 'repaired', 'transient', 'daily_cap', 'config']
const ERROR_CODES: readonly string[] = ['not_configured', 'invalid_key', 'model_not_found', 'daily_cap', 'rate_limit', 'timeout', 'provider_error', 'low_quality', 'bad_response', 'network']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface AiCall {
  route: AiRoute
  provider?: string
  model?: string
  outcome: AiOutcome
  /** gemini | openai | template for text; ai | stock | procedural for images. */
  engine: string
  latencyMs?: number
  qualityScore?: number | null
  retries?: number
  /** One of the fixed codes above, or omitted. */
  errorCode?: string | null
  /** Short provider message that explains the code (e.g. "Cloudflare 429 (3040): ..."). Sanitized on the way in. */
  errorDetail?: string | null
  userId?: string | null
}

export interface AiEventRow {
  created_at: string
  route: string
  provider: string | null
  model: string | null
  outcome: string
  engine: string
  latency_ms: number | null
  quality_score: number | null
  retries: number
  error_code: string | null
  /** Short provider message; absent on rows written before the column existed. */
  error_detail?: string | null
  user_id: string | null
}

const short = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[^\w.:@/ -]/g, '').slice(0, max) : '')
const intOrNull = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v))
  return v !== null && v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null
}

/** Short provider message for the admin panel: one line, no URLs, no token-like strings, at most 200 chars. */
export function sanitizeErrorDetail(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const clean = v
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{32,}\b/g, '[redigido]')
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
  return clean || null
}

/** Builds the row that is stored. Anything outside the fixed vocabularies is dropped. */
export function toAiEventRow(call: AiCall, now = new Date()): AiEventRow {
  const detail = sanitizeErrorDetail(call.errorDetail)
  return {
    created_at: now.toISOString(),
    route: ROUTES.includes(call.route) ? call.route : 'generate',
    provider: short(call.provider, 24) || null,
    model: short(call.model, 80) || null,
    outcome: OUTCOMES.includes(call.outcome) ? call.outcome : 'transient',
    engine: short(call.engine, 24) || 'unknown',
    latency_ms: intOrNull(call.latencyMs, 0, 600_000),
    quality_score: intOrNull(call.qualityScore, 0, 100),
    retries: intOrNull(call.retries, 0, 20) ?? 0,
    error_code: call.errorCode && ERROR_CODES.includes(call.errorCode) ? call.errorCode : null,
    // Only present when there is a message, so rows without one never depend on the column.
    ...(detail ? { error_detail: detail } : {}),
    user_id: call.userId && UUID.test(call.userId) ? call.userId.toLowerCase() : null,
  }
}

/* ---------------- background execution ---------------- */

/** The Worker runs each request inside this store so deferred work can use ctx.waitUntil. */
export const backgroundContext = new AsyncLocalStorage<{ waitUntil(p: Promise<unknown>): void }>()

/** Runs `work` without blocking the request; errors are swallowed (logged without detail). */
export function runInBackground(work: () => Promise<unknown>) {
  const p = Promise.resolve()
    .then(work)
    .catch(() => console.warn('[MIDFLOW] background task failed'))
  try {
    backgroundContext.getStore()?.waitUntil(p)
  } catch {
    // waitUntil unavailable: the promise still runs
  }
}

const DAY_MS = 86_400_000
let lastPrune = 0
/** False once the database rejected the `error_detail` column (migration not applied yet): rows are then stored without it. */
let detailColumn = true

/** PostgREST PGRST204 (insert) / Postgres 42703 (select): the column does not exist yet. */
const isMissingColumn = (e: unknown) => e instanceof DbError && (e.code === 'PGRST204' || e.code === '42703')

/** Records one AI attempt. Returns immediately. */
export function recordAiCall(call: AiCall, f: Fetch = fetch) {
  const row = toAiEventRow(call)
  runInBackground(async () => {
    const db = getDbConfig()
    if (!db) {
      logEvent({ type: 'ai_call', ...row })
      return
    }
    const insert = (r: object) => dbRequest(db, 'ai_events', { method: 'POST', headers: dbHeaders(db, { Prefer: 'return=minimal' }), body: JSON.stringify(r) }, f)
    if (detailColumn) {
      try {
        await insert(row)
      } catch (e) {
        if (!isMissingColumn(e)) throw e
        detailColumn = false
        const { error_detail: _dropped, ...legacy } = row
        await insert(legacy)
      }
    } else {
      const { error_detail: _dropped, ...legacy } = row
      await insert(legacy)
    }
    const now = Date.now()
    if (config.eventsRetentionDays > 0 && now - lastPrune > DAY_MS) {
      lastPrune = now
      const cutoff = new Date(now - config.eventsRetentionDays * DAY_MS).toISOString()
      await dbRequest(db, `ai_events?created_at=lt.${encodeURIComponent(cutoff)}`, { method: 'DELETE', headers: dbHeaders(db) }, f)
    }
    // Review requests and generations follow the same once-a-day rhythm (server/retention.ts); it never throws.
    await pruneRetention(db, f)
  })
}

/** Test hook: lets the daily prune run again. */
export function resetAiPrune() {
  lastPrune = 0
  detailColumn = true
  resetRetentionPrune()
}

/* ---------------- aggregation (pure) ---------------- */

export const RANGE_MS: Record<AiRange, number> = { '24h': DAY_MS, '7d': 7 * DAY_MS, '30d': 30 * DAY_MS }
export const parseRange = (v: unknown): AiRange => (v === '7d' || v === '30d' ? v : '24h')

const FALLBACK = new Set(['transient', 'daily_cap', 'config'])
const BELOW_QUALITY = 85

/** Nearest-rank percentile of an unsorted list; null when empty. */
export function percentile(values: number[], q: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))]
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null)

export interface AiHealthExtras {
  providers: { name: string; configured: boolean; model: string | null }[]
  maxText: number
  maxImages: number
  maxRewrite: number
}

export function aggregateAiHealth(rows: AiEventRow[], range: AiRange, now: number, storage: 'supabase' | 'events', extras: AiHealthExtras) {
  const since = now - RANGE_MS[range]
  const inRange = rows.filter((r) => Date.parse(r.created_at) >= since)
  const ok = inRange.filter((r) => r.outcome === 'ok' || r.outcome === 'repaired')
  const fb = inRange.filter((r) => FALLBACK.has(r.outcome))
  const byKind = (k: string) => fb.filter((r) => r.outcome === k).length
  const latencies = inRange.map((r) => r.latency_ms).filter((n): n is number => typeof n === 'number')
  const scores = inRange.map((r) => r.quality_score).filter((n): n is number => typeof n === 'number')
  const images = inRange.filter((r) => r.route === 'image')

  const hourly = range === '24h'
  const step = hourly ? 3_600_000 : DAY_MS
  const bucketOf = (t: number) => Math.floor(t / step) * step
  const buckets = new Map<number, AiEventRow[]>()
  const count = hourly ? 24 : range === '7d' ? 7 : 30
  for (let i = count - 1; i >= 0; i--) buckets.set(bucketOf(now) - i * step, [])
  for (const r of inRange) buckets.get(bucketOf(Date.parse(r.created_at)))?.push(r)

  const dayStart = Math.floor(now / DAY_MS) * DAY_MS
  const today = rows.filter((r) => Date.parse(r.created_at) >= dayStart && r.outcome !== 'daily_cap')
  // Three separate global budgets: text (generate), rewrite and image.
  const used = (route: 'text' | 'rewrite' | 'image') => today.filter((r) => r.route === (route === 'text' ? 'generate' : route)).length

  const lastErr = [...fb].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]

  return {
    range,
    storage,
    totals: {
      calls: inRange.length,
      ok: ok.length,
      fallback: fb.length,
      successRate: pct(ok.length, inRange.length),
      fallbackByKind: { transient: byKind('transient'), daily_cap: byKind('daily_cap'), config: byKind('config') },
    },
    latency: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
    quality: { avg: avg(scores), belowThreshold: scores.filter((n) => n < BELOW_QUALITY).length },
    images: {
      ai: images.filter((r) => r.engine === 'ai').length,
      stock: images.filter((r) => r.engine === 'stock').length,
      procedural: images.filter((r) => r.engine === 'procedural').length,
    },
    dailyCap: {
      text: { used: used('text'), max: Number.isFinite(extras.maxText) ? extras.maxText : null },
      rewrite: { used: used('rewrite'), max: Number.isFinite(extras.maxRewrite) ? extras.maxRewrite : null },
      images: { used: used('image'), max: Number.isFinite(extras.maxImages) ? extras.maxImages : null },
    },
    providers: extras.providers,
    lastError: lastErr
      ? { at: Date.parse(lastErr.created_at), route: lastErr.route, outcome: lastErr.outcome, errorCode: lastErr.error_code, message: sanitizeErrorDetail(lastErr.error_detail) }
      : null,
    series: [...buckets.entries()].map(([t, rs]) => ({
      bucket: new Date(t).toISOString(),
      calls: rs.length,
      ok: rs.filter((r) => r.outcome === 'ok' || r.outcome === 'repaired').length,
      fallback: rs.filter((r) => FALLBACK.has(r.outcome)).length,
      p95: percentile(
        rs.map((r) => r.latency_ms).filter((n): n is number => typeof n === 'number'),
        0.95,
      ),
    })),
  }
}

/* ---------------- loading ---------------- */

const PAGE = 1000
const MAX_PAGES = 20

async function loadRowsFromDb(db: DbConfig, since: number, f: Fetch): Promise<AiEventRow[]> {
  try {
    return await loadPages(db, since, f, detailColumn)
  } catch (e) {
    // Column not created yet (migration pending): read again without it.
    if (!detailColumn || !isMissingColumn(e)) throw e
    detailColumn = false
    return loadPages(db, since, f, false)
  }
}

async function loadPages(db: DbConfig, since: number, f: Fetch, withDetail: boolean): Promise<AiEventRow[]> {
  const baseCols = 'created_at,route,provider,model,outcome,engine,latency_ms,quality_score,retries,error_code,user_id'
  const out: AiEventRow[] = []
  const cols = withDetail ? `${baseCols},error_detail` : baseCols
  // Supabase caps a response at 1000 rows by default, so the window is read page by page (bounded).
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = (await dbRequest(
      db,
      `ai_events?created_at=gte.${encodeURIComponent(new Date(since).toISOString())}&select=${cols}&order=created_at.desc&limit=${PAGE}&offset=${page * PAGE}`,
      { headers: dbHeaders(db) },
      f,
    )) as AiEventRow[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

function loadRowsFromEvents(since: number): AiEventRow[] {
  return readEvents(since)
    .filter((e) => e.type === 'ai_call')
    .map((e) => ({ ...(e as unknown as AiEventRow), created_at: new Date(e.at).toISOString() }))
}

export function providerSummary(): AiHealthExtras['providers'] {
  return [
    { name: 'gemini', configured: !!config.ai.geminiKey, model: config.ai.geminiKey ? config.ai.model : null },
    { name: 'openai', configured: !!config.ai.openaiKey, model: config.ai.openaiKey ? (config.ai.provider === 'openai' ? config.ai.model : 'gpt-4o-mini') : null },
    { name: 'image', configured: config.image.provider !== 'none', model: imageModelName() },
    { name: 'stock', configured: !!config.image.pixabayKey, model: null },
  ]
}

export async function loadAiHealth(range: AiRange, f: Fetch = fetch, now = Date.now()) {
  const db = getDbConfig()
  const since = now - Math.max(RANGE_MS[range], DAY_MS)
  const rows = db ? await loadRowsFromDb(db, since, f) : loadRowsFromEvents(since)
  const health = aggregateAiHealth(rows, range, now, db ? 'supabase' : 'events', {
    providers: providerSummary(),
    maxText: config.limits.dailyMaxText,
    maxImages: config.limits.dailyMaxImages,
    maxRewrite: config.limits.dailyMaxRewrite,
  })
  // Rows stored before the error_detail column existed carry no message: this instance may still remember the last image error.
  const last = health.lastError
  if (last && !last.message && last.route === 'image' && imageHealth.lastErrorAt && Math.abs(imageHealth.lastErrorAt - last.at) < 60_000) {
    last.message = sanitizeErrorDetail(imageHealth.lastError)
  }
  return health
}
