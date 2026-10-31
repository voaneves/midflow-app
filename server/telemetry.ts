/**
 * Append-only event log (JSON Lines) used to measure the POC:
 * every generation (engine, quality, latency), client ratings and usage events.
 * File: server/data/events.jsonl — one JSON object per line, easy to open in a spreadsheet or jq.
 */
import fs from 'fs'
import path from 'path'
import { DATA_DIR, isWorker } from './paths.ts'

const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl')

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

export const CLIENT_EVENT_TYPES: EventType[] = ['download', 'edit', 'save', 'copy_caption', 'new_version', 'client_fallback']

export interface AppEvent {
  type: EventType
  at: number
  [k: string]: unknown
}

export function logEvent(e: Omit<AppEvent, 'at'>) {
  const line = JSON.stringify({ ...e, at: Date.now() })
  // Workers: /tmp is wiped on restart — the log line is kept by Workers Logs (dashboard → Workers → midflow-api → Logs).
  if (isWorker) console.log('[MIDFLOW event]', line)
  fs.appendFile(EVENTS_FILE, `${line}\n`, (err) => {
    if (err) console.log('[MIDFLOW event]', line)
  })
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
    usage: {
      downloads: count('download'),
      edits: count('edit'),
      saves: count('save'),
      captionCopies: count('copy_caption'),
      newVersions: count('new_version'),
      clientFallbacks: count('client_fallback'),
    },
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
