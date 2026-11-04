/**
 * Pixabay stock photos: fallback when AI image generation fails or is over its limit.
 * Free API (100 requests/minute). Pixabay's terms: cache search results for 24 h, download images
 * to our own server instead of hotlinking, and show where the photos come from. The credit is
 * already returned so the UI can show it.
 */
import { config } from './config.ts'

export interface StockPhoto {
  buffer: Buffer
  mimeType: string
  credit: string
}

interface SearchHit {
  url: string
  user: string
}

const SEGMENT_QUERY: Record<string, string> = {
  beleza: 'beauty salon hair',
  alimentacao: 'restaurant food',
  fitness: 'gym workout',
  saude: 'dentist smile',
  imoveis: 'apartment interior',
  pet: 'dog grooming',
  servicos: 'small business office',
  moda: 'fashion boutique',
  outro: 'small business',
}

/**
 * Short English search query from the image prompt the text model wrote for the card.
 * Pixabay matches every word, so a few words find far more photos than a full sentence.
 */
export function stockQuery(prompt: string | undefined, segment = 'beleza'): string {
  // First clause only: "fresh artisan bread loaves on a rustic counter, warm light" -> "fresh artisan bread loaves".
  const subject = (prompt || '').split(/\.\s*Style:/i)[0].split(/[.!?;,\n]/)[0]
  const words = subject
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 1 &&
        !/^(a|an|the|of|in|on|with|and|for|at|to|by|photo|photograph|photography|image|picture|realistic|professional|gourmet|luxury|vertical|close|up)$/i.test(w),
    )
    .slice(0, 4)
  return words.length >= 2 ? words.join(' ') : SEGMENT_QUERY[segment] || SEGMENT_QUERY.outro
}

/** Only files from Pixabay's own hosts are downloaded (the URL comes from a third-party response). */
export function isPixabayImageUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && (u.hostname === 'pixabay.com' || u.hostname === 'cdn.pixabay.com')
  } catch {
    return false
  }
}

const SEARCH_TTL = 24 * 60 * 60_000
const searchCache = new Map<string, { at: number; hits: SearchHit[] }>()

async function search(query: string, orientation: 'vertical' | 'all'): Promise<SearchHit[]> {
  const key = `${orientation}:${query.toLowerCase()}`
  const cached = searchCache.get(key)
  if (cached && Date.now() - cached.at < SEARCH_TTL) return cached.hits

  const params = new URLSearchParams({ key: config.image.pixabayKey, q: query.slice(0, 100), image_type: 'photo', orientation, safesearch: 'true', per_page: '30' })
  const res = await fetch(`https://pixabay.com/api/?${params}`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Pixabay ${res.status}`)
  const json: any = await res.json()
  const hits: SearchHit[] = (json?.hits ?? [])
    .map((h: any) => ({ url: String(h?.largeImageURL ?? ''), user: String(h?.user ?? '').slice(0, 80) }))
    .filter((h: SearchHit) => isPixabayImageUrl(h.url))

  searchCache.set(key, { at: Date.now(), hits })
  if (searchCache.size > 200) searchCache.delete(searchCache.keys().next().value!)
  return hits
}

export async function fetchStockPhoto(opts: { prompt?: string; segment?: string; kind?: 'post' | 'story'; order?: number; seed?: number }): Promise<StockPhoto | null> {
  if (!config.image.pixabayKey) return null
  // Pixabay has no square filter; posts take any orientation and the canvas crops with object-cover.
  const orientation = (opts.kind ?? 'post') === 'story' ? 'vertical' : 'all'
  try {
    let hits = await search(stockQuery(opts.prompt, opts.segment), orientation)
    if (!hits.length) hits = await search(SEGMENT_QUERY[opts.segment || 'outro'] || SEGMENT_QUERY.outro, orientation)
    if (!hits.length) return null

    const hit = hits[Math.abs((opts.order ?? 1) + (opts.seed ?? 0)) % hits.length]
    const res = await fetch(hit.url, { signal: AbortSignal.timeout(6000) })
    const type = res.headers.get('content-type') || ''
    if (!res.ok || !type.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length < 5000) return null
    return { buffer, mimeType: type.split(';')[0], credit: `${hit.user || 'Pixabay'} / Pixabay` }
  } catch (err: any) {
    // Never log the request URL: it carries the API key.
    console.warn(`[MIDFLOW Pixabay] ${err?.name === 'TimeoutError' ? 'timeout' : err?.message || err}`)
    return null
  }
}
