import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reviewPack } from '../ai/quality.ts'
import type { GenerateParams } from '../ai/types.ts'
import { synthesizeAIContent, synthesizeContextualRewrite, type AIRewriteRequest } from '../aiService.ts'
import { foldText, selectContextualPhotoId, selectEditorialPhotoId } from '../imageService.ts'
import { stockQuery } from '../pixabay.ts'
import { ALL_VOICES, looksLikeBakery, voiceFor } from '../templateVoices.ts'
import { BRIEFINGS } from './fixtures.ts'

/** Salon vocabulary that must never show up outside the beauty segment. */
const BEAUTY = /agende seu hor[aá]rio|protocolo|sal[aã]o|#BemEstar|#AltaPerformance|#CuidadoEspecializado|#AtendimentoPersonalizado|falar com especialista|garantir minha vaga|[uú]ltimos hor[aá]rios|linha profissional|cuidado planejado/i

/** Food and the neutral voice must also avoid appointment/clinic wording (health, pets and consultancies legitimately "agendam"). */
const BEAUTY_STRICT = new RegExp(`${BEAUTY.source}|agendar|procedimento|hora marcada|diagn[oó]stico preciso|agenda da semana`, 'i')
const STRICT_SEGMENTS = new Set(['alimentacao', 'outro', 'segmento-desconhecido', ''])

const base = {
  tones: ['profissional'],
  style: 'moderno',
  imageType: 'fotos' as const,
  palette: { dark: '#1F2937', mid: '#4B5563', soft: '#E5E7EB', light: '#F9FAFB', accent: '#14B8A6' },
  postFormat: '4:5' as const,
  posts: true,
  stories: true,
}

const bakery: GenerateParams = {
  ...base,
  brandName: 'Padaria Pão Nosso',
  handle: 'paonosso',
  segment: 'alimentacao',
  customTheme: 'Pão de fermentação natural',
  city: 'Palmas - TO',
  about: 'Padaria artesanal com pães de fermentação natural, bolos caseiros e café da manhã completo.',
  audience: 'Moradores do bairro.',
  topics: 'pão de fermentação natural, café da manhã, encomendas de bolos',
  objective: 'atrair',
}

const restaurant: GenerateParams = { ...BRIEFINGS[1], seed: 7 }

/** Every user-visible string of a pack, flattened. */
function textOf(pack: any): string {
  const out: string[] = [pack.themeLabel]
  for (const p of [...pack.posts, ...pack.stories]) {
    out.push(p.tag, p.headline, p.highlight, p.sub, p.cta, p.caption, ...(p.hashtags ?? []), ...(p.bullets ?? []), ...(p.poll ?? []), ...(p.icons ?? []).map((i: any) => i.label))
  }
  return out.filter(Boolean).join('\n')
}

function* variations(params: GenerateParams) {
  for (const seed of [1, 2, 3, 4, 5, 6, 98, 4242, 777]) for (const version of [1, 2, 3]) yield { seed, version, pack: synthesizeAIContent({ ...params, seed }, version) }
}

test('alimentacao: template copy has no beauty/salon vocabulary (restaurant and bakery)', () => {
  for (const params of [restaurant, bakery, { ...bakery, themeId: 'cafe', customTheme: undefined }]) {
    for (const { seed, version, pack } of variations(params)) {
      const m = textOf(pack).match(BEAUTY_STRICT)
      assert.equal(m, null, `"${m?.[0]}" apareceu (${params.brandName}, seed ${seed}, v${version})`)
    }
  }
})

test('alimentacao: the user-reported bakery case', () => {
  const pack = synthesizeAIContent(bakery, 1)
  const ctas = [...pack.posts, ...pack.stories].map((p: any) => p.cta)
  assert.ok(ctas.includes('Vem provar'), ctas.join(' | '))
  assert.ok(ctas.includes('Faça sua encomenda'), ctas.join(' | '))
  const text = textOf(pack)
  assert.doesNotMatch(text, /seu cuidado com|cuidado especializado/i)
  const tags = pack.posts.flatMap((p: any) => p.hashtags)
  assert.ok(tags.includes('#Padaria') && tags.includes('#PaoQuentinho'), tags.join(' '))
  const { report } = reviewPack(pack, bakery)
  assert.deepEqual(report.issues.filter((i) => !i.fixed && i.severity !== 'minor'), [])
  // Image prompts start from bread, so stock search finds bread (not sushi or cheese).
  assert.match(pack.posts[0].imagePrompt, /bread|bakery/i)
  assert.match(stockQuery(pack.posts[0].imagePrompt, 'alimentacao'), /bread/i)
})

test('a restaurant is not a bakery, and vice versa', () => {
  assert.equal(voiceFor('alimentacao', restaurant.brandName, restaurant.about, restaurant.topics).key, 'alimentacao')
  assert.equal(voiceFor('alimentacao', bakery.brandName, bakery.about).key, 'padaria')
  assert.equal(looksLikeBakery('Hamburgueria com pão brioche'), false)
  assert.equal(looksLikeBakery('Pães, bolos e café da manhã'), true)
  const restaurantCtas = synthesizeAIContent(restaurant, 1).posts.map((p: any) => p.cta)
  assert.ok(restaurantCtas.includes('Peça já'), restaurantCtas.join(' | '))
})

test('every non-beauty segment writes its own vocabulary; unknown segments get the neutral one', () => {
  for (const segment of ['alimentacao', 'fitness', 'saude', 'imoveis', 'pet', 'servicos', 'moda', 'outro', 'segmento-desconhecido', '']) {
    for (const city of ['', 'Curitiba - PR']) {
      for (const { seed, version, pack } of variations({ ...base, brandName: 'Casa Modelo', handle: 'casamodelo', segment, city, objective: 'atrair', about: 'Negócio local de bairro.' })) {
        const m = textOf(pack).match(STRICT_SEGMENTS.has(segment) ? BEAUTY_STRICT : BEAUTY)
        assert.equal(m, null, `"${m?.[0]}" em ${segment || '(vazio)'} (seed ${seed}, v${version})`)
        // The quality gate must accept the template pack: 4+4 cards, hashtags >= 5 and unique, highlights inside headlines.
        const { report, pack: reviewed } = reviewPack(pack, { ...base, brandName: 'Casa Modelo', handle: 'casamodelo', segment, objective: 'atrair' })
        const open = report.issues.filter((i) => !i.fixed && i.severity !== 'minor')
        assert.deepEqual(open, [], `${segment || '(vazio)'} seed ${seed} v${version}: ${JSON.stringify(open)}`)
        assert.ok(reviewed.posts.every((p) => p.hashtags.length >= 5))
      }
    }
  }
})

test('beleza keeps its salon copy', () => {
  const pack = synthesizeAIContent({ ...BRIEFINGS[0] }, 1)
  const text = textOf(pack)
  assert.match(text, /hor[aá]rio|protocolo|sal[aã]o/i)
  const adaptive = synthesizeAIContent({ ...BRIEFINGS[0], themeId: 'agendamentos' }, 1)
  assert.ok(adaptive.posts[0].cta === 'Agende seu horário')
  assert.ok(adaptive.posts[3].cta === 'Garantir minha vaga')
  assert.ok(adaptive.posts[2].hashtags.includes('#AltoPadrao'))
})

test('hair and skin packs are only used for beleza', () => {
  const pack = synthesizeAIContent({ ...restaurant, themeId: 'cabelo', customTheme: 'Hidratação e cronograma capilar' }, 1)
  assert.equal(textOf(pack).match(BEAUTY_STRICT), null)
  assert.doesNotMatch(pack.posts[0].imagePrompt, /salon|hair/i)
  assert.equal(voiceFor('alimentacao').key, 'alimentacao')
})

/* ---------------- rewrite ---------------- */

const MODES = ['vendedor', 'curto', 'sofisticado', 'descontraido', 'educativo'] as const

const creative = {
  headline: 'Pão de fermentação natural',
  highlight: 'fermentação natural',
  sub: 'Feito todos os dias.',
  bullets: ['Massa madre', 'Fermentação lenta', 'Assado na hora'],
  cta: 'Saiba mais',
  caption: 'Pão quentinho todo dia.',
  hashtags: ['#Padaria', '#Pao'],
}

test('rewrite follows the segment (no salon words for a bakery, restaurant, gym...)', () => {
  for (const segment of ['alimentacao', 'fitness', 'saude', 'imoveis', 'pet', 'servicos', 'moda', 'outro', undefined]) {
    for (const mode of MODES) {
      for (const seed of [1, 2, 3, 4]) {
        const req: AIRewriteRequest = { creative, mode, brandName: 'Padaria Pão Nosso', segment, seed }
        const out = synthesizeContextualRewrite(req)
        const text = [out.headline, out.highlight, out.sub, out.cta, out.caption, ...(out.bullets ?? [])].join('\n')
        const m = text.match(!segment || STRICT_SEGMENTS.has(segment) ? BEAUTY_STRICT : BEAUTY)
        assert.equal(m, null, `"${m?.[0]}" em ${segment} / ${mode} / seed ${seed}`)
        assert.ok(out.headline.toLowerCase().includes(out.highlight.toLowerCase()), `highlight "${out.highlight}" fora de "${out.headline}" (${segment}/${mode}/${seed})`)
        assert.ok(out.cta.length <= 26, `cta longo: ${out.cta}`)
        assert.ok(out.caption.includes('#Padaria'), 'hashtags do criativo preservadas')
        assert.ok(out.caption.includes('Padaria Pão Nosso'), `legenda sem a marca (${segment}/${mode})`)
      }
    }
  }
})

test('rewrite for a bakery speaks in bakery terms; beleza is unchanged', () => {
  const food = synthesizeContextualRewrite({ creative, mode: 'vendedor', brandName: 'Padaria Pão Nosso', segment: 'alimentacao', seed: 3 })
  assert.equal(food.cta, 'Fazer minha encomenda')
  assert.match(food.headline, /encomenda/)
  const salon = synthesizeContextualRewrite({ creative, mode: 'vendedor', brandName: 'Studio Aurora', segment: 'beleza', seed: 3 })
  assert.equal(salon.cta, 'Reservar meu horário')
  assert.match(salon.headline, /garanta seu horário/)
  assert.equal(salon.bullets?.[0], '✓ Massa madre')
  const educational = synthesizeContextualRewrite({ creative: { ...creative, bullets: undefined }, mode: 'educativo', brandName: 'Studio Aurora', segment: 'beleza', seed: 1 })
  assert.match(educational.bullets?.[0] ?? '', /protocolo/)
})

test('every voice has complete, well-sized copy', () => {
  assert.equal(ALL_VOICES.length, 10)
  for (const v of ALL_VOICES) {
    const where = v.key
    for (const [k, cta] of Object.entries(v.ctas)) assert.ok(cta.length <= 26, `${where}.ctas.${k}: ${cta}`)
    for (const block of [v.rewrite.vendedor, v.rewrite.sofisticado, v.rewrite.descontraido, v.rewrite.educativo]) assert.ok(block.cta.length <= 26, `${where}: ${block.cta}`)
    for (const c of [v.rewrite.curto.cta]) assert.ok(c.length <= 26)
    for (const o of v.s1) o.poll.forEach((x) => assert.ok(x.length <= 24, `${where} poll: ${x}`))
    for (const list of v.postTags) assert.ok(new Set(list).size === list.length && list.length >= 5 && list.length <= 8, `${where} postTags ${list.join(' ')}`)
    assert.ok(v.localTag.startsWith('#') && !v.postTags.flat().includes(v.localTag), `${where} localTag repetida`)
    assert.ok(v.p3.tag.length <= 22 && v.p4.tag.length <= 22, `${where} tag longa`)
    assert.ok((v.key === 'beleza' || v.p3.headline.length <= 60) && v.p3.headline.includes(v.p3.highlight), `${where} p3`)
    assert.ok(v.p3.highlight.length <= 28, `${where} highlight longo`)
    if (v.key !== 'beleza') {
      const all = JSON.stringify(v)
      assert.doesNotMatch(all, v.key === 'alimentacao' || v.key === 'padaria' || v.key === 'generico' ? BEAUTY_STRICT : BEAUTY, `${where} usa vocabulário de salão`)
    }
  }
})

/* ---------------- photos ---------------- */

// Photo id families that belong to one segment (the local library and the Unsplash catalog use these prefixes / ids).
const FAMILY: Record<string, RegExp> = {
  alimentacao: /^(food|coffee)/,
  fitness: /^gym/,
  saude: /^dental/,
  imoveis: /^(interior|home-)/,
  pet: /^(dog|pet-)/,
  moda: /^fashion/,
  servicos: /^(laptop|office|coffee)/,
}

// Text full of words that used to pull salon photos into any segment ("produto", "cliente", "horário", "equipe", "agenda"...).
const BAIT = [
  'Agende seu horário com a nossa equipe',
  'Depoimento de cliente satisfeito com o produto',
  'Presente especial para a mãe, voucher e kit',
  'Atendimento na semana: vaga aberta na agenda, whatsapp e direct',
  'Bastidores do espaço e da equipe',
  'Resultado: antes e depois, transformação',
]

test('fallback photo always belongs to the segment', () => {
  for (const [segment, family] of Object.entries(FAMILY)) {
    for (const text of BAIT) {
      // A clinic may use the salon "transformation" photos for before/after content; every other segment may not.
      if (segment === 'saude' && /antes e depois/.test(text)) continue
      for (const seed of [1, 2, 3, 50, 99, 1234]) {
        for (const order of [1, 2, 3, 4, 5, 6, 7, 8]) {
          const id = selectContextualPhotoId({ text, segment, order, seed })
          assert.match(id, family, `${segment}: "${text}" -> ${id}`)
        }
      }
    }
  }
})

test('fallback photos for a bakery are food, never skin/hair/products', () => {
  const used = new Set<string>()
  const ids = Array.from({ length: 6 }, (_, i) =>
    selectContextualPhotoId({ text: 'Pão de fermentação natural, fornada fresquinha, produto da casa para o cliente', segment: 'alimentacao', themeId: 'cafe', order: i + 1, seed: 11 + i, usedIds: used }),
  )
  for (const id of ids) assert.match(id, /^(food|coffee)/, id)
})

test('accented text matches the same keywords as plain text', () => {
  assert.equal(foldText('Padaria Pão Nosso, horário'), 'padaria pao nosso, horario')
  const a = selectContextualPhotoId({ text: 'Banho e tosa para o seu cão', segment: 'pet', order: 1, seed: 5 })
  assert.match(a, /^(dog|pet-)/)
})

test('editorial photo for a bakery is a bakery photo, and never leaves the segment', () => {
  const bakeryIds = new Set([
    'photo-1509440159596-0249088772ff',
    'photo-1608198093002-ad4e005484ec',
    'photo-1517433670267-08bbd4be890f',
    'photo-1549931319-a545dcf3bc73',
    'photo-1555507036-ab1f4038808a',
    'photo-1517433367423-c7e5b0f35086',
    'photo-1578985545062-69928b1d9587',
    'photo-1486427944299-d1955d23e34d',
  ])
  const used = new Set<string>()
  for (let order = 1; order <= 4; order++) {
    const id = selectEditorialPhotoId({ segment: 'alimentacao', headline: 'Pão quentinho todo dia', prompt: 'fresh baked artisan bread in a bakery', order, seed: 3, usedIds: used })
    assert.ok(bakeryIds.has(id), id)
  }
  // Salon topic pools are scoped to beauty: a restaurant asking for "cabelo" never gets them.
  const beauty = new Set([
    'photo-1560066984-138dadb4c035',
    'photo-1522337360788-8b13dee7a37e',
    'photo-1570172619644-dfd03ed5d881',
    'photo-1604654894610-df63bc536371',
  ])
  for (let order = 1; order <= 6; order++) {
    const id = selectEditorialPhotoId({ segment: 'alimentacao', headline: 'Cabelo, pele e unhas do cliente', order, seed: 9, usedIds: new Set() })
    assert.ok(!beauty.has(id), id)
  }
})

test('stock search query drops style filler and stops at the first clause', () => {
  assert.equal(stockQuery('gourmet artisan food photography on rustic wooden table, warm restaurant lighting', 'alimentacao'), 'artisan food rustic wooden')
  assert.equal(stockQuery('', 'alimentacao'), 'restaurant food')
  assert.equal(stockQuery('fresh baked artisan bread loaves on a rustic wooden counter in a bakery, warm morning light', 'alimentacao'), 'fresh baked artisan bread')
})
