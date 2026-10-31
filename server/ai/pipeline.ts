/**
 * Generation pipeline:  prompt → model → quality gate → (repair round) → best pack.
 * Falls back to the template engine only when the model is unavailable, and says so (engine: 'template').
 */
import { config } from '../config.ts'
import { synthesizeAIContent, THEME_LABELS_MAP } from '../aiService.ts'
import { callLLM } from './llm.ts'
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt, PACK_SCHEMA } from './prompt.ts'
import { openIssues, reviewPack } from './quality.ts'
import type { GenerateParams, QualityReport, RawPack } from './types.ts'

export interface PackResult {
  pack: RawPack
  report: QualityReport
  engine: 'gemini' | 'openai' | 'template'
  model: string
  latencyMs: number
  /** model calls made (initial + repairs + retries) */
  calls: number
  repaired: boolean
  /** set when the model failed and we used templates */
  aiError?: string
  usage: { inputTokens: number; outputTokens: number }
}

export type ModelCaller = typeof callLLM

export function themeLabelFor(p: GenerateParams): string {
  return (
    p.customTheme?.trim() ||
    (p.themeId && THEME_LABELS_MAP[p.themeId]) ||
    p.topics?.split(/[,.;\n]/)[0]?.trim() ||
    'Destaques da semana'
  )
}

export async function generatePack(
  params: GenerateParams,
  version = 1,
  callModel: ModelCaller = callLLM,
): Promise<PackResult> {
  const start = Date.now()
  const usage = { inputTokens: 0, outputTokens: 0 }
  const system = buildSystemPrompt()
  const first = await callModel({
    system,
    user: buildUserPrompt(params, version, themeLabelFor(params)),
    schema: PACK_SCHEMA,
    temperature: 0.9,
  })
  let calls = first.attempts

  if (first.ok) {
    usage.inputTokens += first.usage?.inputTokens ?? 0
    usage.outputTokens += first.usage?.outputTokens ?? 0
    let best = reviewPack(first.data, params)
    let repaired = false

    for (let round = 0; round < config.ai.repairRounds && best.report.score < config.ai.minQuality; round++) {
      const issues = openIssues(best.report)
      if (!issues.length) break
      const fix = await callModel({
        system,
        user: buildRepairPrompt(best.pack, issues),
        schema: PACK_SCHEMA,
        temperature: 0.4,
      })
      calls += fix.attempts
      if (!fix.ok) break
      usage.inputTokens += fix.usage?.inputTokens ?? 0
      usage.outputTokens += fix.usage?.outputTokens ?? 0
      const candidate = reviewPack(fix.data, params)
      if (candidate.report.score >= best.report.score) {
        best = candidate
        repaired = true
      }
    }

    // A pack that still fails hard (e.g. missing posts) is worse than the curated templates.
    if (best.report.passed) {
      return {
        ...best,
        engine: first.engine === 'openai' ? 'openai' : 'gemini',
        model: first.model,
        latencyMs: Date.now() - start,
        calls,
        repaired,
        usage,
      }
    }
    return templateResult(params, version, start, calls, `Resposta da IA abaixo do padrão mínimo (nota ${best.report.score}).`, usage)
  }

  return templateResult(params, version, start, calls, first.error, usage)
}

function templateResult(
  params: GenerateParams,
  version: number,
  start: number,
  calls: number,
  aiError: string | undefined,
  usage: PackResult['usage'],
): PackResult {
  const { pack, report } = reviewPack(synthesizeAIContent(params, version), params)
  return {
    pack,
    report,
    engine: 'template',
    model: 'midflow-templates',
    latencyMs: Date.now() - start,
    calls,
    repaired: false,
    aiError: aiError || 'IA não configurada.',
    usage,
  }
}
