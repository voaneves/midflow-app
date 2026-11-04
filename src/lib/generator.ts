/**
 * Gerador inteligente de conteúdo para o MIDFLOW.
 * Conecta 100% dos dados do briefing (empresa, cidade, sobre, público, temas desejados, tom, estilo, formato)
 * e produz posts harmônicos complementares (Capa/Destaque -> Benefícios/Lista -> Prova/Antes-e-Depois -> Oferta/Agendamento)
 * além de sequências de Stories narrativos (Gancho -> Necessidade -> Prova -> CTA).
 */
import { segmentDef, type PostSeed, type SegmentDef, type ThemeCat, type ThemeDef } from './data'
import { pickDistinctPhotos } from './photos'
import { voiceKeyFor, type VoiceKey } from '../../server/voiceKey.ts'
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

const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function cityTag(city?: string) {
  if (!city) return ''
  const clean = stripAccents(city).replace(/[^A-Za-z0-9 -]/g, ' ').split(/[\s-]+/).filter(Boolean)
  if (!clean.length) return ''
  return '#' + clean.map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('')
}

export function handleFrom(name: string) {
  return stripAccents(name).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'seunegocio'
}

/* ------------------------------------------------------------------ */
/* Sugestões de temas (Etapa 2)                                        */
/* ------------------------------------------------------------------ */

export function themesFor(segment: SegmentId | '' | undefined, cat: ThemeCat = 'ia', seed = 0): ThemeDef[] {
  const seg = segmentDef(segment || 'outro')
  const list = seg.themes.filter((t) => t.cats.includes(cat))
  if (cat !== 'ia' || seed === 0) return list.slice(0, 8)
  return shuffle(list, rng(seed)).slice(0, 8)
}

export function findTheme(segment: SegmentId | '' | undefined, themeId: string | null | undefined): ThemeDef | undefined {
  if (!themeId) return undefined
  return segmentDef(segment || 'outro').themes.find((t) => t.id === themeId)
}

/**
 * Copy of the custom-theme posts and story that depends on the kind of business, so a bakery never gets "agende seu horário" or "protocolos".
 * Segment detection is shared with the server (server/voiceKey.ts); "beleza" keeps the original wording.
 */
const CUSTOM_COPY: Record<VoiceKey, { cta: string; offerSub: string; iconsSub: string; bullets: string[] }> = {
  beleza: {
    cta: 'Quer saber mais e agendar seu horário?',
    offerSub: 'Garanta seu horário e aproveite esta oportunidade.',
    iconsSub: 'Protocolos sob medida para transformar sua experiência.',
    bullets: ['Diagnóstico personalizado e individual', 'Resultado visível desde o primeiro momento', 'Equipe altamente especializada e qualificada'],
  },
  alimentacao: {
    cta: 'Quer provar? Faça seu pedido.',
    offerSub: 'Faça seu pedido e aproveite esta oportunidade.',
    iconsSub: 'Ingredientes frescos e preparo caprichado em cada pedido.',
    bullets: ['Ingredientes frescos e bem selecionados', 'Sabor de verdade desde a primeira garfada', 'Preparo caprichado, feito na hora'],
  },
  padaria: {
    cta: 'Quer provar? Faça sua encomenda.',
    offerSub: 'Faça sua encomenda e aproveite esta oportunidade.',
    iconsSub: 'Fornadas fresquinhas e receitas da casa todos os dias.',
    bullets: ['Fornadas fresquinhas ao longo do dia', 'Receitas da casa com ingredientes de qualidade', 'Encomendas sob medida para a sua ocasião'],
  },
  fitness: {
    cta: 'Quer começar? Fale com a equipe.',
    offerSub: 'Garanta sua matrícula e aproveite esta oportunidade.',
    iconsSub: 'Treino sob medida para a sua evolução.',
    bullets: ['Plano de treino ajustado ao seu objetivo', 'Acompanhamento próximo dos professores', 'Evolução que você percebe semana a semana'],
  },
  saude: {
    cta: 'Quer saber mais? Agende sua consulta.',
    offerSub: 'Agende sua avaliação e aproveite esta oportunidade.',
    iconsSub: 'Cuidado individual para a sua saúde.',
    bullets: ['Avaliação cuidadosa e individual', 'Orientação clara em cada etapa', 'Equipe especializada e acolhedora'],
  },
  imoveis: {
    cta: 'Quer saber mais? Agende uma visita.',
    offerSub: 'Agende uma visita e aproveite esta oportunidade.',
    iconsSub: 'Assessoria completa do primeiro contato às chaves.',
    bullets: ['Opções selecionadas para o seu perfil', 'Negociação clara e documentação conferida', 'Acompanhamento do início ao fim'],
  },
  pet: {
    cta: 'Quer saber mais? Agende para o seu pet.',
    offerSub: 'Agende o horário do seu pet e aproveite esta oportunidade.',
    iconsSub: 'Cuidado carinhoso e seguro para o seu pet.',
    bullets: ['Atendimento gentil, no ritmo do seu pet', 'Ambiente limpo e seguro', 'Equipe apaixonada por animais'],
  },
  servicos: {
    cta: 'Quer conversar? Agende uma conversa.',
    offerSub: 'Agende uma conversa e aproveite esta oportunidade.',
    iconsSub: 'Método claro e entregas combinadas.',
    bullets: ['Diagnóstico claro do seu cenário', 'Plano com metas e prazos combinados', 'Acompanhamento até o resultado'],
  },
  moda: {
    cta: 'Quer ver mais? Chame a gente no Direct.',
    offerSub: 'Garanta a sua peça e aproveite esta oportunidade.',
    iconsSub: 'Peças selecionadas com estilo e qualidade.',
    bullets: ['Peças selecionadas com curadoria', 'Modelagem e caimento que valorizam você', 'Looks para todas as ocasiões'],
  },
  generico: {
    cta: 'Quer saber mais? Fale com a gente.',
    offerSub: 'Fale com a gente e aproveite esta oportunidade.',
    iconsSub: 'Cuidado e qualidade em cada detalhe.',
    bullets: ['Atendimento próximo e personalizado', 'Qualidade que você percebe desde o início', 'Equipe preparada e atenciosa'],
  },
}

export function customThemeDef(seg: SegmentDef, text: string): ThemeDef {
  const base = seg.themes[0]
  const clean = text.trim().replace(/\.$/, '')
  const title = clean.charAt(0).toUpperCase() + clean.slice(1)
  const copy = CUSTOM_COPY[voiceKeyFor(seg.id, title)]
  const photos = pickDistinctPhotos(title, seg.id, 4, 11)
  return {
    ...base,
    id: 'custom',
    label: title,
    desc: 'Tema personalizado do briefing',
    tag: seg.short,
    photo: photos[0],
    photos,
    cats: ['ia'],
    hashtags: base.hashtags.slice(0, 3),
    posts: [
      {
        variant: 'photo',
        headline: `${title}: o cuidado que você merece.`,
        highlight: 'você merece.',
        sub: 'Atendimento especializado com foco em resultados reais e duradouros.',
        photo: photos[0],
      },
      {
        variant: 'list',
        headline: `${title}: por que vale a pena investir?`,
        highlight: 'vale a pena',
        bullets: copy.bullets,
        photo: photos[1],
      },
      {
        variant: 'icons',
        headline: 'Excelência em cada detalhe do atendimento.',
        highlight: 'cada detalhe',
        icons: [
          { icon: 'sparkles', label: 'Alta performance' },
          { icon: 'heart', label: 'Cuidado único' },
          { icon: 'shield', label: 'Segurança total' },
        ],
        sub: copy.iconsSub,
        photo: photos[2],
      },
      {
        variant: 'offer',
        headline: `${title}: condições especiais nesta semana.`,
        highlight: 'condições especiais',
        price: { label: 'A partir de', value: '89', cents: '90' },
        sub: copy.offerSub,
        photo: photos[3],
      },
    ],
    story: {
      hook: `Você já conhece tudo sobre: ${title.toLowerCase()}?`,
      poll: ['Já conheço', 'Quero saber mais'],
      need: 'Muitas pessoas têm dúvidas sobre a melhor forma de cuidar disso no dia a dia.',
      needBullets: ['Como funciona na prática', 'Para quem é mais indicado', 'Resultados rápidos e duradouros'],
      solution: 'Nossa equipe preparou uma experiência completa e transparente.',
      solutionSub: 'Atendimento próximo, produtos de primeira linha e foco no seu bem-estar.',
      proof: 'list',
      cta: copy.cta,
      ctaSub: 'Envie uma mensagem pelo direct ou toque no link da bio!',
    },
  }
}

/* ------------------------------------------------------------------ */
/* Auxiliares de Copy e Legendas                                       */
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
  descontraido: (c) => `Bora? ${c} pelo direct com a gente! 💬`,
  inspirador: (c) => `Você merece esse cuidado. ${c} hoje mesmo. 💛`,
  educativo: (c) => `Gostou da orientação? ${c} e compartilhe com quem precisa.`,
  vendedor: (c) => `👉 ${c} agora — horários e condições por tempo limitado!`,
  divertido: (c) => `${c} e venha se divertir com a gente! 🎉`,
  minimalista: (c) => `${c}.`,
  luxuoso: (c) => `Uma experiência exclusiva espera por você. ${c}.`,
}

function buildCaption(o: {
  headline: string
  sub?: string
  bullets?: string[]
  quote?: Creative['quote']
  cta: string
  tone: ToneId
  brand: string
  city: string
  topics?: string
}) {
  const lines: string[] = [TONE_OPEN[o.tone](o.headline.replace(/\s+$/, ''))]
  if (o.quote) {
    lines.push(`“${o.quote.text}” — ${o.quote.author}`)
  } else if (o.tone !== 'minimalista') {
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
/* Motor de Geração Completo                                           */
/* ------------------------------------------------------------------ */

function postFromSeed(
  seed: PostSeed,
  theme: ThemeDef,
  seg: SegmentDef,
  p: GenParams,
  order: number,
  r: () => number,
): Creative {
  const objective = theme.id === p.themeId || p.objective !== 'outro' ? p.objective : theme.objective
  const cta = ctaFor(seg, objective === 'outro' ? theme.objective : objective, r)
  const tone = p.tones[0] ?? 'profissional'
  const photo = seed.photo ?? theme.photo

  let headline = seed.headline
  let sub = seed.sub
  let bullets = seed.bullets

  // Contextualização rica com os dados preenchidos no briefing
  if (order === 1 && p.brandName && !headline.includes(p.brandName)) {
    if (r() > 0.4) {
      headline = seed.headline.replace(/\.$/, '')
    }
  }

  if (p.topics && order === 2 && !bullets) {
    const rawTopics = p.topics.split(/[,;\n]/).map((t) => t.trim()).filter((t) => t.length > 3)
    if (rawTopics.length >= 2) {
      bullets = rawTopics.slice(0, 3)
    }
  }

  return {
    id: uid('post'),
    kind: 'post',
    order,
    themeId: theme.id,
    variant: seed.variant,
    tag: theme.tag,
    headline,
    highlight: seed.highlight,
    sub,
    bullets,
    icons: seed.icons,
    price: seed.price,
    quote: seed.quote,
    cta,
    photo,
    photo2: seed.photo2,
    caption: buildCaption({
      headline,
      sub,
      bullets,
      quote: seed.quote,
      cta,
      tone,
      brand: p.brandName,
      city: p.city,
      topics: p.topics,
    }),
    hashtags: hashtagsFor(theme, seg, p.city, r),
  }
}

function storiesFor(theme: ThemeDef, seg: SegmentDef, p: GenParams, r: () => number): Creative[] {
  const s = theme.story
  const tone = p.tones[0] ?? 'profissional'
  const photos = shuffle(Array.from(new Set([theme.photo, ...(theme.photos ?? [])])), r)
  const ph = (i: number) => photos[i % photos.length]
  const cta = ctaFor(seg, p.objective === 'outro' ? theme.objective : p.objective, r)
  const tags = hashtagsFor(theme, seg, p.city, r)
  const base = { kind: 'story' as const, themeId: theme.id, tag: theme.tag, hashtags: tags }
  const cap = (headline: string, extra?: string) =>
    buildCaption({ headline, sub: extra, cta, tone, brand: p.brandName, city: p.city })

  const proof: Creative =
    s.proof === 'quote'
      ? {
          ...base,
          id: uid('story'),
          order: 3,
          variant: 'quote',
          headline: s.solution,
          quote: { text: s.solution.replace(/"/g, ''), author: s.solutionSub },
          cta,
          photo: ph(2),
          caption: cap(s.solution),
        }
      : s.proof === 'beforeafter'
        ? {
            ...base,
            id: uid('story'),
            order: 3,
            variant: 'beforeafter',
            headline: s.solution,
            highlight: s.solution.split(' ').slice(-2).join(' '),
            sub: s.solutionSub,
            cta,
            photo: 'beforeafter',
            photo2: 'transform',
            caption: cap(s.solution, s.solutionSub),
          }
        : {
            ...base,
            id: uid('story'),
            order: 3,
            variant: 'photo',
            headline: s.solution,
            highlight: s.solution.split(' ').slice(-2).join(' '),
            sub: s.solutionSub,
            cta,
            photo: ph(2),
            caption: cap(s.solution, s.solutionSub),
          }

  return [
    {
      ...base,
      id: uid('story'),
      order: 1,
      variant: 'poll',
      headline: s.hook,
      highlight: s.hook.split(' ').slice(-2).join(' '),
      poll: s.poll,
      cta,
      photo: ph(0),
      caption: cap(s.hook),
    },
    {
      ...base,
      id: uid('story'),
      order: 2,
      variant: 'list',
      headline: s.need,
      highlight: s.need.split(' ').slice(-2).join(' '),
      bullets: s.needBullets,
      cta,
      photo: ph(1),
      caption: cap(s.need, s.needBullets.join(', ')),
    },
    proof,
    {
      ...base,
      id: uid('story'),
      order: 4,
      variant: 'photo',
      headline: s.cta,
      highlight: s.cta.split(' ').slice(-2).join(' '),
      sub: s.ctaSub,
      cta,
      photo: ph(3),
      caption: cap(s.cta, s.ctaSub),
    },
  ]
}

export function generate(p: GenParams, version = 1): Generation {
  const seg = segmentDef(p.segment)
  const r = rng(p.seed)
  const main: ThemeDef =
    p.themeId === 'custom' && p.customTheme
      ? customThemeDef(seg, p.customTheme)
      : (findTheme(p.segment, p.themeId) ?? seg.themes[0])

  // Sequência harmônica entre os 4 posts (estilo mockup step-4-generate)
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

  // Garantir 4 posts diversificados em variantes quando possível
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
    engine: 'synthesizer',
  }
}
