/**
 * Production server: serves the built front-end (dist/) and the /api routes.
 *   npm run build && npm start
 */
import fs from 'fs'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'
import { aiEnabled, config } from './config.ts'
import { handleApiRequest } from './routes.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt', '.xml'])

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
].join('; ')

function securityHeaders(res: http.ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (config.isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}

/** Resolves a URL path to a file inside dist/, or null. Blocks "../" escapes. */
function resolveStatic(urlPath: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null
  const file = path.resolve(dist, `.${path.posix.normalize(`/${decoded}`)}`)
  if (file !== dist && !file.startsWith(dist + path.sep)) return null
  try {
    return fs.statSync(file).isFile() ? file : null
  } catch {
    return null
  }
}

function serveFile(req: http.IncomingMessage, res: http.ServerResponse, file: string) {
  const ext = path.extname(file).toLowerCase()
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
  // Hashed build assets never change; HTML must always be revalidated.
  res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache')
  if (ext === '.html') res.setHeader('Content-Security-Policy', CSP)

  const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))
  if (gzip) {
    res.setHeader('Content-Encoding', 'gzip')
    res.setHeader('Vary', 'Accept-Encoding')
  }
  res.statusCode = 200
  if (req.method === 'HEAD') return res.end()
  const stream = fs.createReadStream(file)
  stream.on('error', () => res.destroy())
  ;(gzip ? stream.pipe(zlib.createGzip()) : stream).pipe(res)
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res)
  const urlPath = (req.url || '/').split('?')[0]

  if (urlPath.startsWith('/api/')) {
    if (await handleApiRequest(req, res)) return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' }).end('Method Not Allowed')
    return
  }

  const file = resolveStatic(urlPath === '/' ? '/index.html' : urlPath)
  if (file) return serveFile(req, res, file)

  // The app uses hash routing; unknown paths get the SPA shell, missing assets a 404.
  const index = resolveStatic('/index.html')
  if (index && !path.extname(urlPath)) return serveFile(req, res, index)
  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not Found')
})

server.requestTimeout = 180_000
server.headersTimeout = 20_000

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.warn('[MIDFLOW] dist/ não encontrado — rode "npm run build" antes de "npm start".')
}

server.listen(config.port, () => {
  console.log(`[MIDFLOW] Servidor em http://localhost:${config.port}`)
  console.log(
    aiEnabled()
      ? `[MIDFLOW] IA: ${config.ai.provider} / ${config.ai.model} (nota mínima ${config.ai.minQuality})`
      : '[MIDFLOW] IA DESLIGADA: defina GEMINI_API_KEY ou OPENAI_API_KEY no .env — usando apenas templates.',
  )
})

function shutdown(signal: string) {
  console.log(`[MIDFLOW] ${signal} recebido, encerrando...`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
