# MIDFLOW — clickable prototype

AI content studio for small businesses: a short briefing becomes ready-to-post Instagram feed posts, Stories sequences, captions and hashtags.
See **[plan.md](plan.md)** for the full plan and **`references/`** for the client's specs, mockups and logo.

## Run

```bash
npm install
cp .env.example .env     # set GEMINI_API_KEY (server-side only)
npm run dev              # http://localhost:5173 — front-end + /api
npm run build && npm start   # production server on :3000
npm test                 # quality-gate tests
npm run eval             # real-model quality evaluation
```

**Production / POC operations (Portuguese): see [PRODUCAO.md](PRODUCAO.md)** — deploy (Docker), quality pipeline, POC metrics, security, what is still missing.

Shortcut: on the landing page click **Ver demonstração** to open the pre-filled beauty-salon account (Studio Aurora).

## Deploy

- Every push to `main` runs `.github/workflows/deploy.yml`: checks → API as a Cloudflare Worker (`voaneves.com/midflow-app/api/*`, secrets from GitHub Secrets) → site on GitHub Pages (no secrets). Setup: PRODUCAO.md §3.1.
- Alternative: one Node server / Docker for both — PRODUCAO.md §3.2.
- `.github/workflows/ci.yml` runs lint, tests and build on pull requests.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router 7 · Zustand (persisted to localStorage) · lucide-react · html-to-image + JSZip (PNG/ZIP export) · self-hosted fonts.
Motion is plain CSS (`src/index.css` → *Motion*) plus `src/components/motion.tsx` (`Reveal` on scroll, `CountUp`); everything respects `prefers-reduced-motion`.

## Where things are

| Path | What |
|---|---|
| `src/lib/data.ts` | Segments, theme catalog (copy banks), styles, tones, objectives, plans |
| `server/ai/*` | AI pipeline: prompt + schema, model call with retries, quality gate, repair round |
| `server/routes.ts`, `server/server.ts` | API (generate, rewrite, image, feedback, metrics) and production server |
| `src/lib/generator.ts` | Offline template generator (used only when no server is reachable) |
| `src/lib/store.ts` | App state (brand, briefing, content, style, generations, library, plan) + demo seed |
| `src/lib/color.ts` | Brand colors → role palette (dark/mid/soft/light/accent) |
| `src/components/creative/Creative.tsx` | The renderer: any post/story in any of the 6 styles × 3 formats, drawn on a 1080-px canvas |
| `src/components/creative/Editor.tsx` | Edit modal (text, layout, palette, photo, caption) |
| `src/components/creative/parts.tsx` | Instagram phone mockup, result tiles, export modal, color swatches |
| `src/pages/Landing.tsx`, `Auth.tsx` | Public pages |
| `src/pages/app/create/*` | Steps 1–4 (Briefing, Conteúdo, Estilo, Gerar) |
| `src/pages/app/*` | Dashboard, Meus posts, Biblioteca, Minha marca, Planos, Configurações, Calendário/Relatórios (preview) |
| `src/assets/photos` | Photos cropped from the client's mockups (placeholder imagery) |

## Limits

See PRODUCAO.md §7 (auth, billing, Instagram publishing and multi-device data are not implemented yet).
