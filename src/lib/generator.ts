/**
 * Simulated "AI" for the prototype.
 * Same inputs/outputs the real MVP will have (briefing + theme + objective + tone + style → posts, stories,
 * captions, hashtags), but answered from a curated catalog with a seeded random so results vary per version.
 */
import { segmentDef, type PostSeed, type SegmentDef, type ThemeCat, type ThemeDef } from './data'
import type { Creative, GenParams, Generation, ObjectiveId, SegmentId, ToneId } from './types'

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length) % arr.length]
}

function rotate<T>(arr: T[], n: number): T[] {
  if (!arr.length) return arr
  const k = ((n % arr.length) + arr.length) % arr.length
  return [...arr.slice(k), ...arr.slice(0, k)]
}

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

export function cityTag(city: string) {
  const clean = stripAccents(city).replace(/[^A-Za-z0-9 -]/g, ' ').split(/[\s-]+/).filter(Boolean)
  if (!clean.length) return ''
  return '#' + clean.map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('')
}

export function handleFrom(name: string) {
  return stripAccents(name).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'seunegocio'
}

/* ------------------------------------------------------------------ */
/* Theme suggestions (Step 2)                                          */
/* ------------------------------------------------------------------ */

export function themesFor(segment: SegmentId | '' | undefined, cat: ThemeCat = 'ia', seed = 0): ThemeDef[] {
  const seg = segmentDef(segment || 'outro')
  const list = seg.themes.filter((t) => t.cats.includes(cat))
  if (cat !== 'ia' || seed === 0) return list.slice(0, 8)
  // "Gerar novos exemplos": keep a stable set but vary the order
  return shuffle(list, rng(seed)).slice(0, 8)
}

export function findTheme(segment: SegmentId | '' | undefined, themeId: string | null | undefined): ThemeDef | undefined {
  if (!themeId) return undefined
  return segmentDef(segment || 'outro').themes.find((t) => t.id === themeId)
}

export function customThemeDef(seg: SegmentDef, text: string): ThemeDef {
  const base = seg.themes[0]
  const clean = text.trim().replace(/\.$/, '')
  const title = clean.charAt(0).toUpperCase() + clean.slice(1)
  return {
    ...base,
    id: 'custom',
    label: title,
    desc: 'Tema personalizado',
    tag: seg.short,
    cats: ['ia'],
    hashtags: base.hashtags.slice(0, 2),
    posts: [
      { variant: 'photo', headline: `${title}.`, highlight: title.split(' ').slice(-2).join(' ') + '.', sub: 'Tudo o que você precisa saber, do nosso jeito.', photo: base.photos?.[0] ?? base.photo },
      { variant: 'list', headline: `${title}: por que vale a pena?`, highlight: 'vale a pena?', bullets: ['Atendimento personalizado', 'Resultado que você percebe', 'Equipe especializada'], photo: base.photo },
    ],
    story: {
      hook: `Você já conhece: ${title.toLowerCase()}?`,
      poll: ['Já conheço', 'Quero saber'],
      need: 'Muita gente ainda tem dúvidas sobre isso.',
      needBullets: ['Como funciona', 'Para quem é indicado', 'Quanto tempo leva'],
      solution: 'A gente explica tudo, sem complicação.',
      solutionSub: 'Atendimento próximo e transparente.',
      proof: 'list',
      cta: 'Quer saber mais?',
      ctaSub: 'Chama a gente no direct.',
    },
  }
}

/* ------------------------------------------------------------------ */
/* Copy helpers                                                        */
/* ------------------------------------------------------------------ */

const TONE_OPEN: Record<ToneId, (h: string) => string> = {
  profissional: (h) => h,
  descontraido: (h) => `${h} 😍`,
  inspirador: (h) => `✨ ${h}`,
  educativo: (h) => `📌 ${h}`,
  vendedor: (h) => `🔥 ${h}`,
  divertido: (h) => `${h} 😄`,
  minimalista: (h) => h,
  luxuoso: (h) => `${h} ✨`,
}

const TONE_CTA: Record<ToneId, (c: string) => string> = {
  profissional: (c) => `${c} pelo link na bio ou pelo direct.`,
  descontraido: (c) => `Bora? ${c} pelo direct! 💬`,
  inspirador: (c) => `Você merece esse cuidado. ${c} 💛`,
  educativo: (c) => `Gostou da dica? ${c} e compartilhe com quem precisa.`,
  vendedor: (c) => `👉 ${c} agora — vagas limitadas!`,
  divertido: (c) => `${c} e vem rir com a gente! 🎉`,
  minimalista: (c) => `${c}.`,
  luxuoso: (c) => `Uma experiência exclusiva espera por você. ${c}.`,
}

function buildCaption(o: { headline: string; sub?: string; bullets?: string[]; quote?: Creative['quote']; cta: string; tone: ToneId; brand: string; city: string }) {
  const lines: string[] = [TONE_OPEN[o.tone](o.headline.replace(/\s+$/, ''))]
  if (o.quote) lines.push(`“${o.quote.text}” — ${o.quote.author}`)
  else if (o.tone !== 'minimalista') {
    if (o.sub) lines.push(o.sub)
    if (o.bullets?.length) lines.push(o.bullets.map((b) => `• ${b}`).join('\n'))
  }
  lines.push(TONE_CTA[o.tone](o.cta))
  const place = [o.brand, o.city].filter(Boolean).join(' · ')
  if (place) lines.push(`📍 ${place}`)
  return lines.join('\n\n')
}

function hashtagsFor(theme: ThemeDef, seg: SegmentDef, city: string, r: () => number) {
  const tags = [...theme.hashtags, ...shuffle(seg.hashtags, r)]
  const ct = cityTag(city)
  if (ct) tags.push(ct)
  return Array.from(new Set(tags)).slice(0, 7)
}

function ctaFor(seg: SegmentDef, objective: ObjectiveId, r: () => number) {
  return pick(seg.ctas[objective] ?? seg.ctas.atrair, r)
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

function postFromSeed(seed: PostSeed, theme: ThemeDef, seg: SegmentDef, p: GenParams, order: number, r: () => number): Creative {
  const objective = theme.id === p.themeId || p.objective !== 'outro' ? p.objective : theme.objective
  const cta = ctaFor(seg, objective === 'outro' ? theme.objective : objective, r)
  const tone = p.tones[0] ?? 'profissional'
  const photo = seed.photo ?? theme.photo
  return {
    id: uid('post'),
    kind: 'post',
    order,
    themeId: theme.id,
    variant: seed.variant,
    tag: theme.tag,
    headline: seed.headline,
    highlight: seed.highlight,
    sub: seed.sub,
    bullets: seed.bullets,
    icons: seed.icons,
    price: seed.price,
    quote: seed.quote,
    cta,
    photo,
    photo2: seed.photo2,
    caption: buildCaption({ headline: seed.headline, sub: seed.sub, bullets: seed.bullets, quote: seed.quote, cta, tone, brand: p.brandName, city: p.city }),
    hashtags: hashtagsFor(theme, seg, p.city, r),
  }
}

function storiesFor(theme: ThemeDef, seg: SegmentDef, p: GenParams, r: () => number): Creative[] {
  const s = theme.story
  const tone = p.tones[0] ?? 'profissional'
  const photos = shuffle([theme.photo, ...(theme.photos ?? [])], r)
  const ph = (i: number) => photos[i % photos.length]
  const cta = ctaFor(seg, p.objective === 'outro' ? theme.objective : p.objective, r)
  const tags = hashtagsFor(theme, seg, p.city, r)
  const base = { kind: 'story' as const, themeId: theme.id, tag: theme.tag, hashtags: tags }
  const cap = (headline: string, extra?: string) =>
    buildCaption({ headline, sub: extra, cta, tone, brand: p.brandName, city: p.city })

  const proof: Creative =
    s.proof === 'quote'
      ? { ...base, id: uid('story'), order: 3, variant: 'quote', headline: s.solution, quote: { text: s.solution.replace(/"/g, ''), author: s.solutionSub }, cta, photo: ph(2), caption: cap(s.solution) }
      : s.proof === 'beforeafter'
        ? { ...base, id: uid('story'), order: 3, variant: 'beforeafter', headline: s.solution, highlight: s.solution.split(' ').slice(-2).join(' '), sub: s.solutionSub, cta, photo: 'beforeafter', photo2: 'transform', caption: cap(s.solution, s.solutionSub) }
        : { ...base, id: uid('story'), order: 3, variant: 'photo', headline: s.solution, highlight: s.solution.split(' ').slice(-2).join(' '), sub: s.solutionSub, cta, photo: ph(2), caption: cap(s.solution, s.solutionSub) }

  return [
    { ...base, id: uid('story'), order: 1, variant: 'poll', headline: s.hook, highlight: s.hook.split(' ').slice(-2).join(' '), poll: s.poll, cta, photo: ph(0), caption: cap(s.hook) },
    { ...base, id: uid('story'), order: 2, variant: 'list', headline: s.need, highlight: s.need.split(' ').slice(-2).join(' '), bullets: s.needBullets, cta, photo: ph(1), caption: cap(s.need, s.needBullets.join(', ')) },
    proof,
    { ...base, id: uid('story'), order: 4, variant: 'photo', headline: s.cta, highlight: s.cta.split(' ').slice(-2).join(' '), sub: s.ctaSub, cta, photo: ph(3), caption: cap(s.cta, s.ctaSub) },
  ]
}

export function generate(p: GenParams, version = 1): Generation {
  const seg = segmentDef(p.segment)
  const r = rng(p.seed)
  const main: ThemeDef =
    p.themeId === 'custom' && p.customTheme ? customThemeDef(seg, p.customTheme) : (findTheme(p.segment, p.themeId) ?? seg.themes[0])

  // Main theme first, then complementary themes from the suggestion list (rotated per version)
  const pool = seg.mix
    ? seg.mix.map((id) => seg.themes.find((t) => t.id === id)!).filter(Boolean)
    : seg.themes.filter((t) => t.cats.includes('ia'))
  const others = rotate(
    pool.filter((t) => t.id !== main.id),
    version - 1,
  )
  let themes = [main, ...others].slice(0, 4)
  if (p.objective === 'promocao' && !themes.some((t) => t.posts.some((x) => x.variant === 'offer'))) {
    const promo = seg.themes.find((t) => t.posts.some((x) => x.variant === 'offer'))
    if (promo) themes = [...themes.slice(0, 3), promo]
  }

  const posts = p.posts
    ? themes.map((t, i) => {
        const seeds = t.posts
        const s = seeds[(version - 1 + (i === 0 ? 0 : Math.floor((version - 1) / 2))) % seeds.length]
        return postFromSeed(s, t, seg, p, i + 1, r)
      })
    : []

  const stories = p.stories ? storiesFor(main, seg, p, r) : []

  return {
    id: uid('gen'),
    createdAt: Date.now(),
    version,
    themeLabel: main.label,
    params: p,
    posts,
    stories,
  }
}

/** Alternative copy for one creative ("Reescrever com IA" in the editor). */
export function rewrite(c: Creative, segment: SegmentId, seed: number): Partial<Creative> {
  const seg = segmentDef(segment)
  const theme = seg.themes.find((t) => t.id === c.themeId)
  const r = rng(seed)
  if (c.kind === 'post' && theme && theme.posts.length > 1) {
    const options = theme.posts.filter((x) => x.headline !== c.headline)
    const s = pick(options, r)
    return { headline: s.headline, highlight: s.highlight, sub: s.sub ?? c.sub, bullets: s.bullets ?? c.bullets }
  }
  const alt = [
    (h: string) => h.replace(/\.$/, '') + ' — e você merece.',
    (h: string) => 'Você sabia? ' + h,
    (h: string) => h.replace(/\.$/, '!'),
  ]
  const h = pick(alt, r)(c.headline)
  return { headline: h }
}
