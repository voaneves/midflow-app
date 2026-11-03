/** Chart color tokens (light, dark by OS setting, dark by theme toggle) injected once by the AI health panel. */
export const VIZ_CSS = `
.viz-root {
  color-scheme: light;
  --viz-surface: #fcfcfb;
  --viz-text: #0b0b0b;
  --viz-text-2: #52514e;
  --viz-grid: #e4e3df;
  --viz-s1: #2a78d6;
  --viz-s2: #eb6834;
  --viz-s3: #6250d6;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .viz-root {
    color-scheme: dark;
    --viz-surface: #1a1a19;
    --viz-text: #f0efec;
    --viz-text-2: #c3c2b7;
    --viz-grid: #3a3a37;
    --viz-s1: #3987e5;
    --viz-s2: #d95926;
    --viz-s3: #9085e9;
  }
}
:root[data-theme="dark"] .viz-root {
  color-scheme: dark;
  --viz-surface: #1a1a19;
  --viz-text: #f0efec;
  --viz-text-2: #c3c2b7;
  --viz-grid: #3a3a37;
  --viz-s1: #3987e5;
  --viz-s2: #d95926;
  --viz-s3: #9085e9;
}
.viz-root { background: var(--viz-surface); color: var(--viz-text); }
.viz-root .viz-bar, .viz-root .viz-dot { transition: opacity 120ms; }
@media (prefers-reduced-motion: reduce) { .viz-root .viz-bar, .viz-root .viz-dot { transition: none; } }
`
