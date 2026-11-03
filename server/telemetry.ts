/**
 * Append-only event log (JSON Lines) used to measure the POC:
 * every generation (engine, quality, latency), client ratings and usage events.
 * File: server/data/events.jsonl — one JSON object per line, easy to open in a spreadsheet or jq.
 */
import fs from 'fs'
import path from 'path'
import { config } from './config.ts'
import { DATA_DIR, isWorker } from './paths.ts'

// EVENTS_FILE overrides the location (used by the tests so they never touch the real log).
const EVENTS_FILE = process.env.EVENTS_FILE?.trim() || path.join(DATA_DIR, 'events.jsonl')

try {
  fs.mkdirSync(DATA_DIR, { recursive: true })
} catch {
  // read-only filesystem: events are only printed to the console
}

export type EventType =
  | 'generation'
  | 'rewrite'
  | 'feedback'
  | 'download'
  | 'edit'
  | 'save'
  | 'copy_caption'
  | 'new_version'
  | 'client_fallback'
  | 'ai_unavailable'
  | 'ai_call'
  | 'review_request'
  | 'account_deleted'

export const CLIENT_EVENT_TYPES: EventType[] = ['download', 'edit', 'save', 'copy_caption', 'new_version', 'client_fallback']

export interface AppEvent {
  type: EventType
  at: number
  [k: string]: unknown
}

/** Free-text fields are capped, and e-mail addresses / phone numbers typed into them are redacted. */
export const COMMENT_MAX_CHARS = 500
const ERROR_MAX_CHARS = 300

export function scrubText(value: string, max: number): string {
  return value
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[telefone]')
    .trim()
    .slice(0, max)
}

/** User-typed text is scrubbed and truncated before it is stored. */
function sanitizeEvent(e: Omit<AppEvent, 'at'>): Omit<AppEvent, 'at'> {
  const out = { ...e }
  if (typeof out.comment === 'string') out.comment = scrubText(out.comment, COMMENT_MAX_CHARS) || undefined
  if (typeof out.aiError === 'string') out.aiError = scrubText(out.aiError, ERROR_MAX_CHARS)
  if (out.type === 'review_request') {
    // Events-only storage is a plain log (Workers Logs, a JSONL file): keep sizes, not the customer's contact data or briefing.
    if ('contactEmail' in out) {
      out.hasContact = typeof out.contactEmail === 'string' && out.contactEmail.length > 0
      delete out.contactEmail
    }
    if ('briefing' in out) {
      if (out.briefingBytes === undefined) out.briefingBytes = out.briefing === undefined || out.briefing === null ? 0 : JSON.stringify(out.briefing).length
      delete out.briefing
    }
  }
  return out
}

const DAY_MS = 86_400_000
let lastPrune = 0

/**
 * Drops events older than EVENTS_RETENTION_DAYS (0 = keep everything). Runs lazily from logEvent at most
 * once per day: no timers, so it is safe on Workers (where it is skipped: the log there is console only).
 * Returns how many events were removed.
 */
export function pruneEvents(retentionDays = config.eventsRetentionDays, now = Date.now(), file = EVENTS_FILE): number {
  if (isWorker || retentionDays <= 0) return 0
  const cutoff = now - retentionDays * DAY_MS
  try {
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean)
    const kept = lines.filter((l) => {
      try {
        return (JSON.parse(l) as AppEvent).at >= cutoff
      } catch {
        return false
      }
    })
    if (kept.length === lines.length) return 0
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, kept.length ? `${kept.join('\n')}\n` : '')
    fs.renameSync(tmp, file)
    return lines.length - kept.length
  } catch {
    return 0
  }
}

export function logEvent(e: Omit<AppEvent, 'at'>) {
  const now = Date.now()
  if (now - lastPrune > DAY_MS) {
    lastPrune = now
    pruneEvents(config.eventsRetentionDays, now)
  }
  const line = JSON.stringify({ ...sanitizeEvent(e), at: now })
  // Workers: /tmp is wiped on restart — the log line is kept by Workers Logs (dashboard → Workers → midflow-api → Logs).
  if (isWorker) console.log('[MIDFLOW event]', line)
  try {
    // Synchronous append so a concurrent prune (rewrite + rename) can never drop a line.
    fs.appendFileSync(EVENTS_FILE, `${line}\n`)
  } catch {
    if (!isWorker) console.log('[MIDFLOW event]', line)
  }
}

export function readEvents(sinceMs = 0): AppEvent[] {
  try {
    return fs
      .readFileSync(EVENTS_FILE, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as AppEvent
        } catch {
          return null
        }
      })
      .filter((e): e is AppEvent => !!e && e.at >= sinceMs)
  } catch {
    return []
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const v = [...xs].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2)
}

/** Seconds from each business's first generation to its first download (usability: "tempo até baixar"). */
function firstDownloadSeconds(events: AppEvent[]): number[] {
  const firstGen = new Map<string, number>()
  const out: number[] = []
  const done = new Set<string>()
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    const brand = String(e.brandName || '')
    if (!brand) continue
    if (e.type === 'generation' && !firstGen.has(brand)) firstGen.set(brand, e.at)
    if (e.type === 'download' && firstGen.has(brand) && !done.has(brand)) {
      done.add(brand)
      out.push(Math.round((e.at - firstGen.get(brand)!) / 1000))
    }
  }
  return out
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)

/** Numbers for the POC report (plan.md §8.7): quality, AI vs fallback, latency, ratings, downloads, edits. */
export function metrics(days = 30) {
  const events = readEvents(Date.now() - days * 86_400_000)
  const gens = events.filter((e) => e.type === 'generation')
  const ai = gens.filter((e) => e.engine !== 'template')
  const ratings = events.filter((e) => e.type === 'feedback').map((e) => Number(e.rating)).filter((n) => n >= 1 && n <= 5)
  const count = (t: EventType) => events.filter((e) => e.type === t).reduce((s, e) => s + (Number(e.count) || 1), 0)
  const brands = new Set(gens.map((e) => String(e.brandName || '')).filter(Boolean))
  const issueCounts: Record<string, number> = {}
  for (const g of gens) {
    for (const msg of (g.openIssues as string[] | undefined) ?? []) {
      const key = msg.replace(/^(post|story) \d+: /, '').replace(/\d+/g, 'N')
      issueCounts[key] = (issueCounts[key] || 0) + 1
    }
  }

  const unavailable = events.filter((e) => e.type === 'ai_unavailable')
  const byKind = (k: string) => unavailable.filter((e) => e.aiErrorKind === k).length

  return {
    periodDays: days,
    generations: gens.length,
    businesses: brands.size,
    aiShare: gens.length ? Math.round((ai.length / gens.length) * 100) : null,
    avgQualityAI: avg(ai.map((e) => Number(e.score))),
    avgQualityAll: avg(gens.map((e) => Number(e.score))),
    repairedShare: ai.length ? Math.round((ai.filter((e) => e.repaired).length / ai.length) * 100) : null,
    avgLatencyMs: avg(ai.map((e) => Number(e.latencyMs))),
    tokens: {
      input: ai.reduce((s, e) => s + (Number(e.inputTokens) || 0), 0),
      output: ai.reduce((s, e) => s + (Number(e.outputTokens) || 0), 0),
    },
    ratings: { count: ratings.length, average: avg(ratings) },
    firstDownload: (() => {
      const secs = firstDownloadSeconds(events)
      return { businesses: secs.length, medianSeconds: median(secs), shareOfBusinesses: brands.size ? Math.round((secs.length / brands.size) * 100) : null }
    })(),
    usage: {
      downloads: count('download'),
      edits: count('edit'),
      saves: count('save'),
      captionCopies: count('copy_caption'),
      newVersions: count('new_version'),
      clientFallbacks: count('client_fallback'),
    },
    /** Generations / rewrites answered with the template engine because the AI failed, by cause. */
    aiUnavailable: { total: unavailable.length, transient: byKind('transient'), daily_cap: byKind('daily_cap'), config: byKind('config') },
    reviewRequests: events.filter((e) => e.type === 'review_request').length,
    aiErrors: gens.filter((e) => e.aiError).slice(-10).map((e) => ({ at: e.at, error: e.aiError })),
    topIssues: Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([issue, n]) => ({ issue, n })),
    recentFeedback: events
      .filter((e) => e.type === 'feedback' && e.comment)
      .slice(-20)
      .map((e) => ({ at: e.at, rating: e.rating, comment: e.comment, brandName: e.brandName })),
  }
}
