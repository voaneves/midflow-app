import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer, type ViteDevServer } from 'vite'
import { themeLabelOf, THEME_LABELS_MAP } from '../aiService.ts'

/*
 * The client modules (src/lib) use extensionless imports and import.meta.glob, so node cannot load them directly.
 * They are loaded through Vite's SSR loader, the same transform the app uses.
 */
let vite: ViteDevServer
let rewriteCopyLocally: (c: any, mode: string, brand?: string, seed?: number, segment?: string) => Promise<Record<string, any>>
let customThemeDef: (seg: any, text: string) => any
let segmentDef: (id: string) => any

before(async () => {
  vite = await createServer({ configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } })
  ;({ rewriteCopyLocally } = await vite.ssrLoadModule('/src/lib/aiService.ts'))
  ;({ customThemeDef } = await vite.ssrLoadModule('/src/lib/generator.ts'))
  ;({ segmentDef } = await vite.ssrLoadModule('/src/lib/data.ts'))
})

after(async () => {
  await vite?.close()
})

/** Salon vocabulary that must not reach a food business. */
const SALON = /agendar seu hor[aá]rio|garanta seu hor[aá]rio|protocolo|reservar meu hor[aá]rio|sal[aã]o/i

const creative = {
  id: 'post_1',
  kind: 'post' as const,
  order: 1,
  themeId: 'prato',
  variant: 'photo' as const,
  tag: 'Cardápio',
  headline: 'Hambúrguer artesanal da casa.',
  highlight: 'da casa.',
  cta: 'Peça já',
  photo: 'food',
  caption: 'Legenda original',
  hashtags: ['#Burger', '#Fome'],
}

const MODES = ['vendedor', 'curto', 'sofisticado', 'descontraido', 'educativo'] as const

const flat = (o: Record<string, unknown>) => Object.values(o).flat().filter((v) => typeof v === 'string').join('\n')

test('client generator: custom-theme copy for alimentacao has no salon wording', () => {
  for (const text of ['Combo de domingo', 'Pão de fermentação natural e bolos']) {
    const theme = customThemeDef(segmentDef('alimentacao'), text)
    const all = [theme.story.cta, theme.story.ctaSub, ...theme.posts.flatMap((p: any) => [p.headline, p.sub, ...(p.bullets ?? []), ...(p.icons ?? []).map((i: any) => i.label)])].join('\n')
    assert.equal(all.match(SALON), null, `"${all.match(SALON)?.[0]}" em "${text}"`)
  }
  assert.equal(customThemeDef(segmentDef('alimentacao'), 'Combo de domingo').story.cta, 'Quer provar? Faça seu pedido.')
})

test('client generator: every segment gets its own story CTA, beleza keeps the original', () => {
  const ctas = new Map<string, string>()
  for (const id of ['beleza', 'alimentacao', 'fitness', 'saude', 'imoveis', 'pet', 'servicos', 'moda', 'outro'] as const) {
    ctas.set(id, customThemeDef(segmentDef(id), 'Novidade da semana').story.cta)
  }
  assert.equal(ctas.get('beleza'), 'Quer saber mais e agendar seu horário?')
  assert.equal(ctas.get('servicos'), 'Quer conversar? Agende uma conversa.')
  assert.equal(ctas.get('outro'), 'Quer saber mais? Fale com a gente.')
  for (const [id, cta] of ctas) if (id !== 'beleza') assert.doesNotMatch(cta, /agendar seu hor[aá]rio/i, id)
})

test('client rewriteCopyLocally: alimentacao has no salon wording in any mode or seed', async () => {
  for (const mode of MODES) {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const brand of ['Cantina do Zé', 'Padaria Pão Nosso']) {
        const out = await rewriteCopyLocally(creative, mode, brand, seed, 'alimentacao')
        const text = flat(out)
        assert.equal(text.match(SALON), null, `"${text.match(SALON)?.[0]}" (${mode}, seed ${seed}, ${brand})`)
        assert.ok(out.cta && out.headline && out.caption, `${mode}: campos vazios`)
      }
    }
  }
})

test('client rewriteCopyLocally: beleza keeps the salon wording, unknown segment is neutral', async () => {
  const beleza = await rewriteCopyLocally(creative, 'vendedor', 'Studio Aurora', 3, 'beleza')
  assert.equal(beleza.cta, 'Reservar meu horário')
  assert.match(beleza.headline, /garanta seu horário/i)
  assert.match((await rewriteCopyLocally(creative, 'sofisticado', 'Studio Aurora', 1, 'beleza')).sub ?? '', /Protocolos personalizados/)
  for (const segment of [undefined, 'outro', 'desconhecido']) {
    for (const mode of MODES) assert.equal(flat(await rewriteCopyLocally(creative, mode, 'Acme', 2, segment)).match(SALON), null, `${segment}/${mode}`)
  }
})

test('server theme labels are keyed by segment: shared ids do not leak across segments', () => {
  assert.match(themeLabelOf('alimentacao', 'bastidores') ?? '', /Preparo Artesanal/)
  for (const seg of ['moda', 'fitness', 'imoveis', 'pet', 'servicos']) {
    const label = themeLabelOf(seg, 'bastidores') ?? ''
    assert.ok(label, `${seg}: sem rótulo`)
    assert.doesNotMatch(label, /Preparo Artesanal/, seg)
  }
  assert.match(themeLabelOf('moda', 'bastidores') ?? '', /Bastidores/)
  assert.equal(themeLabelOf('segmento-novo', 'bastidores'), 'Nos Bastidores')
  assert.equal(themeLabelOf(undefined, 'bastidores'), 'Nos Bastidores')
  assert.equal(themeLabelOf('moda', 'id-inexistente'), undefined)
  // The segment-blind map (still used by server/ai/pipeline.ts) is neutral for shared ids.
  assert.doesNotMatch(THEME_LABELS_MAP.bastidores, /Preparo Artesanal/)
})
