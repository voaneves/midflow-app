/**
 * Cloudflare Worker entry: runs the SAME API routes as server/server.ts (no rewrite),
 * via Cloudflare's node:http compatibility (httpServerHandler).
 *
 * Served at https://voaneves.com/midflow-app/api/*  (route in wrangler.jsonc).
 * The static site stays on GitHub Pages; only /midflow-app/api/* is answered here.
 * Secrets (GEMINI_API_KEY, CF_API_TOKEN, …) are Worker secrets — set by the deploy workflow.
 */
import { createServer } from 'node:http'
import { httpServerHandler } from 'cloudflare:node'
import { backgroundContext } from '../server/aihealth.ts'
import { setRateLimitStore } from '../server/http.ts'
import { imageCacheKey } from '../server/imageService.ts'
import { handleApiRequest } from '../server/routes.ts'
import { doStore, type CounterNamespace } from './counterCore.ts'

// Durable Object classes must be exported from the entry module (wrangler.jsonc "durable_objects" / "migrations").
export { Counter } from './counter.ts'

/** Pages serves the app under /midflow-app; the API routes expect /api/... */
const BASE = '/midflow-app'

const server = createServer(async (req, res) => {
  if (req.url?.startsWith(`${BASE}/api/`)) req.url = req.url.slice(BASE.length)
  if (!(await handleApiRequest(req, res))) {
    res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"Rota não encontrada."}')
  }
})

// Minimal Workers types (no @cloudflare/workers-types dependency).
interface Ctx {
  waitUntil(p: Promise<unknown>): void
}
/** Workers Rate Limiting binding (wrangler.jsonc "ratelimits"). */
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}
interface Env {
  /** Short bursts on the text/editor-image routes (/api/generate, /api/rewrite, /api/generate-image). */
  RL_GENERATE?: RateLimiter
  /** Short bursts on AI card images (/api/image?ai=1): one briefing asks for ~8 at once. */
  RL_IMAGE?: RateLimiter
  /** Money-, data- and privilege-sensitive routes: review requests, /api/admin/*, checkout, billing portal, account deletion. */
  RL_SENSITIVE?: RateLimiter
  /** Durable Object namespace holding the global daily AI budgets (shared by every isolate). Optional: falls back to memory. */
  COUNTERS?: CounterNamespace
  /** Commit SHA of the deployed build (deploy.yml passes it with --var). */
  GIT_SHA?: string
}
type FetchHandler = { fetch(req: Request, env: unknown, ctx: Ctx): Promise<Response> }
interface EdgeCache {
  match(req: Request): Promise<Response | undefined>
  put(req: Request, res: Response): Promise<void>
}
declare const caches: { default: EdgeCache }

const node = httpServerHandler(server) as FetchHandler

/**
 * Plugs the Durable Object counters into the daily AI budgets (once per isolate). Without the COUNTERS binding the
 * in-memory store stays, which only counts per isolate: the caps still work, but not exactly across isolates.
 */
let sharedCountersInstalled = false
function installSharedCounters(env: Env) {
  if (sharedCountersInstalled || !env.COUNTERS) return
  sharedCountersInstalled = true
  setRateLimitStore(doStore(env.COUNTERS))
}

/**
 * Copies string bindings (vars and secrets such as SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
 * into process.env, where server/config.ts reads them on every request. Existing values are never overwritten.
 */
function syncEnv(env: Record<string, unknown>) {
  for (const [name, value] of Object.entries(env)) {
    if (typeof value === 'string' && process.env[name] === undefined) process.env[name] = value
  }
}

/** The bindings count per Cloudflare location over a fixed window; this must match wrangler.jsonc "period". */
const RATE_PERIOD_SECONDS = 60

type Bucket = 'generate' | 'image' | 'sensitive'

/** Which limiter (if any) guards this request. Cache hits and cheap routes are not limited here. */
function bucketFor(request: Request, pathname: string, search: URLSearchParams): Bucket | null {
  if (request.method === 'OPTIONS') return null
  const route = pathname.startsWith(BASE + '/') ? pathname.slice(BASE.length) : pathname
  const clean = route.replace(/\/+$/, '')
  if (clean === '/api/generate' || clean === '/api/rewrite' || clean === '/api/generate-image') return 'generate'
  if (clean === '/api/image' && search.get('ai') === '1') return 'image'
  if (clean === '/api/review' || clean === '/api/billing/checkout' || clean === '/api/billing/portal' || clean === '/api/account/delete' || clean === '/api/admin' || clean.startsWith('/api/admin/')) return 'sensitive'
  return null
}

/**
 * Per-IP burst limit in front of the node handler. The in-memory limiter in server/http.ts only sees
 * one isolate, so this binding is the cross-isolate guard. Fails open: no binding (local dev) or a
 * binding error never blocks a real visitor.
 */
async function overLimit(request: Request, env: Env, bucket: Bucket): Promise<boolean> {
  const limiter = bucket === 'generate' ? env.RL_GENERATE : bucket === 'image' ? env.RL_IMAGE : env.RL_SENSITIVE
  if (!limiter) return false
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  try {
    const { success } = await limiter.limit({ key: `${bucket}:${ip}` })
    return !success
  } catch (err) {
    console.error('[MIDFLOW] rate limit binding failed, allowing request:', err)
    return false
  }
}

function tooManyRequests(): Response {
  return new Response(
    JSON.stringify({ error: `Muitas requisições em sequência. Aguarde ${RATE_PERIOD_SECONDS} segundos e tente novamente.` }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': String(RATE_PERIOD_SECONDS),
      },
    },
  )
}

/** Defaults for JSON endpoints. Image routes set their own CSP (SVG artwork), so JSON-only rules never touch them. */
const JSON_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

/**
 * Adds baseline security headers without overriding anything the route already set.
 * Responses from fetch()/cache can be immutable, so a copy with fresh headers is returned.
 */
function withSecurityHeaders(res: Response, env: Env): Response {
  const headers = new Headers(res.headers)
  const setDefault = (name: string, value: string) => {
    if (!headers.has(name)) headers.set(name, value)
  }
  setDefault('X-Content-Type-Options', 'nosniff')
  setDefault('Referrer-Policy', 'no-referrer')
  setDefault('X-Frame-Options', 'DENY')
  setDefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  const type = (headers.get('Content-Type') || '').toLowerCase()
  if (type.startsWith('application/json') || type.startsWith('text/plain')) setDefault('Content-Security-Policy', JSON_CSP)
  if (env.GIT_SHA) setDefault('X-Midflow-Build', env.GIT_SHA.slice(0, 7))
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

/**
 * Edge cache for /api/image. Flux on Workers AI has no seed, so the same URL would produce a new
 * picture on every call: caching by URL keeps thumbnail, preview, editor and PNG export identical,
 * and each card is generated (and billed) once. The route's Cache-Control decides how long:
 * AI images 30 days, a fallback served in place of an AI image only 5 minutes.
 *
 * The cache key is the URL with its query in canonical spelling (imageCacheKey), so reordered or re-encoded variants of
 * one image share an entry. A signed URL that is not in canonical spelling is answered by the route with the stock
 * fallback (it cannot spend the paid model), and that answer is never stored under the key of the real image.
 */
export default {
  async fetch(request: Request, rawEnv: unknown, ctx: Ctx): Promise<Response> {
    const env = (rawEnv ?? {}) as Env
    syncEnv(env as Record<string, unknown>)
    installSharedCounters(env)
    const url = new URL(request.url)
    const isImage = request.method === 'GET' && url.pathname.endsWith('/api/image')
    const cache = isImage ? caches.default : null
    const imageKey = isImage ? imageCacheKey(url) : null
    const cacheKey = imageKey ? new Request(imageKey.key) : null

    // Cached images are served before the limiter, so replaying a URL never costs a token.
    if (cache && cacheKey) {
      const hit = await cache.match(cacheKey)
      if (hit) return withSecurityHeaders(hit, env)
    }

    const bucket = bucketFor(request, url.pathname, url.searchParams)
    if (bucket && (await overLimit(request, env, bucket))) return withSecurityHeaders(tooManyRequests(), env)

    // Deferred work (AI health rows) outlives the response through ctx.waitUntil.
    const res = await backgroundContext.run(ctx, () => node.fetch(request, rawEnv, ctx))
    if (cache && cacheKey && imageKey?.cacheable && res.ok) ctx.waitUntil(cache.put(cacheKey, res.clone()))
    return withSecurityHeaders(res, env)
  },
}
