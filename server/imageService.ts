import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { DATA_DIR, PHOTOS_DIR } from './paths.ts'
import { generateAIImage } from './ai/image.ts'

const CACHE_DIR = path.join(DATA_DIR, 'image-cache')

try {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
} catch {
  // Ignore if read-only
}

/** Small LRU so memory stays bounded on a long-running server. */
const MEMORY_CACHE_MAX = 300
const memoryImageCache = new Map<string, { buffer: Buffer; mimeType: string }>()
function remember(key: string, entry: { buffer: Buffer; mimeType: string }) {
  memoryImageCache.delete(key)
  memoryImageCache.set(key, entry)
  while (memoryImageCache.size > MEMORY_CACHE_MAX) memoryImageCache.delete(memoryImageCache.keys().next().value!)
}

export interface ImageGenOptions {
  prompt?: string
  headline?: string
  sub?: string
  segment?: string
  themeId?: string
  customTheme?: string
  topics?: string
  imageType?: 'fotos' | 'ilustracoes' | 'render' | 'misto'
  style?: string
  kind?: 'post' | 'story'
  order?: number
  seed?: number
  dark?: string
  mid?: string
  accent?: string
  light?: string
  fallback?: string
  forceAi?: boolean
}

/**
 * Catálogo curado de fotografias editoriais em alta resolução (1080p) da CDN global do Unsplash,
 * organizado por micro-temas e segmentos. Carrega em ~150ms via backend (same-origin, sem CORS)
 * e garante que cada post (1 a 4), story (1 a 4) e versão (V1, V2, V3...) tenha uma foto inédita.
 */
const UNSPLASH_TOPIC_POOLS: { keywords: RegExp; segments?: string[]; ids: string[] }[] = [
  {
    keywords: /cabelo|capilar|hidrata|mecha|loiro|morena|corte|escova|cronograma|frizz|nutri|reconstru|fio|lavat|shampoo/i,
    segments: ['beleza'],
    ids: [
      'photo-1560066984-138dadb4c035', // Luxury hair salon styling
      'photo-1522337360788-8b13dee7a37e', // Woman with healthy glossy hair
      'photo-1580618672591-eb180b1a973f', // Hairstylist working on hair
      'photo-1519699047748-de8e457a634e', // Radiant wavy hair portrait
      'photo-1595476108010-b4d1f102b1b1', // Salon hair treatment & blowdry
      'photo-1562322140-8baeececf3df', // Hairdresser styling client hair
      'photo-1605497788044-5a32c7078486', // Modern hair salon chair & mirror
      'photo-1527799820374-dcf8d9d4a388', // Long shiny healthy hair close-up
      'photo-1516975080664-ed2fc6a32937', // Hair care products and tools
      'photo-1633681926022-84c23e8cb2d6', // Luxury salon wash & spa
    ],
  },
  {
    keywords: /pele|facial|limpeza|skincare|cravo|poro|rejuvenesc|botox|peeling|harmoniza|estetic/i,
    segments: ['beleza', 'saude'],
    ids: [
      'photo-1570172619644-dfd03ed5d881', // Facial skincare treatment in spa
      'photo-1512290900672-1f84d171c6f2', // Glowing facial skin portrait
      'photo-1616394584738-fc6e612e71b9', // Aesthetician facial care
      'photo-1552693673-1bf958298935', // Skincare serum dropper application
      'photo-1540555700478-4be289fbecef', // Luxury spa wellness atmosphere
      'photo-1598440947619-2c35fc9aa908', // Clean luxury skincare products
      'photo-1507652313519-d4e9174996dd', // Relaxing spa treatment cabin
      'photo-1608248597359-0e6d526a6c58', // Woman applying facial moisturizer
    ],
  },
  {
    keywords: /unha|manicure|pedicure|esmalt|cutilagem|gel|fibra/i,
    segments: ['beleza', 'moda'],
    ids: [
      'photo-1604654894610-df63bc536371', // Elegant manicure nail art
      'photo-1632345031435-8727f6897d53', // Nail salon manicure session
      'photo-1519014816548-bf5fe059798b', // Pastel nail polish manicure
      'photo-1522337094846-8a818192de1f', // Woman hands luxury manicure
    ],
  },
  {
    keywords: /produto|home care|kit|mascara|oleo|leave-in|cosmetic|serum/i,
    segments: ['beleza', 'moda', 'saude'],
    ids: [
      'photo-1608248543803-ba4f8c70ae0b', // Luxury cosmetic serum bottles
      'photo-1556228720-195a672e8a03', // Minimalist skincare & haircare bottles
      'photo-1571781926291-c477ebfd024b', // Botanical beauty products on stone
      'photo-1596462502278-27bfdc403348', // Makeup and beauty essentials
      'photo-1620916566398-39f1143ab7be', // Dropper bottle cosmetic studio shot
    ],
  },
]

const UNSPLASH_SEGMENT_POOLS: Record<string, string[]> = {
  beleza: [
    'photo-1560066984-138dadb4c035',
    'photo-1522337360788-8b13dee7a37e',
    'photo-1570172619644-dfd03ed5d881',
    'photo-1580618672591-eb180b1a973f',
    'photo-1519699047748-de8e457a634e',
    'photo-1595476108010-b4d1f102b1b1',
    'photo-1562322140-8baeececf3df',
    'photo-1604654894610-df63bc536371',
    'photo-1608248543803-ba4f8c70ae0b',
    'photo-1540555700478-4be289fbecef',
    'photo-1527799820374-dcf8d9d4a388',
    'photo-1616394584738-fc6e612e71b9',
  ],
  alimentacao: [
    'photo-1504674900247-0877df9cc836',
    'photo-1555396273-367ea4eb4db5',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1495474472287-4d71bcdd2085',
    'photo-1546069901-ba9599a7e63c',
    'photo-1517248135467-4c7edcad34c4',
    'photo-1559339352-11d035aa65de',
    'photo-1509440159596-0249088772ff',
  ],
  fitness: [
    'photo-1534438327276-14e5300c3a48',
    'photo-1517836357463-d25dfeac3438',
    'photo-1571019614242-c5c5dee9f50b',
    'photo-1581009146145-b5ef050c2e1e',
    'photo-1518611012118-696072aa579a',
    'photo-1540497077202-7c8a3999166f',
  ],
  saude: [
    'photo-1629909613654-28e377c37b09',
    'photo-1588776814546-1ffcf47267a5',
    'photo-1579684385127-1ef15d508118',
    'photo-1606811841689-23dfddce3e95',
    'photo-1559839734-2b71ea197ec2',
    'photo-1519494026892-80bbd2d6fd0d',
  ],
  imoveis: [
    'photo-1600596542815-ffad4c1539a9',
    'photo-1600585154340-be6161a56a0c',
    'photo-1600607687939-ce8a6c25118c',
    'photo-1512917774080-9991f1c4c750',
    'photo-1600566753376-12c8ab7fb75b',
    'photo-1560448204-e02f11c3d0e2',
  ],
  pet: [
    'photo-1543466835-00a7907e9de1',
    'photo-1514888286974-6c03e2ca1dba',
    'photo-1583511655857-d19b40a7a54e',
    'photo-1516734212186-a967f81ad0d7',
    'photo-1537151608828-ea2b11777ee8',
    'photo-1548199973-03cce0bbc87b',
  ],
  servicos: [
    'photo-1497366216548-37526070297c',
    'photo-1522071820081-009f0129c71c',
    'photo-1460925895917-afdab827c52f',
    'photo-1556761175-5973dc0f32e7',
    'photo-1507679799987-c73779587ccf',
    'photo-1553877522-43269d4ea984',
  ],
  moda: [
    'photo-1490481651871-ab68de25d43d',
    'photo-1441986300917-64674bd600d8',
    'photo-1483985988355-763728e1935b',
    'photo-1469334031218-e382a71b716b',
    'photo-1515886657613-9f3515b0c78f',
    'photo-1445205170230-053b83016050',
  ],
  outro: [
    'photo-1497366216548-37526070297c',
    'photo-1522071820081-009f0129c71c',
    'photo-1556761175-5973dc0f32e7',
    'photo-1495474472287-4d71bcdd2085',
    'photo-1600585154340-be6161a56a0c',
    'photo-1560066984-138dadb4c035',
  ],
}

/**
 * Mapeamento semântico das fotos locais embutidas (usadas como fallback instantâneo no cliente).
 */
const KEYWORD_PHOTO_MAP: { keywords: RegExp; photos: string[]; segments?: string[] }[] = [
  { keywords: /unha|manicure|pedicure|esmalt|cutilagem|gel|fibra/i, photos: ['nails', 'nails-land', 'products', 'smile-thumb'], segments: ['beleza', 'moda'] },
  { keywords: /pele|facial|limpeza|skincare|cravo|poro|rejuvenesc|botox|peeling|harmoniza|estetic/i, photos: ['skin-tall', 'skin-post', 'skin-thumb', 'smile-tall'], segments: ['beleza', 'saude'] },
  { keywords: /antes e depois|transforma|mudan|evolu|resultado real/i, photos: ['transform', 'beforeafter', 'hair-waves', 'smile-tall'], segments: ['beleza', 'saude', 'fitness'] },
  { keywords: /lavat|lavar|shampoo|agua morna|couro cabeludo|massagem capilar|banho de brilho/i, photos: ['hair-wash', 'story-wash', 'products', 'hair-waves'], segments: ['beleza'] },
  { keywords: /cabelo|capilar|hidrata|mecha|loiro|morena|corte|escova|cronograma|frizz|nutri|reconstru|fio/i, photos: ['hair-waves', 'hair-wash', 'hair-post', 'story-hair', 'hair-portrait', 'hair-tall'], segments: ['beleza'] },
  { keywords: /produto|home care|kit|mascara|oleo|leave-in|cosmetic/i, photos: ['products', 'gift', 'hair-waves', 'skin-thumb'] },
  { keywords: /depoimento|cliente|avaliac|opiniao|elogio|estrelas|confia/i, photos: ['smile-tall', 'story-smile', 'smile-thumb', 'hair-portrait'] },
  { keywords: /equipe|bastidor|espaco|salao|clinica|profissiona|atendimento|rotina/i, photos: ['team', 'booking', 'interior', 'smile-tall'] },
  { keywords: /agenda|horario|vaga|semana|marcar|whatsapp|direct/i, photos: ['booking', 'hair-waves', 'smile-thumb', 'team'] },
  { keywords: /presente|voucher|dia da|natal|mae|mulher|namorad|especial|mimo/i, photos: ['gift', 'products', 'smile-tall', 'story-smile'] },
  { keywords: /\bcafe\b|manha|expresso|padaria|bolo|confeitaria|\bcha\b|brunch/i, photos: ['coffee', 'food', 'products', 'interior'], segments: ['alimentacao', 'servicos', 'outro'] },
  { keywords: /comida|prato|almoco|jantar|restaurante|hamburguer|pizza|gastronomia|sabor|delivery|cardapio|chefe/i, photos: ['food', 'coffee', 'team', 'interior'], segments: ['alimentacao'] },
  { keywords: /treino|academia|muscula|fitness|funcional|saude fisica|energia|aluno|peso|esporte|corrida/i, photos: ['gym', 'smile-tall', 'team', 'story-smile'], segments: ['fitness', 'saude'] },
  { keywords: /dente|sorriso|odonto|clareamento|ortodontia|implante|lente|consulta|boca|fio dental/i, photos: ['dental', 'smile-tall', 'smile-thumb', 'team'], segments: ['saude'] },
  { keywords: /imovel|casa|apartamento|morar|aluguel|financiamento|corretor|arquitetura|decorac|sala|quarto/i, photos: ['interior', 'laptop', 'booking', 'team'], segments: ['imoveis', 'servicos', 'outro'] },
  { keywords: /\bpet\b|cachorro|\bcão\b|\bgato\b|veterinar|banho e tosa|\bração\b|filhote|tutor/i, photos: ['dog', 'smile-tall', 'team', 'gift'], segments: ['pet'] },
  { keywords: /gestao|consultoria|empresa|negocio|financa|marketing|produtividade|ferramenta|escritorio|lucro|vendas|mei|contabil/i, photos: ['laptop', 'laptop-story', 'coffee', 'booking', 'team'], segments: ['servicos', 'imoveis', 'outro'] },
  { keywords: /moda|roupa|look|vestido|blusa|colecao|estilo|loja|tendenc|acessorio|vitrine/i, photos: ['smile-tall', 'story-smile', 'products', 'gift', 'smile-thumb'], segments: ['moda', 'beleza'] },
]

const SEGMENT_DEFAULT_POOL: Record<string, string[]> = {
  beleza: ['hair-waves', 'skin-tall', 'nails', 'hair-wash', 'products', 'transform', 'hair-post', 'booking', 'team', 'smile-tall'],
  alimentacao: ['food', 'coffee', 'interior', 'team', 'products', 'gift'],
  fitness: ['gym', 'smile-tall', 'team', 'story-smile', 'booking'],
  saude: ['dental', 'skin-tall', 'smile-tall', 'team', 'booking'],
  imoveis: ['interior', 'laptop', 'booking', 'team', 'coffee'],
  pet: ['dog', 'smile-tall', 'team', 'gift', 'products'],
  servicos: ['laptop', 'laptop-story', 'coffee', 'team', 'booking', 'interior'],
  moda: ['smile-tall', 'story-smile', 'products', 'gift', 'smile-thumb'],
  outro: ['laptop', 'coffee', 'team', 'interior', 'booking', 'smile-tall'],
}

/**
 * Seleciona uma foto local diferente para cada item do pacote com base na semântica do texto e na seed.
 */
export function selectContextualPhotoId(opts: {
  text: string
  segment: string
  themeId?: string
  order: number
  seed: number
  usedIds?: Set<string>
}): string {
  const { text, segment, themeId, order, seed, usedIds } = opts
  const searchStr = `${themeId || ''} ${text}`.toLowerCase()

  let matched: string[] = []
  for (const entry of KEYWORD_PHOTO_MAP) {
    if (entry.segments && !entry.segments.includes(segment)) continue
    if (entry.keywords.test(searchStr)) {
      matched.push(...entry.photos)
    }
  }
  matched = Array.from(new Set(matched))
  const availMatched = usedIds ? matched.filter((id) => !usedIds.has(id)) : matched
  if (availMatched.length > 0) {
    const chosen = availMatched[Math.abs(seed + order * 3) % availMatched.length]
    if (usedIds) usedIds.add(chosen)
    return chosen
  }

  const segPool = SEGMENT_DEFAULT_POOL[segment] || SEGMENT_DEFAULT_POOL.outro
  const candidates = Array.from(new Set([...matched, ...segPool]))

  const available = usedIds ? candidates.filter((id) => !usedIds.has(id)) : candidates
  const pool = available.length > 0 ? available : candidates
  const idx = Math.abs(seed + order * 3) % pool.length
  const chosen = pool[idx]
  if (usedIds) usedIds.add(chosen)
  return chosen
}

const SEGMENT_EN_CONTEXT: Record<string, string> = {
  beleza: 'luxury beauty salon, haircare and aesthetics studio, warm lighting, wellness spa atmosphere',
  alimentacao: 'gourmet restaurant and artisan cafe, appetizing fresh food photography, warm rustic table setting',
  fitness: 'modern boutique fitness gym, dynamic athletic workout environment, energetic studio lighting',
  saude: 'modern clean healthcare and dental clinic, bright reassuring medical aesthetics, natural daylight',
  imoveis: 'luxury contemporary interior design architecture, bright living room, warm sunlight, real estate photography',
  pet: 'happy adorable dog and cat in a clean modern pet care studio, warm friendly lighting',
  servicos: 'modern creative business office workspace, entrepreneur desk with coffee and laptop, warm natural light',
  moda: 'high-fashion boutique retail editorial, stylish contemporary clothing and accessories, soft studio light',
  outro: 'modern professional small business studio, clean inviting workspace, warm editorial lighting',
}

export function buildDetailedImagePrompt(opts: ImageGenOptions): string {
  const segContext = SEGMENT_EN_CONTEXT[opts.segment || 'beleza'] || SEGMENT_EN_CONTEXT.outro
  const baseSubject = opts.prompt?.trim()
    ? opts.prompt.trim()
    : `${opts.customTheme || opts.themeId || opts.topics || 'professional service'}, inspired by "${opts.headline || 'quality experience'}" in the context of ${segContext}`

  const effectiveType =
    opts.imageType === 'misto'
      ? (opts.order || 1) % 2 === 1
        ? 'fotos'
        : 'render'
      : opts.imageType || 'fotos'

  if (effectiveType === 'ilustracoes') {
    return `${baseSubject}. Style: Modern flat editorial vector illustration, contemporary minimalist graphic art, clean geometric shapes, smooth gradients, palette with ${opts.dark || '#111'} and ${opts.accent || '#12B386'}, Behance editorial illustration, no text, no letters, no words, no watermark.`
  }

  if (effectiveType === 'render') {
    return `${baseSubject}. Style: 3D studio render, Cinema4D Octane render aesthetic, soft global illumination, tactile luxury materials, glass and matte clay textures, minimalist podium composition, studio lighting, no text, no letters, no words, no watermark.`
  }

  return `${baseSubject}. Style: High-end editorial commercial photography for Instagram (${opts.style || 'modern'} aesthetic), natural studio lighting, shallow depth of field, 85mm lens, rich authentic colors, photorealistic 8k, no text, no letters, no words, no watermark.`
}

/**
 * Constrói a URL `/api/image?...` que o frontend usa nos componentes `<Creative />`.
 */
export function buildApiImageUrl(opts: ImageGenOptions): string {
  const params = new URLSearchParams()
  const fullPrompt = buildDetailedImagePrompt(opts)
  params.set('prompt', fullPrompt.slice(0, 320))
  if (opts.headline) params.set('headline', opts.headline.slice(0, 80))
  if (opts.segment) params.set('segment', opts.segment)
  if (opts.themeId) params.set('theme', opts.themeId)
  if (opts.imageType) params.set('type', opts.imageType)
  if (opts.style) params.set('style', opts.style)
  if (opts.kind) params.set('kind', opts.kind)
  if (opts.order) params.set('order', String(opts.order))
  if (opts.seed) params.set('seed', String(opts.seed))
  if (opts.dark) params.set('dark', opts.dark)
  if (opts.mid) params.set('mid', opts.mid)
  if (opts.accent) params.set('accent', opts.accent)
  if (opts.light) params.set('light', opts.light)
  if (opts.fallback) params.set('fallback', opts.fallback)
  if (opts.forceAi) params.set('ai', '1')
  return `/api/image?${params.toString()}`
}

/**
 * Seleciona e baixa em ~150ms uma fotografia editorial HD (1080p) da CDN do Unsplash
 * coerente com o assunto do post e garante que cada card receba uma imagem distinta.
 */
async function fetchCuratedEditorialPhoto(opts: ImageGenOptions): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const segment = opts.segment || 'beleza'
  const searchStr = `${opts.themeId || ''} ${opts.customTheme || ''} ${opts.headline || ''} ${opts.prompt || ''}`.toLowerCase()
  const order = opts.order || 1
  const seed = opts.seed || 1

  let pool: string[] = []
  for (const entry of UNSPLASH_TOPIC_POOLS) {
    if (entry.segments && !entry.segments.includes(segment)) continue
    if (entry.keywords.test(searchStr)) {
      pool.push(...entry.ids)
    }
  }
  const segIds = UNSPLASH_SEGMENT_POOLS[segment] || UNSPLASH_SEGMENT_POOLS.outro
  pool = Array.from(new Set([...pool, ...segIds]))

  // Deslocamento determinístico por order (1..8) + seed da versão para que os 4 posts e 4 stories nunca repitam a mesma foto
  const baseIdx = Math.abs(seed * 7 + order * 3) % pool.length
  const candidates = [pool[baseIdx], pool[(baseIdx + 1) % pool.length]]

  const w = 1080
  const h = opts.kind === 'story' ? 1440 : 1080

  for (const photoId of candidates) {
    const url = `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${w}&h=${h}&q=82`
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3200)
      const res = await fetch(url, {
        headers: {
          Accept: 'image/jpeg,image/webp,image/*',
          'User-Agent': 'MIDFLOW-Studio/2.5',
        },
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.ok) {
        const contentType = res.headers.get('content-type') || 'image/jpeg'
        if (contentType.startsWith('image/')) {
          const arr = await res.arrayBuffer()
          const buffer = Buffer.from(arr)
          if (buffer.length > 5000) {
            return { buffer, mimeType: contentType }
          }
        }
      }
    } catch {
      // Tenta próximo candidato
    }
  }

  return null
}

/**
 * Tenta gerar imagem usando Google Gemini Image caso haja uma chave válida ativa.
 */

/**
 * Gera uma arte editorial SVG de alta resolução (1080x1080) para os modos
 * "Ilustrações" e "Render/IA" (ou como compositor offline dinâmico),
 * aplicando enquadramento, iluminação e paleta exclusivos por `seed` e `order`.
 */
function buildStudioProceduralArtwork(opts: ImageGenOptions, fallbackPhotoId: string): { buffer: Buffer; mimeType: string } {
  const effectiveType =
    opts.imageType === 'misto'
      ? (opts.order || 1) % 2 === 1
        ? 'fotos'
        : 'render'
      : opts.imageType || 'fotos'

  const photoPath = path.join(PHOTOS_DIR, `${fallbackPhotoId}.jpg`)
  const hasPhotoFile = fs.existsSync(photoPath)

  const dark = opts.dark || '#4A1228'
  const mid = opts.mid || '#7B2346'
  const accent = opts.accent || '#E8A5B8'
  const light = opts.light || '#FDF6F8'
  const seed = opts.seed || 42
  const order = opts.order || 1

  const photoBase64 = hasPhotoFile ? fs.readFileSync(photoPath).toString('base64') : ''

  // Coordenadas pseudo-aleatórias determinísticas baseadas na seed e ordem
  const cx1 = 220 + ((seed * 37 + order * 113) % 640)
  const cy1 = 180 + ((seed * 53 + order * 89) % 520)
  const cx2 = 780 - ((seed * 29 + order * 97) % 540)
  const cy2 = 720 - ((seed * 41 + order * 71) % 460)
  const rot = ((seed + order * 19) % 28) - 14

  // Se for modo "fotos" em ambiente 100% offline, cria um enquadramento editorial com iluminação de estúdio
  if (effectiveType === 'fotos' && photoBase64) {
    const scale = 1.08 + ((seed + order * 7) % 18) * 0.01
    const tx = -(((seed * 13 + order * 29) % 80) - 40)
    const ty = -(((seed * 17 + order * 23) % 60) - 30)
    const svgFoto = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <defs>
    <radialGradient id="studioGlow" cx="${25 + (order * 18) % 60}%" cy="${20 + (order * 15) % 50}%" r="65%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.32" />
      <stop offset="60%" stop-color="${mid}" stop-opacity="0.12" />
      <stop offset="100%" stop-color="${dark}" stop-opacity="0.38" />
    </radialGradient>
  </defs>
  <rect width="1080" height="1080" fill="${dark}" />
  <g transform="translate(540 540) scale(${scale.toFixed(2)}) translate(${-540 + tx} ${-540 + ty})">
    <image href="data:image/jpeg;base64,${photoBase64}" x="0" y="0" width="1080" height="1080" preserveAspectRatio="xMidYMid slice" />
  </g>
  <rect width="1080" height="1080" fill="url(#studioGlow)" />
</svg>`
    return {
      buffer: Buffer.from(svgFoto, 'utf-8'),
      mimeType: 'image/svg+xml',
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${dark}" />
      <stop offset="52%" stop-color="${mid}" />
      <stop offset="100%" stop-color="${accent}" />
    </linearGradient>
    <radialGradient id="orb1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${light}" stop-opacity="0.75" />
      <stop offset="55%" stop-color="${accent}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="${dark}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="orb2" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9" />
      <stop offset="40%" stop-color="${mid}" stop-opacity="0.7" />
      <stop offset="100%" stop-color="${dark}" stop-opacity="0.95" />
    </radialGradient>
    <linearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.38" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.08" />
    </linearGradient>
    <clipPath id="cardClip">
      <rect x="190" y="120" width="700" height="700" rx="${effectiveType === 'ilustracoes' ? 350 : 72}" transform="rotate(${rot} 540 470)" />
    </clipPath>
  </defs>

  <rect width="1080" height="1080" fill="url(#bgGrad)" />
  <circle cx="${cx1}" cy="${cy1}" r="420" fill="url(#orb1)" />
  <circle cx="${cx2}" cy="${cy2}" r="360" fill="url(#orb1)" />

  <g stroke="${light}" stroke-opacity="0.16" stroke-width="2" fill="none">
    <circle cx="540" cy="470" r="430" />
    <circle cx="540" cy="470" r="330" stroke-dasharray="12 12" />
    <path d="M -50 ${360 + order * 40} Q 320 ${200 - order * 20}, 580 460 T 1130 320" stroke-width="3" />
    <path d="M -50 ${600 - order * 30} Q 420 ${760 + order * 20}, 680 500 T 1130 620" stroke-width="2" />
  </g>

  ${
    photoBase64
      ? `<g clip-path="url(#cardClip)">
    <image href="data:image/jpeg;base64,${photoBase64}" x="140" y="70" width="800" height="800" preserveAspectRatio="xMidYMid slice" opacity="${effectiveType === 'ilustracoes' ? '0.84' : '0.92'}" />
    <rect x="140" y="70" width="800" height="800" fill="${mid}" fill-opacity="${effectiveType === 'ilustracoes' ? '0.26' : '0.12'}" />
  </g>`
      : ''
  }

  <rect x="190" y="120" width="700" height="700" rx="${effectiveType === 'ilustracoes' ? 350 : 72}" transform="rotate(${rot} 540 470)" fill="none" stroke="url(#glass)" stroke-width="14" />
  <circle cx="${230 + order * 45}" cy="${190 + order * 25}" r="74" fill="url(#orb2)" />
  <circle cx="${820 - order * 35}" cy="${710 - order * 25}" r="92" fill="url(#orb2)" />
  <circle cx="790" cy="210" r="36" fill="${light}" fill-opacity="0.85" />
</svg>`

  return {
    buffer: Buffer.from(svg, 'utf-8'),
    mimeType: 'image/svg+xml',
  }
}

/**
 * Resolve uma imagem em alta resolução para `GET /api/image`:
 * 1. Verifica cache em memória e em disco (`server/data/image-cache`)
 * 2. Se `forceAi` estiver ativo (botão "Gerar nova imagem IA"), tenta a IA de imagem configurada (Cloudflare Workers AI ou Gemini)
 * 3. Para `fotos` (ou metade fotográfica de `misto`), baixa em ~150ms uma foto editorial 1080p inédita do catálogo curado Unsplash CDN
 * 4. Para `ilustracoes` e `render` (ou se offline), compõe arte Studio SVG/3D exclusiva por `seed` e `order`
 */
export async function resolveContextualImage(opts: ImageGenOptions): Promise<{ buffer: Buffer; mimeType: string; source: string }> {
  const fullPrompt = buildDetailedImagePrompt(opts)
  const effectiveType =
    opts.imageType === 'misto'
      ? (opts.order || 1) % 2 === 1
        ? 'fotos'
        : 'render'
      : opts.imageType || 'fotos'

  const cacheKey = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        p: fullPrompt,
        t: effectiveType,
        s: opts.seed || 1,
        o: opts.order || 1,
        d: opts.dark,
        a: opts.accent,
        ai: opts.forceAi ? 1 : 0,
      }),
    )
    .digest('hex')
    .slice(0, 24)

  // 1. Verifica cache em memória
  const mem = memoryImageCache.get(cacheKey)
  if (mem) {
    return { ...mem, source: 'memory-cache' }
  }

  // 2. Verifica cache em disco
  const jpgCachePath = path.join(CACHE_DIR, `${cacheKey}.jpg`)
  const pngCachePath = path.join(CACHE_DIR, `${cacheKey}.png`)
  if (fs.existsSync(jpgCachePath)) {
    const buffer = fs.readFileSync(jpgCachePath)
    const entry = { buffer, mimeType: 'image/jpeg' }
    remember(cacheKey, entry)
    return { ...entry, source: 'disk-cache' }
  }
  if (fs.existsSync(pngCachePath)) {
    const buffer = fs.readFileSync(pngCachePath)
    const entry = { buffer, mimeType: 'image/png' }
    remember(cacheKey, entry)
    return { ...entry, source: 'disk-cache' }
  }

  // 3. Se solicitado via "Estúdio Visual IA" / "Gerar nova imagem IA" (forceAi), tenta motores generativos primeiro
  if (opts.forceAi) {
    const aiImg = await generateAIImage(fullPrompt, opts.kind)
    if (aiImg) {
      const entry = { buffer: aiImg.buffer, mimeType: aiImg.mimeType }
      try {
        const ext = aiImg.mimeType.includes('png') ? 'png' : 'jpg'
        fs.writeFileSync(path.join(CACHE_DIR, `${cacheKey}.${ext}`), aiImg.buffer)
      } catch {
        // Ignore
      }
      remember(cacheKey, entry)
      return { ...entry, source: aiImg.source }
    }
  }

  // 4. Para o modo "fotos", busca fotografia editorial HD 1080p na CDN curada do Unsplash (~150ms, zero travamento!)
  if (effectiveType === 'fotos') {
    const editorialPhoto = await fetchCuratedEditorialPhoto(opts)
    if (editorialPhoto) {
      try {
        fs.writeFileSync(jpgCachePath, editorialPhoto.buffer)
      } catch {
        // Ignore
      }
      remember(cacheKey, editorialPhoto)
      return { ...editorialPhoto, source: 'editorial-hd' }
    }
  }

  // 5. Para "ilustracoes", "render" ou fallback offline, compõe arte vetorial/3D em alta definição
  const fallbackPhotoId =
    opts.fallback ||
    selectContextualPhotoId({
      text: `${opts.headline || ''} ${opts.sub || ''} ${opts.prompt || ''} ${opts.customTheme || ''} ${opts.topics || ''}`,
      segment: opts.segment || 'beleza',
      themeId: opts.themeId,
      order: opts.order || 1,
      seed: opts.seed || 1,
    })

  const studioArt = buildStudioProceduralArtwork(opts, fallbackPhotoId)
  remember(cacheKey, studioArt)
  return { ...studioArt, source: 'contextual-studio' }
}
