import { api } from './api'
// Photo library & dynamic AI image URL resolver.
const files = import.meta.glob('../assets/photos/*.jpg', { eager: true, import: 'default' }) as Record<string, string>

export const PHOTOS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.jpg', ''), url]),
)

/** Focal point (object-position) per photo so tall/wide crops keep the subject. */
export const FOCUS: Record<string, string> = {
  'hair-portrait': '72% 35%',
  'hair-post': '62% 30%',
  'hair-tall': '50% 25%',
  'story-hair': '45% 30%',
  'hair-waves': '50% 50%',
  'hair-wash': '35% 50%',
  'story-wash': '50% 40%',
  'skin-tall': '40% 40%',
  'skin-post': '40% 40%',
  'skin-thumb': '50% 50%',
  'smile-tall': '45% 35%',
  'smile-thumb': '45% 40%',
  'story-smile': '50% 40%',
  transform: '70% 50%',
  beforeafter: '50% 50%',
  nails: '60% 50%',
  'nails-land': '60% 50%',
  products: '50% 60%',
  booking: '70% 40%',
  team: '50% 40%',
  gift: '50% 50%',
  gym: '78% 40%',
  food: '45% 55%',
  dental: '40% 40%',
  interior: '50% 60%',
  dog: '60% 40%',
  laptop: '55% 60%',
  coffee: '50% 40%',
  'laptop-story': '50% 50%',
}

const KEYWORD_PHOTOS: [RegExp, string[], string[]?][] = [
  [/unha|manicure|pedicure|esmalt|gel/i, ['nails', 'nails-land', 'products', 'smile-thumb'], ['beleza', 'moda']],
  [/pele|facial|limpeza|skincare|estetic|botox|peeling/i, ['skin-tall', 'skin-post', 'skin-thumb', 'smile-tall'], ['beleza', 'saude']],
  [/antes e depois|transforma|mudan|resultado/i, ['transform', 'beforeafter', 'hair-waves', 'smile-tall'], ['beleza', 'saude', 'fitness']],
  [/lavat|lavar|shampoo|couro cabeludo|massagem/i, ['hair-wash', 'story-wash', 'products', 'hair-waves'], ['beleza']],
  [/cabelo|capilar|hidrata|mecha|loiro|corte|escova|frizz/i, ['hair-waves', 'hair-portrait', 'hair-post', 'hair-tall', 'story-hair', 'hair-wash'], ['beleza']],
  [/produto|home care|kit|mascara|cosmetic/i, ['products', 'gift', 'hair-waves', 'skin-thumb']],
  [/depoimento|cliente|avaliac|opiniao/i, ['smile-tall', 'story-smile', 'smile-thumb', 'hair-portrait']],
  [/equipe|bastidor|espaco|salao|clinica/i, ['team', 'booking', 'interior', 'smile-tall']],
  [/agenda|horario|vaga|semana/i, ['booking', 'hair-portrait', 'smile-thumb', 'team']],
  [/presente|voucher|dia da|natal|mae|mulher|especial/i, ['gift', 'products', 'smile-tall', 'story-smile']],
  [/\bcafe\b|manha|padaria|bolo|confeitaria/i, ['coffee', 'food', 'products', 'interior'], ['alimentacao', 'servicos', 'outro']],
  [/comida|prato|almoco|jantar|restaurante|hamburguer|pizza|sabor|delivery/i, ['food', 'coffee', 'team', 'interior'], ['alimentacao']],
  [/treino|academia|muscula|fitness|funcional|aluno/i, ['gym', 'smile-tall', 'team', 'story-smile'], ['fitness', 'saude']],
  [/dente|sorriso|odonto|clareamento|consulta/i, ['dental', 'smile-tall', 'smile-thumb', 'team'], ['saude']],
  [/imovel|casa|apartamento|aluguel|financiamento|arquitetura/i, ['interior', 'laptop', 'booking', 'team'], ['imoveis', 'servicos', 'outro']],
  [/\bpet\b|cachorro|\bcão\b|\bgato\b|veterinar|banho e tosa/i, ['dog', 'smile-tall', 'team', 'gift'], ['pet']],
  [/gestao|consultoria|empresa|negocio|financa|marketing|produtividade|escritorio/i, ['laptop', 'laptop-story', 'coffee', 'booking', 'team'], ['servicos', 'imoveis', 'outro']],
  [/moda|roupa|look|vestido|blusa|colecao|estilo|loja/i, ['smile-tall', 'story-smile', 'products', 'gift', 'smile-thumb'], ['moda', 'beleza']],
]

const SEGMENT_POOLS: Record<string, string[]> = {
  beleza: ['hair-waves', 'skin-tall', 'nails', 'hair-portrait', 'products', 'transform', 'hair-wash', 'booking', 'team', 'smile-tall'],
  alimentacao: ['food', 'coffee', 'interior', 'team', 'products', 'gift'],
  fitness: ['gym', 'smile-tall', 'team', 'story-smile', 'booking'],
  saude: ['dental', 'skin-tall', 'smile-tall', 'team', 'booking'],
  imoveis: ['interior', 'laptop', 'booking', 'team', 'coffee'],
  pet: ['dog', 'smile-tall', 'team', 'gift', 'products'],
  servicos: ['laptop', 'laptop-story', 'coffee', 'team', 'booking', 'interior'],
  moda: ['smile-tall', 'story-smile', 'products', 'gift', 'smile-thumb'],
  outro: ['laptop', 'coffee', 'team', 'interior', 'booking', 'smile-tall'],
}

export function pickContextualPhoto(text: string, segment = 'beleza', order = 1, seed = 1): string {
  const matches: string[] = []
  for (const [re, list, segments] of KEYWORD_PHOTOS) {
    if (segments && !segments.includes(segment)) continue
    if (re.test(text)) matches.push(...list)
  }
  const uniqueMatches = Array.from(new Set(matches))
  if (uniqueMatches.length > 0) {
    return uniqueMatches[Math.abs(seed + order * 3) % uniqueMatches.length]
  }
  const pool = SEGMENT_POOLS[segment] || SEGMENT_POOLS.outro
  return pool[Math.abs(seed + order * 3) % pool.length]
}

export function photoUrl(id?: string) {
  if (!id) return undefined
  if (
    id.startsWith('data:') ||
    id.startsWith('blob:') ||
    id.startsWith('http://') ||
    id.startsWith('https://') ||
    id.startsWith('/api/')
  ) {
    return api(id)
  }
  return PHOTOS[id]
}

export function photoFocus(id?: string) {
  if (id && FOCUS[id]) return FOCUS[id]
  if (id && id.startsWith('/api/image')) {
    try {
      const q = new URLSearchParams(id.split('?')[1] || '')
      const fb = q.get('fallback')
      if (fb && FOCUS[fb]) return FOCUS[fb]
    } catch {
      // Ignore
    }
  }
  return '50% 40%'
}
