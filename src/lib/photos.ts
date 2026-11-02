import { api } from './api'
// Photo library & dynamic AI image URL resolver.
const files = import.meta.glob('../assets/photos/*.jpg', { eager: true, import: 'default' }) as Record<string, string>

export const PHOTOS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.jpg', ''), url]),
)

/**
 * Focal point (object-position) per photo when the subject is off-centre. The example library
 * (server/tools/generate-example-photos.ts) is square with centred subjects, so the default works.
 */
export const FOCUS: Record<string, string> = {}

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
  [/\bcafe\b|manha|padaria|bolo|confeitaria/i, ['coffee', 'food-dessert', 'food-table', 'food-kitchen'], ['alimentacao', 'servicos', 'outro']],
  [/comida|prato|almoco|jantar|restaurante|hamburguer|pizza|sabor|delivery/i, ['food', 'food-burger', 'food-kitchen', 'food-table', 'food-delivery'], ['alimentacao']],
  [/treino|academia|muscula|fitness|funcional|aluno/i, ['gym-training', 'gym-coach', 'gym-functional', 'gym-results', 'gym'], ['fitness', 'saude']],
  [/dente|sorriso|odonto|clareamento|consulta/i, ['dental-smile', 'dental', 'dental-consult', 'dental-care', 'dental-tech'], ['saude']],
  [/imovel|casa|apartamento|aluguel|financiamento|arquitetura/i, ['interior', 'home-keys', 'home-kitchen', 'home-facade', 'home-building', 'home-agent'], ['imoveis', 'servicos', 'outro']],
  [/\bpet\b|cachorro|\bcão\b|\bgato\b|veterinar|banho e tosa/i, ['dog', 'pet-grooming', 'pet-vet', 'pet-play', 'pet-cat'], ['pet']],
  [/gestao|consultoria|empresa|negocio|financa|marketing|produtividade|escritorio/i, ['laptop', 'office-team', 'office-meeting', 'office-tools', 'office-client'], ['servicos', 'imoveis', 'outro']],
  [/moda|roupa|look|vestido|blusa|colecao|estilo|loja/i, ['fashion-rack', 'fashion-look', 'fashion-store', 'fashion-client', 'fashion-detail'], ['moda', 'beleza']],
]

const SEGMENT_POOLS: Record<string, string[]> = {
  beleza: ['hair-waves', 'skin-tall', 'nails', 'hair-wash', 'products', 'transform', 'hair-post', 'booking', 'team', 'smile-tall', 'hair-portrait', 'story-hair'],
  alimentacao: ['food', 'food-burger', 'coffee', 'food-kitchen', 'food-table', 'food-dessert', 'food-delivery'],
  fitness: ['gym-training', 'gym-coach', 'gym', 'gym-results', 'gym-functional', 'gym-challenge'],
  saude: ['dental', 'dental-smile', 'dental-consult', 'dental-care', 'dental-tech', 'dental-team'],
  imoveis: ['interior', 'home-kitchen', 'home-keys', 'home-agent', 'home-building', 'home-facade'],
  pet: ['dog', 'pet-grooming', 'pet-vet', 'pet-play', 'pet-cat', 'pet-products'],
  servicos: ['laptop', 'office-team', 'office-client', 'office-meeting', 'office-tools', 'laptop-story'],
  moda: ['fashion-rack', 'fashion-look', 'fashion-store', 'fashion-client', 'fashion-detail', 'fashion-atelier'],
  outro: ['laptop', 'office-team', 'office-client', 'office-meeting', 'office-tools', 'coffee'],
}

/** `n` different photos for one theme: topic matches first, then the segment pool (repeats only if both run out). */
export function pickDistinctPhotos(text: string, segment = 'beleza', n = 4, seed = 1): string[] {
  const matches: string[] = []
  for (const [re, list, segments] of KEYWORD_PHOTOS) {
    if (segments && !segments.includes(segment)) continue
    if (re.test(text)) matches.push(...list)
  }
  const pool = Array.from(new Set([...matches, ...(SEGMENT_POOLS[segment] || SEGMENT_POOLS.outro)]))
  const start = Math.abs(seed) % Math.max(1, matches.length || pool.length)
  const ring = [...pool.slice(start), ...pool.slice(0, start)]
  return Array.from({ length: n }, (_, i) => ring[i % ring.length])
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
