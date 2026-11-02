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
import { handleApiRequest } from '../server/routes.ts'

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
type FetchHandler = { fetch(req: Request, env: unknown, ctx: Ctx): Promise<Response> }
interface EdgeCache {
  match(req: Request): Promise<Response | undefined>
  put(req: Request, res: Response): Promise<void>
}
declare const caches: { default: EdgeCache }

const node = httpServerHandler(server) as FetchHandler

/**
 * Edge cache for /api/image. Flux on Workers AI has no seed, so the same URL would produce a new
 * picture on every call: caching by URL keeps thumbnail, preview, editor and PNG export identical,
 * and each card is generated (and billed) once. The route's Cache-Control decides how long:
 * AI images 30 days, a fallback served in place of an AI image only 5 minutes.
 */
export default {
  async fetch(request: Request, env: unknown, ctx: Ctx): Promise<Response> {
    const isImage = request.method === 'GET' && new URL(request.url).pathname.endsWith('/api/image')
    if (!isImage) return node.fetch(request, env, ctx)

    const cache = caches.default
    const hit = await cache.match(request)
    if (hit) return hit
    const res = await node.fetch(request, env, ctx)
    if (res.ok) ctx.waitUntil(cache.put(request, res.clone()))
    return res
  },
}
