/** Small HTTP helpers: JSON I/O with a size limit, CORS, per-IP rate limits, daily AI budget, admin auth. */
import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'http'
import { config } from './config.ts'

export class HttpError extends Error {
  status: number
  /** Extra JSON fields merged into the error response (for example a machine-readable `code`). */
  extra?: Record<string, unknown>
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

/**
 * Reads the request body as the exact UTF-8 text that was sent (no JSON parsing).
 * Needed for Stripe webhooks, whose signature covers the raw bytes. Chunks are joined as bytes before decoding,
 * so multi-byte characters split across chunks stay intact. Fails with 413 above `maxBytes`.
 */
export function readRawBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    let failed = false
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer | string) => {
      if (failed) return
      const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : chunk
      size += buf.length
      if (size > maxBytes) {
        failed = true
        // The rest of the upload is read and dropped (not destroyed) so the 413 answer can still reach the sender.
        reject(new HttpError(413, 'Requisição grande demais.'))
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => {
      if (!failed) resolve(Buffer.concat(chunks).toString('utf-8'))
    })
    req.on('error', reject)
  })
}

export function readJson(req: IncomingMessage, maxBytes = config.limits.bodyBytes): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new HttpError(413, 'Requisição grande demais.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8')
      if (!body) return resolve({})
      try {
        const parsed: unknown = JSON.parse(body)
        // Every route expects an object; null, numbers, strings and arrays would only fail later in less obvious ways.
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
        resolve(parsed)
      } catch {
        reject(new HttpError(400, 'JSON inválido.'))
      }
    })
    req.on('error', reject)
  })
}

/** Only same-origin calls plus ALLOWED_ORIGINS get CORS headers. */
export function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin
  if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id')
  }
}

export function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(status === 204 ? undefined : JSON.stringify(data))
}

/**
 * How much of the forwarding headers to believe, from TRUST_PROXY:
 *   "cloudflare"  only CF-Connecting-IP (set by Cloudflare itself; X-Forwarded-For is client-controlled and ignored)
 *   N (1, 2...)   the Nth entry from the right of X-Forwarded-For: N trusted proxies each append the address they saw
 *   "true"        legacy; behaves like 1 and warns once, because the leftmost entry is attacker-controlled
 *   unset / other the socket address
 */
export type ProxyTrust = { kind: 'none' } | { kind: 'cloudflare' } | { kind: 'hops'; hops: number }

let warnedLegacyTrust = false

export function proxyTrustFromEnv(raw = process.env.TRUST_PROXY): ProxyTrust {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'cloudflare') return { kind: 'cloudflare' }
  if (/^[1-9]\d?$/.test(v)) return { kind: 'hops', hops: Number(v) }
  if (v === 'true') {
    if (!warnedLegacyTrust) {
      warnedLegacyTrust = true
      console.warn('[security] TRUST_PROXY=true is deprecated and treated as 1 (rightmost X-Forwarded-For entry). Use "cloudflare" or the number of proxies in front of the server.')
    }
    return { kind: 'hops', hops: 1 }
  }
  return { kind: 'none' }
}

export function clientIp(req: IncomingMessage): string {
  const socketIp = req.socket.remoteAddress || 'unknown'
  const trust = proxyTrustFromEnv()
  if (trust.kind === 'cloudflare') {
    const cf = String(req.headers['cf-connecting-ip'] || '').trim()
    return cf ? cf.slice(0, 64) : socketIp
  }
  if (trust.kind === 'hops') {
    const entries = String(req.headers['x-forwarded-for'] || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
    const entry = entries.length >= trust.hops ? entries[entries.length - trust.hops] : undefined
    return entry ? entry.slice(0, 64) : socketIp
  }
  return socketIp
}

/* ---------------- counters: pluggable store ---------------- */

export interface CounterHit {
  /** Hits in the current window, including this one. */
  count: number
  /** Epoch ms when the window ends and the counter starts over. */
  resetAt: number
}

/**
 * Fixed-window counter store behind the rate limiter and the daily AI budget.
 * The default is in-memory (one process). A host with several instances, such as the Cloudflare Worker,
 * can plug a shared store (KV, Durable Object…) with `setRateLimitStore()`; `hit` may be async.
 */
export interface RateLimitStore {
  /** Count one hit for `key`, opening a new window of `windowMs` when none is active. */
  hit(key: string, windowMs: number, now: number): CounterHit | Promise<CounterHit>
}

export function createMemoryStore(): RateLimitStore {
  const windows = new Map<string, { resetAt: number; count: number }>()
  let lastPrune = 0
  return {
    hit(key, windowMs, now) {
      // Prune expired windows inside the request (no global timers: Cloudflare Workers forbid them at load time).
      if (now - lastPrune > 10 * 60_000) {
        lastPrune = now
        for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k)
      }
      const w = windows.get(key)
      if (!w || w.resetAt <= now) {
        const fresh = { resetAt: now + windowMs, count: 1 }
        windows.set(key, fresh)
        return { count: 1, resetAt: fresh.resetAt }
      }
      w.count++
      return { count: w.count, resetAt: w.resetAt }
    },
  }
}

let store: RateLimitStore = createMemoryStore()

/** Replace the counter store (shared across instances). With no argument, restores a fresh in-memory store. */
export function setRateLimitStore(next?: RateLimitStore) {
  store = next ?? createMemoryStore()
}

const HOUR = 3_600_000
const DAY = 86_400_000

/** Fixed one-hour window per IP and bucket. Throws HttpError 429 when `perHour` is exceeded. */
export async function rateLimit(req: IncomingMessage, bucket: string, perHour: number) {
  const now = Date.now()
  const { count, resetAt } = await store.hit(`${bucket}:${clientIp(req)}`, HOUR, now)
  if (count > perHour) {
    const mins = Math.max(1, Math.ceil((resetAt - now) / 60_000))
    throw new HttpError(429, `Limite de uso atingido. Tente novamente em ${mins} min.`)
  }
}

/**
 * Daily budget for paid AI calls, counted per UTC day. The key is `daily:${kind}:${day}`, so every budget goes through
 * the shared Durable Object store on the Worker. Global budgets use a plain kind ('text', 'image', 'rewrite'); per-user
 * ones embed the subject in the kind (`rewrite:${userId}`, `img:${userId}`).
 * Returns true when the call may use the AI; false when the cap is reached, so the caller must use the
 * honest template/stock fallback. A `max` of Infinity means unlimited and counts nothing.
 */
export async function consumeDailyBudget(kind: string, max: number): Promise<boolean> {
  if (!Number.isFinite(max)) return true
  const now = Date.now()
  const day = new Date(now).toISOString().slice(0, 10)
  const { count } = await store.hit(`daily:${kind}:${day}`, DAY, now)
  return count <= max
}

/* ---------------- admin auth ---------------- */

const digest = (v: string) => createHash('sha256').update(v).digest()

/** Constant-time comparison (hashing first gives equal-length buffers, so the length is not leaked either). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b))
}

/** Admin endpoints accept the token only as `Authorization: Bearer <token>`, never in the URL. */
export function requireAdmin(req: IncomingMessage) {
  if (!config.adminToken) throw new HttpError(404, 'Not found')
  const match = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '').trim())
  if (!match || !safeEqual(match[1].trim(), config.adminToken)) throw new HttpError(401, 'Não autorizado.')
}
