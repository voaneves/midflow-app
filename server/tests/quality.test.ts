import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePack } from '../ai/pipeline.ts'
import { reviewPack } from '../ai/quality.ts'
import type { LLMRequest, LLMResult } from '../ai/llm.ts'
import { BRIEFINGS } from './fixtures.ts'

const params = BRIEFINGS[0]

function goodPack(): any {
  const caption =
    'Seu cabelo merece um cuidado que dura além do dia do salão. No Studio Aurora, cada hidratação começa com um diagnóstico dos fios para escolher os ativos certos.\n\nResultado: brilho, maciez e menos frizz por semanas. Agende pelo Direct ou link da bio!'
  const tags = ['#StudioAurora', '#PalmasTO', '#Hidratacao', '#CronogramaCapilar', '#CabeloSaudavel']
  return {
    themeLabel: 'Hidratação que dura',
    posts: [
      { variant: 'photo', tag: 'HIDRATAÇÃO', headline: 'Fios macios por semanas', highlight: 'macios', sub: 'Diagnóstico + ativos certos.', cta: 'Agende já', imagePrompt: 'woman with shiny hair', caption, hashtags: tags },
      { variant: 'list', tag: 'DICA', headline: '3 passos do cronograma', highlight: 'cronograma', sub: 'Simples de seguir.', bullets: ['Hidratação semanal', 'Nutrição quinzenal', 'Reconstrução mensal'], cta: 'Salve o post', imagePrompt: 'hair products', caption, hashtags: [...tags.slice(1), '#Dicas'] },
      { variant: 'icons', tag: 'DIFERENCIAIS', headline: 'Por que o Studio Aurora', highlight: 'Studio Aurora', sub: 'Atendimento sem pressa.', icons: [{ icon: 'droplet', label: 'Ativos profissionais' }, { icon: 'heart', label: 'Sem pressa' }, { icon: 'unknown', label: 'Diagnóstico' }], cta: 'Conheça', imagePrompt: 'salon interior', caption, hashtags: tags },
      { variant: 'offer', tag: 'AGENDA ABERTA', headline: 'Horários livres nesta semana', highlight: 'Horários livres', sub: 'Garanta o seu.', bullets: ['Hidratação profunda', 'Escova inclusa'], price: { label: 'Por', value: '89', cents: '90' }, cta: 'Reservar', imagePrompt: 'calendar salon', caption, hashtags: tags },
    ],
    stories: [
      { headline: 'Seu cabelo anda sem brilho?', highlight: 'sem brilho', poll: ['Sim, muito', 'Às vezes'], cta: 'Vote', imagePrompt: 'dull hair', caption: 'gancho' },
      { headline: 'Sinais de que precisa hidratar', highlight: 'hidratar', bullets: ['Pontas ásperas', 'Frizz constante', 'Fios opacos'], cta: 'Veja mais', imagePrompt: 'hair closeup', caption: 'problema' },
      { headline: 'Hidratação com diagnóstico', highlight: 'diagnóstico', sub: 'Ativos certos para seus fios.', cta: 'Saiba mais', imagePrompt: 'stylist', caption: 'solução' },
      { headline: 'Agende pelo Direct hoje', highlight: 'Direct', sub: 'Vagas desta semana.', cta: 'Chamar no Direct', imagePrompt: 'phone', caption: 'cta' },
    ],
  }
}

test('a well-formed pack passes with a high score', () => {
  const { report, pack } = reviewPack(goodPack(), params)
  assert.equal(report.passed, true, JSON.stringify(report.issues))
  assert.ok(report.score >= 90, `score ${report.score}`)
  assert.equal(pack.posts.length, 4)
  assert.equal(pack.stories.length, 4)
})

test('invented prices are removed, unknown icons are replaced', () => {
  const { pack, report } = reviewPack(goodPack(), params)
  assert.equal(pack.posts[3].price, undefined)
  assert.ok(report.issues.some((i) => /preço inventado/.test(i.message) && i.fixed))
  assert.equal(pack.posts[2].icons?.[2].icon, 'sparkles')
})

test('a price that IS in the briefing is kept', () => {
  const food = BRIEFINGS[1] // briefing mentions R$ 39,90
  const p = goodPack()
  p.posts[3].price = { label: 'Executivo por', value: '39', cents: '90' }
  const { pack } = reviewPack(p, food)
  assert.equal(pack.posts[3].price?.value, '39')
})

test('placeholders copied from the schema are critical', () => {
  const p = goodPack()
  p.posts[1].bullets = ['Item específico 1', 'Item específico 2', 'Item específico 3']
  const { report } = reviewPack(p, params)
  assert.equal(report.passed, false)
  assert.ok(report.issues.some((i) => i.severity === 'critical'))
})

test('highlight is repaired to a substring of the headline', () => {
  const p = goodPack()
  p.posts[0].highlight = 'algo que não existe'
  const { pack } = reviewPack(p, params)
  assert.ok(pack.posts[0].headline.includes(pack.posts[0].highlight))
})

test('hashtags are normalized and moved out of the caption', () => {
  const p = goodPack()
  p.posts[0].hashtags = ['Hidratação', '#Cabelo Saudável', '#cabelo', '#PalmasTO', 'StudioAurora']
  p.posts[0].caption += ' #extra'
  const { pack } = reviewPack(p, params)
  assert.deepEqual(pack.posts[0].hashtags.slice(0, 2), ['#Hidratacao', '#CabeloSaudavel'])
  assert.ok(!pack.posts[0].caption.includes('#extra'))
})

test('template fallback for every segment still produces 4 posts + 4 stories', async () => {
  const offline = async (): Promise<LLMResult> => ({ ok: false, engine: 'none', model: 'x', latencyMs: 0, attempts: 0, error: 'offline' })
  for (const b of BRIEFINGS) {
    const r = await generatePack(b, 1, offline)
    assert.equal(r.engine, 'template')
    assert.equal(r.pack.posts.length, 4, b.brandName)
    assert.equal(r.pack.stories.length, 4, b.brandName)
    assert.ok(r.pack.posts.every((p) => !p.price), `${b.brandName}: template must not show invented prices`)
  }
})

test('pipeline repairs a weak answer and keeps the better one', async () => {
  const weak = goodPack()
  for (const p of weak.posts) p.caption = 'curta' // 4 major issues → below the 85 bar
  const calls: LLMRequest[] = []
  const fake = async (req: LLMRequest): Promise<LLMResult> => {
    calls.push(req)
    const data = calls.length === 1 ? weak : goodPack()
    return { ok: true, data, engine: 'gemini', model: 'fake', latencyMs: 1, attempts: 1 }
  }
  const r = await generatePack(params, 1, fake)
  assert.equal(calls.length, 2)
  assert.match(calls[1].user, /legenda curta/)
  assert.equal(r.repaired, true)
  assert.equal(r.engine, 'gemini')
  assert.ok(r.report.score >= 90)
})

test('a hopeless AI answer falls back to templates and says so', async () => {
  const fake = async (): Promise<LLMResult> => ({ ok: true, data: { posts: [], stories: [] }, engine: 'gemini', model: 'fake', latencyMs: 1, attempts: 1 })
  const r = await generatePack(params, 1, fake)
  assert.equal(r.engine, 'template')
  assert.match(r.aiError ?? '', /abaixo do padrão/)
})
