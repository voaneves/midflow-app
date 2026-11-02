/**
 * Pexels stock photos: fallback when AI image generation fails or is over its limit.
 * Free API (200 searches/hour, 20k/month by default). Credits to Pexels and the photographer are
 * required before a public launch; the credit is already returned so the UI can show it later.
 */
import { config } from './config.ts'

export interface PexelsPhoto {
  buffer: Buffer
  mimeType: string
  credit: string
}

interface SearchHit {
  original: string
  photographer: string
}

const SEGMENT_QUERY: Record<string, string> = {
  beleza: 'beauty salon hair care',
  alimentacao: 'restaurant food',
  fitness: 'gym workout',
  saude: 'dental clinic smile',
  imoveis: 'modern apartment interior',
  pet: 'dog grooming pet shop',
  servicos: 'small business office',
  moda: 'fashion boutique clothing',
  outro: 'small business',
}

/**
 * Short English search query from the image prompt the text model wrote for the card
 * (Pexels search works best with a few words, not a full paragraph).
 */
export function pexelsQuery(prompt: string | undefined, segment = 'beleza'): string {
  const subject = (prompt || '').split(/\.\s*Style:/i)[0].split(/[.!?;\n]/)[0]
  const words = subject
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^(a|an|the|of|in|on|with|and|for|at|to|by|photo|photograph|image|picture|realistic|professional)$/i.test(w))
    .slice(0, 7)
  return words.length >= 2 ? words.join(' ') : SEGMENT_QUERY[segment] || SEGMENT_QUERY.outro
}

/** Only files from Pexels' own CDN are downloaded (the URL comes from a third-party response). */
export function isPexelsImageUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'images.pexels.com'
  } catch {
    return false
  }
}

const SEARCH_TTL = 60 * 60_000
const searchCache = new Map<string, { at: number; hits: SearchHit[] }>()

async function search(query: string, orientation: 'portrait' | 'square'): Promise<SearchHit[]> {
  const key = `${orientation}:${query.toLowerCase()}`
  const cached = searchCache.get(key)
  if (cached && Date.now() - cached.at < SEARCH_TTL) return cached.hits

  const url = `https://api.pexels.com/v1/search?${new URLSearchParams({ query, orientation, per_page: '30' })}`
  const res = await fetch(url, { headers: { Authorization: config.image.pexelsKey }, signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Pexels ${res.status}`)
  const json: any = await res.json()
  const hits: SearchHit[] = (json?.photos ?? [])
    .map((p: any) => ({ original: String(p?.src?.original ?? ''), photographer: String(p?.photographer ?? '').slice(0, 80) }))
    .filter((h: SearchHit) => isPexelsImageUrl(h.original))

  searchCache.set(key, { at: Date.now(), hits })
  if (searchCache.size > 200) searchCache.delete(searchCache.keys().next().value!)
  return hits
}

export async function fetchPexelsPhoto(opts: { prompt?: string; segment?: string; kind?: 'post' | 'story'; order?: number; seed?: number }): Promise<PexelsPhoto | null> {
  if (!config.image.pexelsKey) return null
  const kind = opts.kind ?? 'post'
  try {
    const query = pexelsQuery(opts.prompt, opts.segment)
    let hits = await search(query, kind === 'story' ? 'portrait' : 'square')
    if (!hits.length) hits = await search(SEGMENT_QUERY[opts.segment || 'outro'] || SEGMENT_QUERY.outro, kind === 'story' ? 'portrait' : 'square')
    if (!hits.length) return null

    const hit = hits[Math.abs((opts.order ?? 1) + (opts.seed ?? 0)) % hits.length]
    const size = kind === 'story' ? { w: '1080', h: '1920' } : { w: '1080', h: '1080' }
    const src = `${hit.original}?${new URLSearchParams({ auto: 'compress', cs: 'tinysrgb', fit: 'crop', ...size })}`
    const res = await fetch(src, { signal: AbortSignal.timeout(6000) })
    const type = res.headers.get('content-type') || ''
    if (!res.ok || !type.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length < 5000) return null
    return { buffer, mimeType: type.split(';')[0], credit: `${hit.photographer || 'Pexels'} / Pexels` }
  } catch (err: any) {
    console.warn(`[MIDFLOW Pexels] ${err?.message || err}`)
    return null
  }
}
