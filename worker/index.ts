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

export default httpServerHandler(server)
