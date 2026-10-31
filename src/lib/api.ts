/**
 * Base URL of the MIDFLOW API.
 * - Same server (npm start / npm run dev): empty → relative "/api/..." calls.
 * - GitHub Pages: deploy.yml builds with VITE_API_URL=/midflow-app, so calls go to
 *   voaneves.com/midflow-app/api/* (same domain), answered by the Cloudflare Worker.
 *   If no API answers there, the app runs as an offline demo (templates, clearly labeled).
 */
export const API_BASE = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

/** "/api/generate" → "https://host/api/generate" (or unchanged when same-origin). */
export const api = (path: string) => (API_BASE && path.startsWith('/api/') ? `${API_BASE}${path}` : path)
