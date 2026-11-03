# MIDFLOW

Content studio for small and medium businesses in Brazil. A short guided briefing becomes ready-to-publish Instagram feed posts, four-screen Stories sequences, captions and hashtags. The interface is in Brazilian Portuguese (`pt-BR`); the codebase, specs and this file are in English.

- **[PRODUCAO.md](PRODUCAO.md)**: operations guide in Portuguese (go-live checklist, environment variables, admin panel, quotas, data retention, legal items, what is still missing).
- **[docs/backend-integration.md](docs/backend-integration.md)**: API contracts, authentication kinds, billing and review flows, Supabase migrations, security hardening.
- **[plan.md](plan.md)**: UX/UI plan and status by phase.

## Architecture

```
Browser
 ├─ voaneves.com/midflow-app      static site (Vite + React 19) on GitHub Pages, no secrets
 │    └─ Supabase JS (anon key, protected by Row Level Security): sign-in, brand and library sync
 └─ voaneves.com/midflow-app/api  API: the same server/routes.ts, run either
      ├─ on a Cloudflare Worker (worker/index.ts) with edge rate limits and Durable Object counters
      └─ on a Node server (server/server.ts, Docker or any host)
           ├─ Google Gemini (text), with an offline template engine as honest fallback
           ├─ Cloudflare Workers AI (images), Pixabay and an internal catalog as fallbacks
           ├─ Supabase (Auth, Postgres, RLS; service role on the server only)
           └─ Stripe (Checkout and webhooks)
```

Without Supabase or Stripe configured, the app runs anonymously with local storage, with no quotas, billing or review queue. Every backend piece is optional.

## Run locally

```bash
npm install
cp .env.example .env     # set GEMINI_API_KEY (server-side only); ADMIN_TOKEN needs at least 32 characters
npm run dev              # http://localhost:5173: front end and /api
npm run build && npm start   # production build served by the Node server on :3000
```

Requires Node 22.18 or newer (CI uses Node 24).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with the API |
| `npm run build` | Type-check and production build (`dist/`) |
| `npm start` | Node production server (loads `.env`) |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Unit and route tests (`node --test server/tests/*.test.ts`) |
| `npm run e2e:a11y` | Playwright + axe accessibility suite (desktop Chrome project; starts its own dev server with AI disabled) |
| `npm run eval` | Quality evaluation against the real model (fails below an average score of 85) |
| `npm run check:ai` / `check:image` | Smoke test of the text key and of one generated image |
| `npm run check:budget` | Bundle budget after build (initial JS ≤ 180 KB gzip, CSS ≤ 30 KB, largest lazy chunk ≤ 60 KB) |
| `npm run photos:generate` | Regenerates the example photo library |
| `npm run worker:dev` / `worker:deploy` | Run or deploy the Cloudflare Worker (`wrangler`) |

## Tests

| Suite | Command | Notes |
|---|---|---|
| Unit and route tests | `npm test` | Quality gate, auth (HS256, ES256/RS256 with a fake JWKS), billing and webhooks, quotas, review and staff rules, AI health, account deletion. Uses an in-memory Supabase and Stripe fake |
| Accessibility | `npm run e2e:a11y` | axe scan of every route and main dialogs at 360, 768 and 1280 px |
| Backend journeys | `npx playwright test e2e/backend.spec.ts` | Browser flows for retries, daily cap and plan-limit messages (no npm script) |
| Baseline screens | `npx playwright test e2e/baseline.spec.ts` | Screenshots and scores of the current screens (no npm script) |
| Access model | `supabase start`, `supabase db reset`, `supabase test db` | pgTAP checks in `supabase/tests/rls.sql`. Needs the Supabase CLI and a local stack; not run in CI |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, build, the bundle budget and the accessibility suite on every pull request. `deploy.yml` runs lint, tests and typecheck on every push to `main` before deploying, and the site job runs the build and the bundle budget.

## Deploy

- Every push to `main` runs `.github/workflows/deploy.yml`: checks, then the API as a Cloudflare Worker (secrets from the `production` environment), then the site on GitHub Pages.
- The API can also run as one Node container (`Dockerfile`).
- Setup, secrets and variables: see [PRODUCAO.md](PRODUCAO.md) §9 (go-live checklist) and §10 (environment variables).

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router 7 (hash routing) · Zustand (persisted to localStorage, synced to Supabase when signed in) · lucide-react · html-to-image and JSZip for PNG and ZIP export · self-hosted fonts · Supabase JS (lazy-loaded) · Stripe Checkout · Cloudflare Workers with Durable Objects and Workers Rate Limiting.

The creative editor and the pages are code-split. The app is an installable PWA: the service worker precaches the app shell (`src/pwa/sw.js`) and never caches `/api`.

## Where things are

| Path | What |
|---|---|
| `src/lib/data.ts` | Segments, theme catalog, styles, tones, objectives, plan definitions |
| `src/lib/backend/` | Auth and repository adapters (local and Supabase), sync, plan limits shared with the server |
| `src/lib/store.ts` | App state: brand, briefing, content, style, generations, library, plan |
| `server/routes.ts`, `server/server.ts` | API routes and the Node production server |
| `server/ai/*` | Prompt and schema, model calls with retries, quality gate, repair round |
| `server/authz.ts`, `server/auth.ts` | Caller identification, staff roles, token verification |
| `server/billing.ts`, `server/reviews.ts`, `server/aihealth.ts` | Stripe, review queue, AI health |
| `server/db/` | Service-role access to Supabase |
| `worker/index.ts` | Cloudflare Worker entry: edge rate limits, shared counters |
| `src/components/creative/Creative.tsx` | The renderer: every post and story, in every style and format, drawn on a 1080-px canvas |
| `src/components/creative/Editor.tsx` | Creative editor (text, layout, palette, photo, caption) |
| `src/pages/admin/` | Staff panel at `#/painel`: reviews, AI health, metrics, team |
| `supabase/migrations/` | Database schema, RLS, security hardening, quota reservation |

## Status

Remaining items for the commercial release are listed in [PRODUCAO.md](PRODUCAO.md) §7 and in [plan.md](plan.md) §10.1.
