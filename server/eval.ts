/**
 * Quality evaluation:  npm run eval  [-- --runs 2] [-- --min 85]
 *
 * Runs every briefing in server/tests/fixtures.ts through the real pipeline (real model, real quality gate)
 * and prints a report. Exit code 1 when the average AI score is below --min or the AI fell back to templates,
 * so it can run on a schedule / before each release to catch regressions (prompt changes, model retirements…).
 * Full results are saved to server/data/eval-<timestamp>.json for side-by-side reading.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generatePack } from './ai/pipeline.ts'
import { openIssues } from './ai/quality.ts'
import { aiEnabled, config } from './config.ts'
import { BRIEFINGS } from './tests/fixtures.ts'

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? Number(process.argv[i + 1]) : fallback
}
const runs = arg('runs', 1)
const min = arg('min', config.ai.minQuality)

if (!aiEnabled()) {
  console.error('IA não configurada: defina GEMINI_API_KEY (ou OPENAI_API_KEY) no .env antes de rodar a avaliação.')
  process.exit(2)
}

console.log(`Avaliando ${BRIEFINGS.length} briefings × ${runs} execução(ões) com ${config.ai.provider}/${config.ai.model}\n`)

const rows: any[] = []
for (let run = 1; run <= runs; run++) {
  for (const b of BRIEFINGS) {
    const r = await generatePack({ ...b, seed: b.seed! + run }, run)
    const issues = openIssues(r.report)
    rows.push({ brand: b.brandName, segment: b.segment, run, ...r, issues })
    const flag = r.engine === 'template' ? '✗ TEMPLATE' : r.report.score >= min ? '✓' : '△'
    console.log(
      `${flag.padEnd(10)} ${b.brandName.padEnd(22)} nota ${String(r.report.score).padStart(3)}  ${(r.latencyMs / 1000).toFixed(1)}s  chamadas ${r.calls}${r.repaired ? '  (revisado)' : ''}`,
    )
    if (r.aiError) console.log(`           erro da IA: ${r.aiError}`)
    for (const i of issues.slice(0, 4)) console.log(`           - ${i}`)
  }
}

const ai = rows.filter((r) => r.engine !== 'template')
const avg = ai.length ? ai.reduce((s, r) => s + r.report.score, 0) / ai.length : 0
const tokensOut = ai.reduce((s, r) => s + r.usage.outputTokens, 0)
console.log(`\nMédia (IA): ${avg.toFixed(1)}  |  usaram template: ${rows.length - ai.length}/${rows.length}  |  tokens de saída: ${tokensOut}`)

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
fs.mkdirSync(outDir, { recursive: true })
const file = path.join(outDir, `eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
fs.writeFileSync(file, JSON.stringify({ model: config.ai.model, min, rows }, null, 2))
console.log(`Resultados completos: ${file}`)

process.exit(ai.length === rows.length && avg >= min ? 0 : 1)
