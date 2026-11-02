/**
 * Performance budget for the production build (run after `npm run build`).
 * Initial JS = every script and modulepreload referenced by dist/index.html, measured gzipped.
 * Lazy chunks get a softer per-chunk cap so a single route cannot quietly balloon.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = 'dist'
const BUDGET = {
  initialJsKb: 180,
  initialCssKb: 30,
  lazyChunkKb: 60, // jszip (export only) is excluded below
}

const gz = (file: string) => gzipSync(readFileSync(join(DIST, file))).length / 1024
const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const refs = [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])
const initial = [...new Set(refs)]

const sum = (ext: string) => initial.filter((f) => f.endsWith(ext)).reduce((n, f) => n + gz(f), 0)
const js = sum('.js')
const css = sum('.css')

const lazy = readdirSync(join(DIST, 'assets'))
  .map((f) => `assets/${f}`)
  .filter((f) => f.endsWith('.js') && !initial.includes(f) && !f.includes('jszip'))
  .map((f) => ({ f, kb: gz(f) }))
  .sort((a, b) => b.kb - a.kb)

const rows: [string, number, number][] = [
  ['Initial JS (gzip)', js, BUDGET.initialJsKb],
  ['Initial CSS (gzip)', css, BUDGET.initialCssKb],
  [`Largest lazy chunk: ${lazy[0]?.f ?? '-'}`, lazy[0]?.kb ?? 0, BUDGET.lazyChunkKb],
]

let failed = false
for (const [label, kb, max] of rows) {
  const ok = kb <= max
  failed ||= !ok
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${kb.toFixed(1)} KB / ${max} KB`)
}
if (failed) {
  console.error('\nPerformance budget exceeded. Split the code (route/lazy import) or trim dependencies.')
  process.exit(1)
}
