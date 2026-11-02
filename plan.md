# MIDFLOW — UX/UI Overhaul Plan (Mobile-first, Responsive, Accessible)

> Phase goal: turn the working AI pipeline into a product that feels as polished as the apps our users already open every day (Instagram, Canva, Nubank, iFood), on a 360 px phone first and on desktop second.
> Product UI language: Brazilian Portuguese (`pt-BR`). Language of this document: English.

---

## 1. Context

The AI generation pipeline is delivered (`/api/generate`, quality gate, honest `ai` vs `fallback` reporting). The front end was built as a desktop-first clickable prototype and later patched for small screens. It works, but it does not yet meet the bar of market reference apps:

- Layouts are designed at `xl` (1280 px) and collapse downwards; most two-column screens become one very long scroll on phones, with the live preview pushed below the form.
- Primary actions (Continue, Generate, Save) live at the end of long forms instead of in the thumb zone.
- Modals are centered dialogs on every viewport; the creative editor is a desktop panel squeezed into a phone.
- Accessibility is partial: some ARIA attributes exist, but dialogs, menus, toasts and custom controls are not fully keyboard/screen-reader operable, and several text colors fail contrast.

### 1.1 Audit findings (current code)

| # | Area | Finding | Where |
|---|---|---|---|
| A1 | Layout | Two-column create steps only split at `xl`; on phones the preview sits below a long form and is rarely seen | `Step1Briefing.tsx`, `Step2Content.tsx`, `Step3Style.tsx` |
| A2 | Layout | Step 4 header has 3 large buttons that wrap into a block of 3 rows on phones; sticky tab bar uses a hard-coded `top-[76px]` | `Step4Generate.tsx` |
| A3 | Navigation | Header is 76 px tall on mobile (wasted vertical space); drawer duplicates the bottom nav; no "back" affordance inside the create flow | `AppLayout.tsx` |
| A4 | Navigation | Stepper shows only numbers below `md`; steps are not announced as "Etapa X de 4" to assistive tech | `Create.tsx` |
| A5 | Dialogs | `Modal` has no `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, initial focus or focus return; mobile variant is a bottom-anchored card without a drag handle or safe-area padding | `components/ui.tsx` |
| A6 | Menus | Profile, notifications and tile "more" menus close on `mousedown` only (no Esc, no arrow keys, no `aria-expanded`/`aria-haspopup`); tile menu opens upwards and can be clipped | `AppLayout.tsx`, `creative/parts.tsx` |
| A7 | Touch targets | ~36 controls at 28–32 px (`h-8`, `size-7`, `size-8`), below the 44 px (iOS HIG) / 48 dp (Material) / 24 px minimum (WCAG 2.2 SC 2.5.8) | tiles, calendar, editor |
| A8 | Hover-only | Calendar "add" button and Dashboard theme CTA are `opacity-0 group-hover:opacity-100`, invisible on touch | `CalendarPage.tsx`, `Dashboard.tsx` |
| A9 | Contrast | `text-slate-400` (#97a4a7 ≈ 2.6:1 on white) used ~35 times for real content; placeholders also slate-400 | global |
| A10 | Type scale | Many ad-hoc sizes (`text-[10px]`, `[11px]`, `[12.5px]`, `[13px]`, `[13.5px]`, `[14.5px]`…); 10–11 px text in calendar/tiles is too small on phones | global |
| A11 | Forms | Validation shows a red border only; no inline error text, no `aria-describedby`, no error summary or focus on first invalid field; group fields use `aria-invalid` on a `div` | `Step1Briefing.tsx`, `Auth.tsx` |
| A12 | Feedback | Toasts auto-dismiss in 3.2 s, cannot be dismissed, errors are not `role="alert"`, and they overlap the bottom nav on mobile | `components/ui.tsx` |
| A13 | Loading | Generation screen is a fake timed progress (520 ms per phase) not tied to the real request; no cancel; no skeleton for results | `Step4Generate.tsx` |
| A14 | Wide pages | Calendar month grid (7 columns) is unusable at 360 px; Library/Dashboard decorative blobs use `w-[1400px]` | `CalendarPage.tsx`, `Library.tsx`, `Dashboard.tsx`, `Brand.tsx` |
| A15 | Viewport | `h-screen` / `vh` used instead of `dvh` (mobile browser bars cause jumps); `94vh` modal max-height | `Auth.tsx`, `Landing.tsx`, `ui.tsx` |
| A16 | Semantics | Duplicate `<h1>` (layout title + page titles), `Card` with `onClick` on a `div`, selectable chips without group labels | various |
| A17 | Theming | No dark mode; `color-scheme: light` is forced | `index.css`, `index.html` |
| A18 | PWA | Manifest exists but no install prompt, no offline shell, no splash/icon set review | `public/manifest.webmanifest` |

---

## 2. Principles & reference patterns

We follow established platform guidelines and copy *patterns* (not visuals) from apps our audience already knows.

| Principle | Standard / reference | How it shows up in MIDFLOW |
|---|---|---|
| Mobile-first | Design at 360×800, scale up at `sm 640` / `md 768` / `lg 1024` / `xl 1280` | Base Tailwind classes are the phone layout; breakpoints only add |
| Thumb zone | Material 3, Apple HIG, Nubank, iFood | Primary CTA in a sticky bottom action bar on mobile; destructive actions never in the bottom-right |
| Bottom sheets over dialogs | Material 3 bottom sheets, Instagram share sheet, Google Maps | All modals become draggable bottom sheets below `md`; centered dialogs from `md` up |
| Progressive disclosure | Canva, Typeform, Nubank onboarding | Long briefing split into short sections with one question group per screen on mobile |
| Immediate preview | Canva, CapCut, Instagram composer | Collapsible preview drawer / "Ver prévia" FAB on mobile in steps 1–3 |
| Content-first results | Instagram grid, Pinterest, Canva "Your designs" | Step 4 and Library: full-bleed grid, long-press/kebab for actions, swipe between items in viewer |
| Familiar story viewer | Instagram Stories | Tap left/right, hold to pause, progress segments, swipe down to close |
| Desktop productivity | Linear, Notion, Figma | Persistent sidebar, keyboard shortcuts, side-by-side editor with live canvas |
| Accessibility | **WCAG 2.2 AA**, WAI-ARIA Authoring Practices, eMAG (Brazilian gov. guideline) | Contrast ≥ 4.5:1, targets ≥ 44 px, full keyboard paths, screen-reader labels in pt-BR |
| Performance | Core Web Vitals (LCP < 2.5 s, INP < 200 ms, CLS < 0.1) on a mid-range Android over 4G | Route-level code splitting, image `srcset`, no layout shift on fonts/images |

Non-negotiable invariants from `AGENTS.md` still apply: creatives are only restyled inside `Creative.tsx` at 1080-px coordinates (WYSIWYG), engine status (`ai` vs `fallback`) is always visible, `prefers-reduced-motion` is respected everywhere.

---

## 3. Design system foundation (Phase 1)

Everything else depends on this; it is done first and in isolation so screens can migrate one by one.

### 3.1 Tokens (`src/index.css` `@theme`)
- **Semantic color layer** on top of the existing palette: `--color-surface`, `--color-surface-2`, `--color-fg`, `--color-fg-muted`, `--color-fg-subtle`, `--color-border`, `--color-accent`, `--color-accent-fg`, `--color-danger`, `--color-warning`, `--color-success`, `--color-focus`. Components use only semantic tokens.
- **Contrast fix:** `fg-subtle` becomes ≥ 4.5:1 on white (≈ slate-500 darkened to `#5f6e72`); slate-400 reserved for disabled/decorative only. Placeholder ≥ 4.5:1 where it carries meaning.
- **Type scale** (fluid with `clamp`) replacing ad-hoc sizes: `caption 12`, `body-sm 14`, `body 16`, `title-sm 18`, `title 20–22`, `headline 24–28`, `display 32–48`. Minimum 12 px anywhere in the app UI; body text 16 px on mobile inputs (prevents iOS zoom).
- **Spacing & radius:** 4-pt scale; radii `sm 8 / md 12 / lg 16 / xl 24`; one elevation scale (`e0…e3`).
- **Motion tokens:** `duration-fast 120ms / base 200ms / slow 320ms`, standard and emphasized easings; every keyframe gated by `prefers-reduced-motion`.
- **Layout tokens:** `--header-h` (56 px mobile / 64 px desktop), `--bottom-nav-h`, `--action-bar-h`, safe-area insets. All sticky offsets read from these (removes `top-[76px]`, `top-[84px]`, `top-[100px]`).
- **Dark mode (optional, end of plan):** semantic tokens redefined under `[data-theme="dark"]` + `prefers-color-scheme`. Creatives are not affected (they render their own palette).

### 3.2 Component kit (`src/components/ui/` — split the current `ui.tsx`)
Each component gets: mobile + desktop behavior, all states (default, hover, focus-visible, active, disabled, loading, error), ARIA pattern, and a story in the dev gallery.

| Component | Changes |
|---|---|
| `Button` / `IconButton` | Sizes `sm 40 / md 44 / lg 52`; `IconButton` requires `aria-label`; hit area ≥ 44 px via padding even when the glyph is small |
| `Field` (new) | Wraps label + control + hint + error; wires `id`, `aria-describedby`, `aria-invalid`, `aria-required`; error text with icon (not color alone) |
| `Input`, `Textarea`, `Select` | 16 px text on mobile, `inputmode`/`autocomplete` props, counter announced politely near the limit |
| `ChoiceGroup` (new) | Replaces ad-hoc chip/card grids: `role="radiogroup"` or checkbox group with `fieldset`/`legend`, roving tabindex, arrow-key navigation |
| `Sheet` (new) + `Dialog` | Shared `Overlay` primitive: `role="dialog"`, `aria-modal`, labelled title, focus trap, initial focus, focus return, Esc, scroll lock, `inert` on background. Bottom sheet below `md` (drag handle, snap points, swipe-down to close, safe-area padding); centered dialog from `md` |
| `Menu` (new) | Disclosure/menu button pattern: `aria-haspopup`, `aria-expanded`, Esc, arrow keys, outside click/touch, auto-flip to stay in viewport; renders as an action sheet on mobile |
| `Tabs` | Full WAI-ARIA tabs (`aria-controls`, arrow keys); scrollable variant with edge fade |
| `Toast` | Bottom-center on mobile above bottom nav/action bar, top-right on desktop; dismiss button; errors `role="alert"` and do not auto-dismiss; optional action ("Desfazer") |
| `ActionBar` (new) | Sticky bottom bar on mobile with primary + secondary action, safe-area aware; becomes inline footer on desktop |
| `Skeleton`, `Spinner`, `ProgressSteps` | Consistent loading language; skeletons sized like final content (no CLS) |
| `EmptyState`, `ErrorState` | Illustration slot, title, text, primary action, retry |
| `Stepper` | Mobile: compact "Etapa 2 de 4 · Conteúdo" + segmented progress bar; desktop: labelled steps; `aria-current="step"`, steps as links when reachable |
| `Card` | Pure container; interactive cards become `<a>`/`<button>` (fixes `div onClick`) |

### 3.3 Iconography & imagery
- Icons 20 px default (24 px in nav), stroke 1.75, always paired with text or `aria-label`.
- Photos: `loading="lazy"`, `decoding="async"`, explicit `width/height` or `aspect-ratio`, responsive `srcset` for the theme and style thumbnails.

**Exit criteria:** dev gallery (`/dev/galeria`) shows every component in every state at 360 px and 1280 px; axe reports 0 violations on the gallery.

---

## 4. App shell & navigation (Phase 2)

- **Mobile header (56 px):** page title + contextual action (e.g. "Salvar" in editor); back arrow on nested routes and inside the create flow; profile avatar opens an account sheet (brand switcher, plan, settings, sair). Notifications move into the account sheet badge on mobile.
- **Bottom navigation (5 items):** Início · Posts · **Criar** (raised center action) · Calendário · Salvos — labels always visible, 48 px targets, `aria-current="page"`. Hidden while the keyboard is open and inside full-screen flows (editor, story viewer).
- **Drawer removed on mobile**; secondary pages (Minha marca, Relatórios, Planos, Configurações) live in the account sheet.
- **Desktop (`lg+`):** collapsible sidebar (248 px ↔ 72 px icon rail, remembered per viewer), header 64 px with page title once (single `<h1>` per page — page components own their heading).
- **Skip link** "Pular para o conteúdo", landmark roles (`header`, `nav`, `main`), route change announces the new page title via a polite live region and moves focus to `<h1>`.
- **Scroll restoration** per route and per create step; `dvh` units everywhere.
- **Plan usage** shown as a compact meter in the account sheet and sidebar; upgrade CTA never blocks navigation.

---

## 5. Create flow (Phase 3 — highest impact)

Target: a first-time user on a phone completes briefing → 8 creatives in under 3 minutes, never scrolling more than ~2 screens per step.

### 5.1 Shared flow chrome
- Compact stepper at top, **sticky `ActionBar`** at bottom: `Voltar` (secondary) + `Continuar` / `Gerar criativos` (primary). Disabled primary shows *why* (helper text), it never silently fails.
- **Preview on mobile:** a "Ver prévia" pill above the action bar opens a bottom sheet with the live preview (same components as desktop). On `lg+` the preview is a sticky right column (moves split from `xl` to `lg`).
- Autosave indicator ("Rascunho salvo") using the existing Zustand persistence; leaving with unsaved edits in the editor asks for confirmation.

### 5.2 Step 1 — Briefing
- Group fields into 3 collapsible sections with progress: **Seu negócio** (nome, @, segmento, cidade, sobre) · **Público e objetivos** · **Voz e marca** (tom, estilo, cores, formatos). On mobile one section open at a time (accordion); on desktop all open.
- Inline validation on blur, error summary at top on submit with links that focus each invalid field.
- Segment select → searchable combobox / chip grid with icons (faster on touch than a native `<select>` with many items).
- Color picker: native `input[type=color]` + HEX field + "usar cores do logo" (later), each swatch with an accessible name ("Cor 1, #0B765B, remover").
- "Preencher exemplo" stays, labelled as example data.

### 5.3 Step 2 — Conteúdo
- Format toggles become a `ChoiceGroup` (checkbox cards).
- Theme categories as a horizontally scrollable tab list with edge fades; themes as a 2-col grid on phones, 4-col from `md`, with visible selected state (check + border, not only color).
- Objective as a radiogroup with description text visible (not only in `title` tooltips, which don't exist on touch).
- "Gerar novos exemplos" as a secondary action in the preview sheet.

### 5.4 Step 3 — Estilo
- Brand identity vs suggested palette as a segmented control.
- Visual styles: horizontal snap carousel on mobile (large thumbnails, Instagram-filter-picker feel), 6-col grid on desktop.
- Logo upload: drag-and-drop on desktop, camera/gallery picker on mobile (`accept="image/*"`), with preview and remove.
- Aspect ratio `1:1` / `4:5` as a segmented control with mini frame icons.

### 5.5 Step 4 — Gerar criativos
- **Generation state tied to the real request:** indeterminate progress with rotating phase copy while the request runs, real completion when it resolves, `Cancelar` button (AbortController), and a clear error state with "Tentar novamente" / "Usar modelo offline" (honest fallback label preserved).
- **Results skeleton** in the exact grid geometry, then cards fade in (no CLS).
- **Header actions collapse:** mobile shows only the title + kebab menu (Editar briefing, Nova versão, Salvar tudo); the primary "Salvar tudo" / "Baixar ZIP" lives in the sticky `ActionBar`. Desktop keeps inline buttons.
- **Version switcher** as a compact segmented control/select ("Versão 2 de 3").
- **Tabs** Posts · Stories · Legendas as accessible sticky tabs (offset from `--header-h`).
- **Grid:** 2 columns on phones (posts), stories as a horizontal 9:16 row with snap; selection mode via long-press or a "Selecionar" toggle (like Google Photos), with a sticky selection bar ("3 selecionados · Baixar · Salvar").
- **Creative viewer:** full-screen on mobile with swipe between creatives, pinch-zoom on the image, caption below with "Copiar legenda" and "Copiar hashtags" as separate actions.
- **Story sequence player:** Instagram-like — segmented progress, tap zones, press-and-hold to pause, swipe down to close, pause button for keyboard/screen-reader users, auto-advance disabled under reduced motion.
- **Phone mockup** on desktop only (it is redundant on an actual phone; the full-screen viewer replaces it).
- Quality score badge explains itself on tap (sheet with the checklist), not on hover.

### 5.6 Creative editor (`Editor.tsx`)
- **Mobile:** full-screen editor — canvas on top (≈ 55% of height, sticky), tool tabs as a bottom toolbar (Texto · Layout · Cores · Imagem), each tool opens its panel in a bottom sheet with snap points (Canva/Instagram editor pattern). Header: `Cancelar` · title · `Salvar`.
- **Desktop:** canvas left, panel right (current layout) with keyboard shortcuts (`Ctrl+S` salvar, `Esc` fechar, `Ctrl+Z` desfazer).
- **Undo/redo** stack for edits (local state), "Restaurar original".
- Text fields show remaining characters vs the quality-gate limits, warn before exceeding.
- AI actions (rewrite, new image) show inline progress on the affected field only and are cancellable.

---

## 6. Other screens (Phase 4)

| Screen | Mobile-first changes |
|---|---|
| **Landing** | Hero fits one phone screen with the CTA visible without scrolling; sticky bottom CTA after the hero on mobile; segment carousel with snap + visible controls; reduce marquee/heavy motion on mobile; social proof and pricing cards stack with the recommended plan first; `dvh` fixes; LCP image preloaded |
| **Auth** | Single column, social/demo action prominent, `autocomplete` (`email`, `current-password`, `new-password`), show/hide password, inline errors, keyboard "Enter" submits; brand panel only on `lg+` |
| **Dashboard** | One primary card "Criar conteúdo da semana", horizontal scroll of suggested themes, recent saves; usage meter; remove hover-only CTAs; stat cards 2×2 |
| **Meus posts** | List with thumbnails grouped by date, swipe/kebab actions, search & filter chips |
| **Biblioteca** | Masonry/grid 2-col mobile → 6-col `2xl`; filter tabs scrollable; multi-select bar; confirm deletes with undo toast instead of a modal |
| **Calendário** | Mobile default = **agenda/week view** (list by day, like Google Calendar mobile); month grid from `md`; tap a day to open a "schedule" sheet; "add" always visible; drag-to-reschedule on desktop only, with a keyboard alternative ("Mover para…") |
| **Minha marca** | Sections as cards with inline edit; brand switcher as a list with avatars; remove `w-[1400px]` decorations |
| **Relatórios** | Charts readable at 360 px (horizontal bars over donuts), data table alternative for screen readers |
| **Planos** | Plan cards as horizontal snap carousel on mobile starting at Pro (recommended), comparison table collapses into accordion; prices R$ 47 / 77 / 127 unchanged |
| **Configurações** | Grouped settings list (iOS Settings pattern), toggles with labels, destructive "Redefinir dados" isolated with confirmation |
| **SocialPublishModal** | Bottom sheet with steps (copiar legenda → baixar imagem → abrir Instagram), native `navigator.share` with files where supported |

---

## 7. Accessibility checklist (applies to every phase)

- [ ] WCAG 2.2 AA contrast: text ≥ 4.5:1, large text/UI components ≥ 3:1, focus indicator ≥ 3:1 and never hidden (2.4.11 Focus Not Obscured — sticky bars must not cover focused fields).
- [ ] Target size ≥ 24 px (2.5.8) everywhere; ≥ 44 px for primary touch controls.
- [ ] Every interaction reachable by keyboard; logical tab order; no keyboard traps except intentional dialog focus traps.
- [ ] Dialogs, menus, tabs, radiogroups, comboboxes follow WAI-ARIA APG patterns.
- [ ] Every gesture (swipe, long-press, drag, pinch) has a single-tap/button alternative (2.5.1, 2.5.7).
- [ ] Forms: visible labels, programmatic errors, error summary, no info by color alone, `autocomplete` on personal fields (1.3.5), redundant entry avoided (3.3.7).
- [ ] Live regions: generation progress, save confirmations, errors, route changes.
- [ ] Images: meaningful `alt` in pt-BR for creatives ("Post 2: título do post"), `alt=""` for decorative.
- [ ] Zoom to 200% and text spacing overrides do not break layouts; content reflows at 320 px width (1.4.10).
- [ ] `prefers-reduced-motion`: no auto-advancing stories, no marquee, no parallax/float; `prefers-contrast: more` bumps borders.
- [ ] Language: `lang="pt-BR"`; screen-reader strings reviewed by a native speaker.

---

## 8. Performance & PWA (Phase 5)

- Route-level `React.lazy` for app pages, editor, calendar, export libs (`html-to-image`, `jszip` only loaded on first export).
- Responsive images (`srcset`/`sizes`) and WebP/AVIF variants for `src/assets/photos`; thumbnails ≤ 40 KB.
- Font loading: keep self-hosted fonts (required for export); preload only the UI font; creative fonts loaded on demand.
- Avoid `backdrop-blur` on large sticky surfaces on low-end Android (fallback solid background).
- PWA: valid manifest icons (maskable 192/512), theme color, offline app shell + last generation cached, "Adicionar à tela inicial" hint after first successful generation.
- Budgets in CI: JS initial ≤ 180 KB gzip, LCP < 2.5 s on Moto G Power–class profile, CLS < 0.1, INP < 200 ms.

---

## 9. Quality assurance & tooling

| Tool | Purpose |
|---|---|
| **Playwright** (dev dependency) | E2E of the main journey (demo → briefing → generate → edit → export) on `Pixel 7`, `iPhone 14` and `Desktop Chrome` profiles; visual snapshots at 360 / 768 / 1280 px |
| **@axe-core/playwright** | Automated a11y scan on every route and open dialog; CI fails on serious/critical issues |
| **Lighthouse CI** | Performance, a11y and best-practices scores ≥ 90 on Landing, Dashboard, Step 1, Step 4 |
| Manual | VoiceOver (iOS Safari), TalkBack (Android Chrome), NVDA (Windows), keyboard-only pass, 200% zoom pass |
| Usability | 5 small-business owners on their own phones, task: "crie e baixe 4 posts para sua empresa"; measure time to first download, errors, SUS score |

Existing checks stay mandatory: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. The generation contract and quality gate (`npm run eval` ≥ 85) are untouched by this phase.

---

## 10. Phases & milestones

| # | Phase | Scope | Exit criteria |
|---|---|---|---|
| 0 | Baseline | Playwright + axe + Lighthouse set up; screenshots and scores of the current app at 360/768/1280 | Baseline report committed (`docs/ux-baseline.md`) |
| 1 | Design system | Tokens (§3.1), component kit (§3.2), dev gallery | Gallery 0 axe violations; all components keyboard-operable |
| 2 | App shell | Header, bottom nav, account sheet, sidebar rail, skip link, focus management (§4) | Navigation fully usable at 320 px and by keyboard/screen reader |
| 3 | Create flow | Steps 1–4, action bar, preview sheet, real generation states, viewer, story player, editor (§5) | Journey E2E green on 3 device profiles; < 3 min to first export in usability test |
| 4 | Other screens | Landing, Auth, Dashboard, Posts, Library, Calendar, Brand, Reports, Plans, Settings, publish sheet (§6) | Every route passes axe and has 360-px snapshot |
| 5 | Performance & PWA | Code splitting, images, budgets, offline shell (§8) | Lighthouse ≥ 90 (perf, a11y) on key routes; budgets enforced in CI |
| 6 | Polish & validation | Dark mode (optional), micro-interactions, usability round, fixes | SUS ≥ 80; no open serious a11y issues |

Suggested order of work inside Phase 3 (highest value first): Step 4 results + viewer → Editor mobile → shared ActionBar/preview sheet → Step 1 → Steps 2–3.

---

## 11. Risks & decisions to confirm

1. **Dark mode** — worth doing now or after validation? (Plan treats it as optional in Phase 6.)
2. **Calendar on mobile** — agenda view as default is a departure from the mockups; confirm with the client.
3. **New dev dependencies** — Playwright, axe-core and Lighthouse CI are dev-only; no new runtime UI library is planned (primitives built in-house on Tailwind to keep bundle small). Alternative: adopt Radix primitives for Dialog/Menu/Tabs to reduce a11y risk (+~25 KB).
4. **Mockup fidelity** — the reference mockups are desktop; mobile layouts in this plan are new designs and should be reviewed with the client before Phase 3 starts.
5. **Export on iOS Safari** — `html-to-image` + downloads behave differently; prefer `navigator.share({ files })` on mobile, keep ZIP for desktop.
