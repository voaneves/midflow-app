# MIDFLOW — clickable prototype

AI content studio for small businesses: a short briefing becomes ready-to-post Instagram feed posts, Stories sequences, captions and hashtags.
See **[plan.md](plan.md)** for the full plan and **`references/`** for the client's specs, mockups and logo.

## Run

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # static site → dist/
npm run build:single   # one self-contained file → dist-single/index.html
```

Shortcut: on the landing page click **Ver demonstração** to open the pre-filled beauty-salon account (Studio Aurora).
Dev-only visual QA page: `http://localhost:5173/#/dev/galeria` (every style × every creative; `?s=alimentacao&c=3B1F12,C8642B,F2B26B,FBF1E4` to try another segment/palette).

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and publishes on every push to `main`:
`npm ci` → `npm run lint` → `npm run build` → upload `dist/` → GitHub Pages.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The site is served at `https://<user>.github.io/<repo>/` — the app uses relative asset paths and hash routing, so no extra config is needed for the sub-path.
`.github/workflows/ci.yml` runs the same checks on pull requests.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router 7 · Zustand (persisted to localStorage) · lucide-react · html-to-image + JSZip (PNG/ZIP export) · self-hosted fonts.
Motion is plain CSS (`src/index.css` → *Motion*) plus `src/components/motion.tsx` (`Reveal` on scroll, `CountUp`); everything respects `prefers-reduced-motion`.

## Where things are

| Path | What |
|---|---|
| `src/lib/data.ts` | Segments, theme catalog (copy banks), styles, tones, objectives, plans |
| `src/lib/generator.ts` | The simulated "AI" — swap for a real API in the MVP (same inputs/outputs) |
| `src/lib/store.ts` | App state (brand, briefing, content, style, generations, library, plan) + demo seed |
| `src/lib/color.ts` | Brand colors → role palette (dark/mid/soft/light/accent) |
| `src/components/creative/Creative.tsx` | The renderer: any post/story in any of the 6 styles × 3 formats, drawn on a 1080-px canvas |
| `src/components/creative/Editor.tsx` | Edit modal (text, layout, palette, photo, caption) |
| `src/components/creative/parts.tsx` | Instagram phone mockup, result tiles, export modal, color swatches |
| `src/pages/Landing.tsx`, `Auth.tsx` | Public pages |
| `src/pages/app/create/*` | Steps 1–4 (Briefing, Conteúdo, Estilo, Gerar) |
| `src/pages/app/*` | Dashboard, Meus posts, Biblioteca, Minha marca, Planos, Configurações, Calendário/Relatórios (preview) |
| `src/assets/photos` | Photos cropped from the client's mockups (placeholder imagery) |

## Prototype limits

- No backend: auth, payments and AI are simulated; data lives in the browser.
- Photos are low-resolution crops from the mockups — fine for validation, to be replaced by uploads / stock / AI images.
- Plan limits (20 / 60 / 150 contents) are placeholders until validated.
