/** Small HTTP helpers: JSON I/O with a size limit, CORS, per-IP rate limits. */
import type { IncomingMessage, ServerResponse } from 'http'
import { config } from './config.ts'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
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
        resolve(JSON.parse(body))
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
}

export function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(status === 204 ? undefined : JSON.stringify(data))
}

export function clientIp(req: IncomingMessage): string {
  if (config.trustProxy) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    if (fwd) return fwd
  }
  return req.socket.remoteAddress || 'unknown'
}

/** Fixed one-hour window per IP and bucket. Enough for a POC on a single instance. */
const windows = new Map<string, { start: number; count: number }>()
const HOUR = 3_600_000
let lastPrune = 0

export function rateLimit(req: IncomingMessage, bucket: string, perHour: number) {
  const key = `${bucket}:${clientIp(req)}`
  const now = Date.now()
  // Prune expired windows inside the request (no global timers: Cloudflare Workers forbid them at load time).
  if (now - lastPrune > 10 * 60_000) {
    lastPrune = now
    for (const [k, w] of windows) if (now - w.start > HOUR) windows.delete(k)
  }
  const w = windows.get(key)
  if (!w || now - w.start > HOUR) {
    windows.set(key, { start: now, count: 1 })
    return
  }
  w.count++
  if (w.count > perHour) {
    const mins = Math.ceil((HOUR - (now - w.start)) / 60_000)
    throw new HttpError(429, `Limite de uso atingido. Tente novamente em ${mins} min.`)
  }
}


export function requireAdmin(req: IncomingMessage, url: URL) {
  if (!config.adminToken) throw new HttpError(404, 'Not found')
  const header = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const token = header || url.searchParams.get('token') || ''
  if (token !== config.adminToken) throw new HttpError(401, 'Não autorizado.')
}
