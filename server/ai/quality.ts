/**
 * Quality gate for a content pack.
 * 1. Normalizes the raw model output (trims, fixes small things automatically).
 * 2. Checks every rule from prompt.ts and lists what is still wrong.
 * 3. Scores the pack 0–100. The pipeline asks the model to repair packs below the bar.
 */
import { ICON_NAMES, LIMITS } from './prompt.ts'
import type { GenerateParams, QualityIssue, QualityReport, RawPack, RawPost, RawStory } from './types.ts'

const PENALTY = { critical: 20, major: 6, minor: 1 }

/** Text copied from the format example, or obvious filler. */
const PLACEHOLDER =
  /\b(lorem|ipsum|item espec[ií]fico|benef[ií]cio \d|op[cç][aã]o [ab]\b|sinal \d|trecho exato|t[ií]tulo (curto|educativo|de oferta|de autoridade)|subt[ií]tulo|cta curto|english (photography|photo) prompt|roteiro story|xxx)\b|\[[^\]]*\]/i

const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')
const multiline = (v: unknown) =>
  typeof v === 'string' ? v.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : ''
const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])

function normalizeHashtag(t: string): string {
  const core = t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^#+/, '')
    .replace(/[^A-Za-z0-9_]/g, '')
  return core ? `#${core}` : ''
}

function hasNumber(text: string, value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length > 0 && text.replace(/\D+/g, ' ').split(' ').includes(digits)
}

export function reviewPack(raw: any, params: GenerateParams): { pack: RawPack; report: QualityReport } {
  const issues: QualityIssue[] = []
  const add = (severity: QualityIssue['severity'], where: string, message: string, fixed = false) =>
    issues.push({ severity, where, message, fixed })

  const briefingText = [params.about, params.topics, params.customTheme, params.objectiveOther, params.references]
    .map(str)
    .join(' ')
  const brand = str(params.brandName)

  const fixHighlight = (where: string, headline: string, highlight: string) => {
    if (highlight && headline.toLowerCase().includes(highlight.toLowerCase())) {
      const i = headline.toLowerCase().indexOf(highlight.toLowerCase())
      return headline.slice(i, i + highlight.length) // keep the headline's own casing
    }
    add('minor', where, 'highlight não é um trecho do headline (corrigido automaticamente)', true)
    return headline.split(' ').slice(-2).join(' ').replace(/[.!?:]+$/, '')
  }

  const checkLen = (where: string, field: string, value: string, max: number, severity: QualityIssue['severity'] = 'major') => {
    if (value.length > max) add(severity, where, `${field} com ${value.length} caracteres (máx. ${max})`)
  }

  const checkPlaceholder = (where: string, ...values: string[]) => {
    if (values.some((v) => PLACEHOLDER.test(v))) add('critical', where, 'texto de exemplo/placeholder no lugar de conteúdo real')
  }

  // ---------- posts ----------
  const rawPosts: any[] = Array.isArray(raw?.posts) ? raw.posts : []
  const posts: RawPost[] = rawPosts.slice(0, 4).map((p, i) => {
    const where = `post ${i + 1}`
    const variant = (['photo', 'list', 'icons', 'offer', 'quote'] as const).includes(p?.variant) ? p.variant : 'photo'
    const headline = str(p?.headline)
    const out: RawPost = {
      variant,
      tag: str(p?.tag).toUpperCase(),
      headline,
      highlight: '',
      sub: str(p?.sub),
      cta: str(p?.cta),
      imagePrompt: str(p?.imagePrompt),
      caption: multiline(p?.caption),
      hashtags: [],
    }

    if (!headline) add('critical', where, 'headline vazio')
    checkLen(where, 'headline', headline, LIMITS.headlineChars)
    out.highlight = headline ? fixHighlight(where, headline, str(p?.highlight)) : ''
    checkLen(where, 'highlight', out.highlight, LIMITS.highlightChars, 'minor')
    checkLen(where, 'sub', out.sub, LIMITS.subChars)
    checkLen(where, 'tag', out.tag, LIMITS.tagChars, 'minor')
    if (!out.cta) add('major', where, 'CTA vazio')
    checkLen(where, 'cta', out.cta, LIMITS.ctaChars)
    if (!out.imagePrompt) add('minor', where, 'imagePrompt vazio')

    // caption
    const cap = out.caption.replace(/(^|\s)#[\p{L}\d_]+/gu, '').trim()
    if (cap !== out.caption) {
      out.caption = cap
      add('minor', where, 'hashtags dentro da legenda (movidas automaticamente)', true)
    }
    if (out.caption.length < LIMITS.captionMin) add('major', where, `legenda curta (${out.caption.length} caracteres, mín. ${LIMITS.captionMin})`)
    if (out.caption.length > LIMITS.captionMax) add('minor', where, `legenda longa (${out.caption.length} caracteres)`)
    if (brand && !out.caption.toLowerCase().includes(brand.toLowerCase())) add('minor', where, 'legenda não cita o nome da marca')

    // hashtags
    const tags = [...new Set(strList(p?.hashtags).map(normalizeHashtag).filter(Boolean))]
    out.hashtags = tags.slice(0, LIMITS.hashtagsMax)
    if (out.hashtags.length < LIMITS.hashtagsMin) add('major', where, `apenas ${out.hashtags.length} hashtags (mín. ${LIMITS.hashtagsMin})`)

    // variant-specific
    const bullets = strList(p?.bullets)
    if (variant === 'list') {
      out.bullets = bullets.slice(0, 4)
      if (out.bullets.length < 3) add('major', where, 'post de lista precisa de 3 bullets')
    } else if (variant === 'offer') {
      out.bullets = bullets.slice(0, 3)
      if (out.bullets.length < 2) add('major', where, 'post de oferta precisa de 2–3 bullets')
    }
    out.bullets?.forEach((b, j) => checkLen(where, `bullet ${j + 1}`, b, LIMITS.bulletChars))

    if (variant === 'icons') {
      const icons = (Array.isArray(p?.icons) ? p.icons : [])
        .map((ic: any) => ({ icon: str(ic?.icon), label: str(ic?.label) }))
        .filter((ic: any) => ic.label)
        .slice(0, 3)
      icons.forEach((ic: { icon: string; label: string }) => {
        if (!(ICON_NAMES as readonly string[]).includes(ic.icon)) {
          ic.icon = 'sparkles'
          add('minor', where, 'ícone desconhecido (trocado automaticamente)', true)
        }
        checkLen(where, 'rótulo de ícone', ic.label, LIMITS.iconLabelChars)
      })
      out.icons = icons
      if (icons.length < 3) add('major', where, 'post de ícones precisa de 3 diferenciais')
    }

    if (variant === 'quote') {
      const text = str(p?.quote?.text)
      if (!text) add('major', where, 'post de citação sem texto')
      else out.quote = { text, author: str(p?.quote?.author) || brand }
    }

    if (p?.price && str(p.price.value)) {
      if (hasNumber(briefingText, str(p.price.value))) {
        out.price = { label: str(p.price.label) || 'A partir de', value: str(p.price.value), cents: str(p.price.cents) || undefined }
      } else {
        add('major', where, 'preço inventado (não está no briefing) — removido automaticamente', true)
      }
    }

    checkPlaceholder(where, out.headline, out.sub, out.cta, out.tag, ...(out.bullets ?? []), ...(out.icons?.map((x) => x.label) ?? []))
    return out
  })

  if (params.posts !== false && posts.length < 4) add('critical', 'posts', `apenas ${posts.length} de 4 posts`)

  // ---------- stories ----------
  const rawStories: any[] = Array.isArray(raw?.stories) ? raw.stories : []
  const stories: RawStory[] = rawStories.slice(0, 4).map((st, i) => {
    const where = `story ${i + 1}`
    const headline = str(st?.headline)
    const out: RawStory = {
      headline,
      highlight: '',
      sub: str(st?.sub) || undefined,
      cta: str(st?.cta),
      imagePrompt: str(st?.imagePrompt),
      caption: multiline(st?.caption),
    }
    if (!headline) add('critical', where, 'headline vazio')
    checkLen(where, 'headline', headline, LIMITS.storyHeadlineChars)
    out.highlight = headline ? fixHighlight(where, headline, str(st?.highlight)) : ''
    if (out.sub) checkLen(where, 'sub', out.sub, LIMITS.subChars)
    if (!out.cta) add('major', where, 'CTA vazio')
    checkLen(where, 'cta', out.cta, LIMITS.ctaChars)

    if (i === 0) {
      out.poll = strList(st?.poll).slice(0, 2)
      if (out.poll.length < 2) add('major', where, 'story de gancho precisa de enquete com 2 opções')
      out.poll.forEach((o) => checkLen(where, 'opção de enquete', o, LIMITS.pollChars))
    }
    if (i === 1) {
      out.bullets = strList(st?.bullets).slice(0, 3)
      if (out.bullets.length < 3) add('major', where, 'story 2 precisa de 3 bullets')
      out.bullets.forEach((b, j) => checkLen(where, `bullet ${j + 1}`, b, LIMITS.bulletChars))
    }
    checkPlaceholder(where, out.headline, out.sub ?? '', out.cta, ...(out.poll ?? []), ...(out.bullets ?? []))
    return out
  })

  if (params.stories !== false && stories.length < 4) add('critical', 'stories', `apenas ${stories.length} de 4 stories`)

  // ---------- whole pack ----------
  const heads = posts.map((p) => p.headline.toLowerCase()).filter(Boolean)
  if (new Set(heads).size < heads.length) add('major', 'posts', 'headlines repetidos entre posts')
  const tagSets = posts.map((p) => p.hashtags.join(' '))
  if (tagSets.length > 1 && new Set(tagSets).size === 1) add('minor', 'posts', 'mesmo conjunto de hashtags em todos os posts')

  const pack: RawPack = {
    themeLabel: str(raw?.themeLabel) || str(params.customTheme) || 'Conteúdo da semana',
    posts,
    stories,
  }

  const open = issues.filter((x) => !x.fixed)
  const score = Math.max(0, 100 - open.reduce((sum, x) => sum + PENALTY[x.severity], 0))
  const passed = !open.some((x) => x.severity === 'critical') && score >= 70
  return { pack, report: { score, passed, issues } }
}

/** Human-readable list of the problems the model still has to fix. */
export function openIssues(report: QualityReport): string[] {
  return report.issues.filter((x) => !x.fixed).map((x) => `${x.where}: ${x.message}`)
}
