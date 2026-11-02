# UX baseline (before the mobile-first overhaul)

Captured with `npm run e2e:baseline` (Playwright + axe-core, WCAG 2.2 A/AA tags) on the demo account,
at 360 / 768 / 1280 px. Raw numbers: [`ux-baseline/axe-before.json`](ux-baseline/axe-before.json).
Screenshots are written to `docs/ux-baseline/screens/` (git-ignored, regenerate locally).

## Automated accessibility (axe)

| Route | Violations (rules) | Serious/critical | Main issues |
|---|---|---|---|
| `/` Landing | 1 | 1 | `color-contrast` (5 nodes) |
| `/entrar`, `/cadastro` | 1 | 1 | `color-contrast` (5) |
| `/app` Dashboard | 2 | 2 | `color-contrast` (23–28), `label-content-name-mismatch` |
| `/app/criar/1` Briefing | 2 | 2 | `color-contrast` (12–16), `label-content-name-mismatch` |
| `/app/posts` | 2 | 2 | `color-contrast` (3–7), `label-content-name-mismatch` |
| `/app/biblioteca` | 3 | 3 | `button-name` (8 unnamed icon buttons), `color-contrast` (8–10), `label-content-name-mismatch` (5) |
| `/app/calendario` | 2 | 2 | `color-contrast` (8–11), `label-content-name-mismatch` |
| `/app/marca` | 2 | 2 | `color-contrast` (9–15), `label-content-name-mismatch` |
| `/app/relatorios` | 2 | 2 | `color-contrast` (22–27), `label-content-name-mismatch` |
| `/app/planos` | 2 | 2 | `color-contrast` (12–16), `label-content-name-mismatch` |
| `/app/config` | 3 | 3 | `color-contrast` (8–13), `definition-list`, `label-content-name-mismatch` |

Every route fails contrast (mostly `text-slate-400` and 10–11 px text). The profile button's
`aria-label="Menu do perfil"` does not contain its visible text (`label-content-name-mismatch`, WCAG 2.5.3).
No route overflowed horizontally at 360 px.

## Manual observations at 360 px

- Briefing (step 1) is a single 2 900 px column; the live preview starts ~1 900 px below the fold.
- The bottom navigation overlaps form content and the toasts; primary CTA only at the end of the form.
- Header is 76 px tall; a drawer duplicates the bottom navigation.
- Calendar month grid shows 7 columns of ~50 px with 10–11 px labels; "add" buttons are hover-only.
- Dialogs are not announced as dialogs, do not trap focus and do not return focus on close.
- Generation progress is a 3-second timer unrelated to the real request; there is no cancel.

## Not measured here

Lighthouse scores (needs a production build served over HTTP: `npm run build && npm run lhci`) and
manual screen-reader passes (VoiceOver, TalkBack, NVDA) are part of the Phase 6 validation round.
