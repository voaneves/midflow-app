# MIDFLOW — Clickable Prototype Plan

> AI content studio for small businesses: a short guided briefing turns into ready-to-post Instagram feed posts, Stories sequences, captions and hashtags.
> Domain: Midflow.com.br · Language of the product UI: Brazilian Portuguese · Language of this document: English.

---

## 1. Goal of this phase

Build a **clickable, high-fidelity prototype** that proves the core loop described in the proposal and the four designer specs:

```
Sign up → Briefing → Content (theme + objective) → Style → Generate → Review / edit → Save / download
```

The prototype is meant for the validation round described in the proposal (5–10 real businesses, assisted use). It has to:

- Feel like a finished SaaS product, not a wireframe.
- Let people go through the whole flow with **their own business** (not only the beauty-salon example).
- Produce outputs that look usable: real PNG downloads of each creative, a ZIP for batch download, copy-to-clipboard captions.
- Keep every decision (briefing, theme, style, brand) so users can go back and forth without losing anything.

What it does **not** need yet: real authentication, a backend, paid AI calls, publishing to Instagram, payments.

---

## 2. Source material (see `references/`)

| File | What it defines |
|---|---|
| `specs/Proposta_MIDFLOW.pdf` | Product vision, MVP scope, journey, Stories narrative (hook → development → proof → CTA), plans, what is out of scope, technical questions |
| `specs/MIDFLOW_Briefing_Estrategico_Pagina_Interna_MVP.pdf` | Step 1 — Briefing fields, preview column, format selection, UX rules, visual direction |
| `specs/MIDFLOW_Etapa_2_Conteudo_Instrucoes_Webdesigner.pdf` | Step 2 — Format cards, AI theme suggestions (6–8), categories, objective, examples, "Gerar novos exemplos" |
| `specs/MIDFLOW_Etapa_3_Estilo_Instrucoes_Webdesigner.pdf` | Step 3 — My brand vs AI-suggested style, colors (≤5, HEX), logo, 6 visual styles, image type, tone, formats, live preview |
| `specs/MIDFLOW_Etapa_4_Gerar_Criativos_Instrucoes_Webdesigner.pdf` | Step 4 — Results grid, Stories sequence, captions/hashtags, Instagram mockup, edit / download / new version / save |
| `mockups/landing.jpeg` | Landing page hero, nav, segment carousel |
| `mockups/step-1-briefing.jpeg` … `step-4-generate.jpeg` | Internal app screens |
| `brand/midflow-logo.png` | Logo (turquoise wave + MIDFLOW wordmark) |

Product-level decisions taken with the client for this phase:

- **Plans:** the landing mockup's plans win over the proposal's (Start R$ 47 · Pro R$ 77 · Business R$ 127). Limits per plan are placeholders until validated (see §8).
- **Extra screens:** Dashboard, Meus posts / Biblioteca, Minha marca, Planos & upgrade.
- **Fidelity:** follow the mockups closely, but free to improve.

---

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite** | Instant dev server, simple static build |
| UI | **React 19 + TypeScript** | Mainstream, easy to hand over |
| Styling | **Tailwind CSS v4** (CSS-first `@theme` tokens) | Fast iteration, design tokens in one place |
| Routing | **React Router 7** (hash router) | Works on any static host and inside a single-file build |
| State | **Zustand** + `persist` (localStorage, fail-safe) | Tiny, no boilerplate; drafts survive reloads |
| Icons | **lucide-react** (+ custom Instagram glyph) | Clean line icons matching the mockups |
| Export | **html-to-image** (PNG) + **JSZip** (batch) | Real downloads of rendered creatives |
| Fonts | Self-hosted via **Fontsource**: Plus Jakarta Sans (UI), Playfair Display / DM Serif Display (elegant creatives), Montserrat (bold creatives), DM Sans | No external requests, works offline and in exports |
| Single-file build | **vite-plugin-singlefile** (`npm run build:single`) | One `index.html` that can be shared/hosted anywhere |

Path to production (next phase, not in this prototype): Next.js or keep Vite + an API; Supabase (auth, Postgres, storage); an LLM for text (structured JSON output) and an image model / template engine for visuals; a queue for generations; Stripe or Mercado Pago/Pix for billing.

---

## 4. Architecture of the prototype

```
src/
  main.tsx, App.tsx          → router + layout selection
  index.css                  → Tailwind + design tokens (@theme)
  assets/photos/*.jpg        → photo library (cropped from the client's mockups)
  lib/
    store.ts                 → Zustand store: account, brand, draft (steps 1–3), generations, library, usage
    data.ts                  → segments, theme catalog per segment, styles, tones, plans
    generator.ts             → the simulated "AI": briefing + theme + objective + tone + style → posts, stories, captions
    photos.ts                → photo library indexed by tag (hair, skin, nails, food, gym…)
    export.ts                → PNG / ZIP export helpers
  components/
    Logo, Sidebar, Topbar, Stepper, ui/* (Button, Card, Chip, Checkbox, Modal, Toast…)
    creative/Creative.tsx    → THE renderer: one component draws any post/story in any style/format/palette
    creative/PhoneMockup.tsx → Instagram feed / Stories frame
    creative/Editor.tsx      → edit modal (texts, CTA, palette, layout, photo)
  pages/
    Landing, Login, Signup
    app/Dashboard, app/Create (Step1Briefing, Step2Content, Step3Style, Step4Generate),
    app/Library, app/Brand, app/Plans, app/Settings, app/ComingSoon (Calendário, Relatórios)
```

### 4.1 Data model (shared with the future backend)

```ts
Brand      { name, segment, city, about, audience, colors[≤5], logo?, tone[], visualStyle, instagram }
Briefing   { about, segment, location, objectives[], audience, topics, tone[], visualStyle, colors[], references, formats{posts,stories} }
ContentSel { formats{posts,stories}, themeId | customTheme, objective, objectiveOther }
StyleSel   { identity: 'brand'|'ai', colors[], logo?, layout: Style, imageType, tones[], postFormat: '1:1'|'4:5' }
Creative   { id, kind: 'post'|'story', order, tag?, headline, sub?, bullets?, cta, photo, layout, palette, caption, hashtags[] }
Generation { id, createdAt, version, themeLabel, posts: Creative[], stories: Creative[], params }
LibraryItem{ id, savedAt, creative, generationId }
```

### 4.2 The simulated AI (`generator.ts`)

The prototype does not call an LLM. A deterministic, seeded generator makes it feel like one:

1. **Theme suggestions (Step 2):** a catalog of themes per segment (beauty has the 8 themes from the spec; food, fitness, health/dental, real estate, pet, fashion, services/consulting, other have their own). "Gerar novos exemplos" rotates the seed and reshuffles/variates.
2. **Copy:** for each theme there are headline/sub/bullet/CTA banks; the objective (attract, promote, educate, brand) picks the CTA family and the angle; the tone (professional, relaxed, inspiring, educational, seller, fun, minimalist, luxurious) rewrites tag lines, emoji use and caption voice; the business name and city are injected into captions and hashtags (e.g. `#PalmasTO`).
3. **Stories:** always a narrative — hook (question/poll) → problem/need → solution/benefit (bullets or before/after) → CTA — 4 screens, matching the proposal's differentiator.
4. **Visual:** the chosen style (Moderno, Minimalista, Elegante, Colorido, Natural, Premium) maps to a layout family + font pairing; palette comes from the brand colors (identity = "my brand") or an AI-suggested palette per segment/style.
5. **New version:** same params, new seed → different headlines/layout/photo order. Previous versions stay available (version switcher).
6. **Loading:** a staged progress (Analisando briefing → Escrevendo textos → Criando artes → Montando Stories → Revisando legendas) so the wait feels real (~3 s).

Swapping this module for a real API is the main step toward the MVP: same inputs, same output types.

### 4.3 Creative renderer

One React component draws every creative at a fixed design size (1080×1350, 1080×1080 or 1080×1920 units) and is scaled with CSS to any thumbnail size. That guarantees WYSIWYG between thumbnail, Instagram mockup, editor and the exported PNG.

Layouts per style:

| Style | Layout |
|---|---|
| Moderno | Full-bleed photo, dark gradient, bold sans headline, pill CTA |
| Minimalista | Light background, photo block, small type, lots of space |
| Elegante | Serif headline, warm tones, thin dividers, icon row |
| Colorido | Solid vivid brand color blocks, big type, stickers |
| Natural | Soft cream background, rounded photo, gentle type |
| Premium | Dark editorial, serif, high contrast, gold/accent details |

---

## 5. Screens

### 5.1 Public
- **Landing (`/`)** — nav (Como funciona, Exemplos, Planos, Depoimentos, Blog), hero "Crie posts e stories profissionais **em minutos**", company-name input → sign-up prefilled, 4 benefit badges, phone + segment carousel, "Como funciona" (4 steps), examples by segment, Stories narrative explainer, plans, testimonials (clearly fictional), FAQ, final CTA, footer.
- **Entrar / Criar conta** — fake auth; "Entrar com Google" button; sign-up asks name, company, segment → creates brand → dashboard. A **"Ver demonstração"** shortcut loads the beauty-salon demo account.

### 5.2 App shell
- Dark navy sidebar (Dashboard, Criar conteúdo, Meus posts, Calendário, Biblioteca, Minha marca, Relatórios, Planos, Configurações) with plan usage card + "Fazer upgrade".
- Top bar with page title/subtitle, notifications, profile/company dropdown (switch to demo, sign out).
- Responsive: sidebar collapses to a drawer below `lg`.

### 5.3 Dashboard
Greeting, big "Criar conteúdo" CTA, usage of the plan, brand summary, last generations, quick ideas (one-click themes), tips.

### 5.4 Criar conteúdo — Step 1 Briefing
All fields from the spec with `*` on required ones, character counters, segment select (+ Outro), objectives checkboxes, tone chips, visual style select, up to 5 colors with HEX, references. Formats (Posts / Stories / both) + **"Gerar conteúdo com IA"** (goes to Step 2) and "Salvar briefing". Right column: preview tabs Posts / Stories / Legendas e hashtags that react to the segment, plus "O que você receberá". Prefilled from "Minha marca".

### 5.5 Step 2 Conteúdo
Format cards, theme categories (Sugestões da IA, Meus temas, Datas especiais, Promoções, Educativo, Bastidores), 8 theme cards with photos, selected-theme summary with "Alterar", objective cards (+ "Outros" text). Right: "Exemplos gerados para este tema" with Posts (4) / Stories (4) tabs and "Gerar novos exemplos". If no theme is chosen, the AI picks one.

### 5.6 Step 3 Estilo
"Usar minha marca" vs "Usar estilo sugerido pela IA", color swatches with HEX editor (≤5), logo upload (PNG/SVG, preview), 6 style cards, image type, tone chips, format (1:1, 4:5, 9:16). Right: live preview of 3 posts + 4 Stories that re-render on every change; "Trocar estilo".

### 5.7 Step 4 Gerar
Loading state → header actions (Editar briefing, Gerar nova versão, Salvar tudo na biblioteca) and version switcher. Tabs Posts (4) / Stories (4) / Legendas e hashtags. Cards with number, checkbox, Editar / Baixar / ⋯ (duplicate, delete, copy caption). "Selecionar todos". Right column: Instagram phone preview (Feed / Stories) reflecting the selected creative, caption card with copy + pager, batch actions (Baixar selecionados → ZIP, Agendar no Instagram → "em breve", Salvar na biblioteca). Toasts for saved / downloaded.

### 5.8 Editor (modal)
Large preview + fields: tag, headline, subtitle, bullets, CTA, caption, hashtags; palette swap; layout swap; photo swap; "Reescrever com IA" (rotates copy variant). Save updates the generation.

### 5.9 Meus posts / Biblioteca
Saved creatives grid, filters (Todos / Posts / Stories, theme), search, open in preview, download, delete, multi-select ZIP. Empty state with CTA.

### 5.10 Minha marca
Business profile used by every generation: name, segment, city, Instagram handle, about, audience, colors, logo, preferred tone and style, with a live mini preview.

### 5.11 Planos
Start / Pro / Business cards, current plan highlighted, usage meter, monthly/annual toggle, fake checkout modal (Pix / cartão) that switches plan and resets the meter.

### 5.12 Configurações, Calendário, Relatórios
Settings: account, notifications, reset demo data. Calendário and Relatórios: "Em breve" pages with what's coming (they are post-MVP per proposal).

---

## 6. Design system

- **Colors:** primary teal `#0B7A5E` (buttons), brand mint `#1EE0A8 → #0BA88A` (logo gradient), navy `#0B1A24` (sidebar/text), slate grays, white surfaces on `#F5F8F7` background, mint tints for highlights.
- **Type:** Plus Jakarta Sans for UI; strong headings, short texts.
- **Shape:** 12–16 px radii, soft shadows, generous whitespace, simple 1.5 px line icons, one evident primary CTA per screen.
- **States:** focus rings, hover, disabled, loading skeletons/spinners, toasts, empty states.

---

## 7. Delivery & how to run

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # static site in dist/
npm run build:single   # single self-contained dist-single/index.html
```

The prototype is also published as a shareable web page.

---

## 8. Open questions / next phase

1. **Plan limits** — Start / Pro / Business limits are placeholders (20 / 60 / 150 contents per month, 1 / 2 / 5 business profiles, 1 / 2 / 4 variations per piece). Confirm with the client.
2. **AI provider & cost per generation** — LLM for structured copy (JSON) + template renderer vs. image model; target cost per content.
3. **Images** — stock API vs. AI images vs. user uploads; the prototype uses photos cropped from the mockups.
4. **Editing depth** — current editor covers text/palette/layout/photo; "edit in Canva" could be an integration.
5. **Auth & multi-business** — Supabase auth, one account with N business profiles depending on plan.
6. **Billing** — Pix recurring (Mercado Pago / Asaas) vs. card (Stripe).
7. **Validation metrics** — time to first content, % of pieces downloaded, edits per piece, perceived quality (1–5), intent to pay.

## 9. Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Scaffold, design tokens, assets | ✅ |
| 2 | Content generator + creative renderer | ✅ |
| 3 | Landing, auth, app shell, dashboard | ✅ |
| 4 | Create flow steps 1–4 + editor + export | ✅ |
| 5 | Library, Brand, Plans, Settings | ✅ |
| 6 | QA (screenshots, responsive), single-file build, publish | ✅ |

### Next steps (toward the MVP)
1. Validation round with 5–10 businesses using the published prototype (assisted use, metrics in §8.7).
2. Replace `generator.ts` with an API route calling an LLM with structured output (same `GenParams` → `Generation` contract).
3. Supabase: auth, `brands`, `briefings`, `generations`, `library` tables; storage for logos/uploads.
4. Image strategy: user uploads + stock/AI images; server-side rendering of creatives for export.
5. Billing (Pix recurring) and plan limits enforcement.
