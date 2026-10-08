import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowRight, BookOpen, Building2, Calendar, Check, CheckCircle2, Clock, Droplet, Flame, Gem, Gift, Heart, Home, Leaf,
  PawPrint, Quote, Scissors, Send, Shield, Smile, Sparkles, Star, Sun, TrendingUp, User, Utensils, Zap,
} from 'lucide-react'
import { alpha, luminance, mix, readableOn, saturation } from '../../lib/color'
import { photoFocus, photoUrl } from '../../lib/photos'
import type { Creative as CreativeT, Palette, PostFormat, StyleId } from '../../lib/types'

/* Every creative is designed on a 1080-wide canvas and scaled to whatever size it is shown at,
   so thumbnails, the phone preview, the editor and the exported PNG are pixel-identical. */
export const BASE_W = 1080
export function baseHeight(kind: CreativeT['kind'], format: PostFormat) {
  if (kind === 'story') return 1920
  return format === '1:1' ? 1080 : 1350
}

const ICONS: Record<string, typeof Sparkles> = {
  sparkles: Sparkles, droplet: Droplet, leaf: Leaf, zap: Zap, heart: Heart, shield: Shield, clock: Clock, star: Star,
  sun: Sun, home: Home, building: Building2, trending: TrendingUp, user: User, utensils: Utensils, flame: Flame,
  paw: PawPrint, smile: Smile, calendar: Calendar, gift: Gift, scissors: Scissors, gem: Gem, book: BookOpen, check: Check,
}

export interface BrandMark {
  name: string
  handle: string
  logo?: string
}

interface Props {
  c: CreativeT
  style: StyleId
  palette: Palette
  format: PostFormat
  brand: BrandMark
  /** px width; omit to fill the parent */
  width?: number
  /** Instagram story chrome (progress bars, reply bar). Off for exports. */
  chrome?: boolean
  className?: string
  rounded?: number
}

export function Creative({ c, style, palette, format, brand, width, chrome = true, className, rounded = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(width ?? 0)
  useEffect(() => {
    if (width) {
      setW(width)
      return
    }
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    setW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [width])

  const H = baseHeight(c.kind, format)
  const k = w / BASE_W
  return (
    <div
      ref={ref}
      className={className}
      style={{ width: width ?? '100%', aspectRatio: `${BASE_W} / ${H}`, position: 'relative', overflow: 'hidden', borderRadius: rounded, maxWidth: '100%' }}
    >
      {w > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: BASE_W, height: H, transform: `scale(${k})`, transformOrigin: '0 0' }}>
          <CreativeCanvas c={c} style={c.style ?? style} palette={c.palette ?? palette} H={H} brand={brand} chrome={chrome} />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

interface Look {
  mode: 'full' | 'split' | 'framed' | 'arch' | 'pop'
  bg: string
  ink: string
  muted: string
  accent: string
  head: CSSProperties
  hl: CSSProperties
  tag: CSSProperties
  cta: CSSProperties
  sub: CSSProperties
  align: 'left' | 'center'
}

const SERIF = "'Playfair Display', Georgia, serif"
const DMSERIF = "'DM Serif Display', Georgia, serif"
const SANS = "'Montserrat', 'Plus Jakarta Sans', sans-serif"
const BODY = "'DM Sans', 'Plus Jakarta Sans', sans-serif"

function vivid(p: Palette) {
  const cands = [p.accent, p.mid, p.soft].sort((a, b) => saturation(b) - saturation(a))
  const c = cands[0]
  const l = luminance(c)
  return l > 0.6 ? mix(c, p.dark, 0.25) : c
}

function lookFor(style: StyleId, p: Palette): Look {
  const lightInk = '#FFFFFF'
  switch (style) {
    case 'moderno':
      return {
        mode: 'full', bg: p.dark, ink: lightInk, muted: 'rgba(255,255,255,.82)', accent: p.soft, align: 'left',
        head: { fontFamily: SANS, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.02 },
        hl: { color: luminance(p.soft) > 0.25 ? p.soft : mix(p.soft, '#fff', 0.5) },
        tag: { background: p.accent, color: readableOn(p.accent), fontFamily: SANS, fontWeight: 700 },
        cta: { background: p.light, color: p.dark, fontFamily: SANS, fontWeight: 700 },
        sub: { fontFamily: BODY, fontWeight: 500 },
      }
    case 'premium':
      return {
        mode: 'full', bg: p.dark, ink: '#FFF8F2', muted: 'rgba(255,248,242,.8)', accent: p.soft, align: 'left',
        head: { fontFamily: SERIF, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.04 },
        hl: { fontStyle: 'italic', color: mix(p.soft, '#FFFFFF', 0.25) },
        tag: { background: 'transparent', color: '#FFF8F2', border: '2px solid rgba(255,248,242,.55)', fontFamily: BODY, fontWeight: 600 },
        cta: { background: mix(p.light, '#FFE9D6', 0.3), color: p.dark, fontFamily: BODY, fontWeight: 700 },
        sub: { fontFamily: BODY, fontWeight: 400 },
      }
    case 'elegante':
      return {
        mode: 'split', bg: p.light, ink: p.dark, muted: mix(p.dark, p.light, 0.3), accent: p.mid, align: 'center',
        head: { fontFamily: SERIF, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.05 },
        hl: { fontStyle: 'italic', color: mix(p.dark, p.accent, 0.35) },
        tag: { background: p.dark, color: p.light, fontFamily: BODY, fontWeight: 600 },
        cta: { background: p.dark, color: p.light, fontFamily: BODY, fontWeight: 700 },
        sub: { fontFamily: BODY, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em' },
      }
    case 'minimalista':
      return {
        mode: 'framed', bg: mix(p.light, '#FFFFFF', 0.5), ink: mix(p.dark, '#111', 0.3), muted: mix(p.dark, '#FFFFFF', 0.45), accent: p.accent, align: 'left',
        head: { fontFamily: BODY, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.06 },
        hl: { color: p.accent === p.light ? p.mid : mix(p.accent, p.dark, 0.2) },
        tag: { background: 'transparent', color: mix(p.dark, '#FFFFFF', 0.35), fontFamily: BODY, fontWeight: 600, padding: 0 },
        cta: { background: 'transparent', color: p.dark, fontFamily: BODY, fontWeight: 700, borderBottom: `4px solid ${p.dark}`, borderRadius: 0, padding: '6px 0' },
        sub: { fontFamily: BODY, fontWeight: 400 },
      }
    case 'colorido': {
      const bg = vivid(p)
      const ink = readableOn(bg, '#141414', '#FFFFFF')
      const marker = luminance(bg) > 0.45 ? p.dark : p.light
      return {
        mode: 'pop', bg, ink, muted: alpha(ink, 0.85), accent: marker, align: 'left',
        head: { fontFamily: SANS, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 0.98, textTransform: 'uppercase' },
        hl: { background: marker, color: readableOn(marker), padding: '0 14px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' },
        tag: { background: '#FFFFFF', color: '#141414', fontFamily: SANS, fontWeight: 800 },
        cta: { background: '#141414', color: '#FFFFFF', fontFamily: SANS, fontWeight: 800 },
        sub: { fontFamily: BODY, fontWeight: 600 },
      }
    }
    case 'natural':
    default:
      return {
        mode: 'arch', bg: mix(p.light, '#F6EFE3', 0.45), ink: mix(p.dark, '#3B2F25', 0.35), muted: mix(mix(p.dark, '#3B2F25', 0.35), '#F6EFE3', 0.35), accent: p.mid, align: 'center',
        head: { fontFamily: DMSERIF, fontWeight: 400, letterSpacing: '-0.005em', lineHeight: 1.04 },
        hl: { fontStyle: 'italic', color: mix(p.mid, p.dark, 0.25) },
        tag: { background: alpha(p.mid, 0.18), color: mix(p.dark, '#3B2F25', 0.3), fontFamily: BODY, fontWeight: 600 },
        cta: { background: mix(p.mid, p.dark, 0.25), color: '#FFFFFF', fontFamily: BODY, fontWeight: 700 },
        sub: { fontFamily: BODY, fontWeight: 400 },
      }
  }
}

function headSize(text: string, story: boolean, square: boolean, style: StyleId) {
  const n = text.length
  let s = n <= 18 ? 118 : n <= 30 ? 102 : n <= 44 ? 88 : n <= 60 ? 76 : 66
  if (style === 'minimalista') s *= 0.86
  if (style === 'colorido') s *= 0.92
  if (style === 'elegante' || style === 'natural') s *= 1.02
  if (square) s *= 0.86
  if (story) s *= 1.12
  return Math.round(s)
}

function Headline({ text, highlight, look, size }: { text: string; highlight?: string; look: Look; size: number }) {
  let parts: ReactNode = text
  if (highlight && text.includes(highlight)) {
    const i = text.indexOf(highlight)
    parts = (
      <>
        {text.slice(0, i)}
        <span style={look.hl}>{highlight}</span>
        {text.slice(i + highlight.length)}
      </>
    )
  }
  return (
    <h2 style={{ margin: 0, color: look.ink, fontSize: size, textAlign: look.align, textWrap: 'balance', ...look.head }}>{parts}</h2>
  )
}

function Tag({ text, look }: { text?: string; look: Look }) {
  if (!text) return null
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 26, textTransform: 'uppercase', letterSpacing: '0.14em', padding: '12px 24px', borderRadius: 999, ...look.tag }}
    >
      {text}
    </span>
  )
}

function Cta({ text, look }: { text: string; look: Look }) {
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 16, fontSize: 30, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '26px 44px', borderRadius: 999, whiteSpace: 'nowrap', ...look.cta }}
    >
      {text}
      <ArrowRight size={34} strokeWidth={2.5} />
    </span>
  )
}

function Photo({ id, style }: { id?: string; style?: CSSProperties }) {
  const url = photoUrl(id)
  if (!url) return <div style={{ background: 'linear-gradient(135deg,#d9e6e2,#b8cfc8)', ...style }} />
  return <img src={url} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: photoFocus(id), display: 'block', ...style }} />
}

function BrandCorner({ brand, look, light }: { brand: BrandMark; look: Look; light?: boolean }) {
  const color = light ? 'rgba(255,255,255,.92)' : look.ink
  if (brand.logo)
    return <img src={brand.logo} alt="" style={{ height: 72, maxWidth: 240, objectFit: 'contain', filter: light ? 'drop-shadow(0 2px 8px rgba(0,0,0,.35))' : undefined }} />
  return (
    <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 26, letterSpacing: '0.16em', textTransform: 'uppercase', color, opacity: 0.9 }}>
      {brand.name}
    </span>
  )
}

/* ---------- variant bodies ---------- */

function Body({ c, look, story }: { c: CreativeT; look: Look; story: boolean }) {
  const fs = story ? 38 : 34
  const center = look.align === 'center'
  const items: ReactNode[] = []
  if (c.sub && c.variant !== 'quote')
    items.push(
      <p key="sub" style={{ margin: 0, color: look.muted, fontSize: look.sub.textTransform === 'uppercase' ? fs * 0.78 : fs, lineHeight: 1.35, textAlign: look.align, ...look.sub }}>
        {c.sub}
      </p>,
    )
  if ((c.variant === 'list' || c.variant === 'offer') && c.bullets?.length)
    items.push(
      <div key="list" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: center ? 'center' : 'flex-start' }}>
        {c.bullets.map((b) => (
          <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 18, color: look.ink, fontFamily: BODY, fontSize: fs, fontWeight: 500 }}>
            <CheckCircle2 size={fs * 1.1} strokeWidth={2} color={look.ink} style={{ opacity: 0.9, flex: 'none' }} />
            {b}
          </div>
        ))}
      </div>,
    )
  if (c.variant === 'icons' && c.icons?.length)
    items.push(
      <div key="icons" style={{ display: 'flex', justifyContent: center ? 'center' : 'flex-start', gap: 0 }}>
        {c.icons.map((ic, i) => {
          const I = ICONS[ic.icon] ?? Sparkles
          return (
            <div
              key={ic.label}
              style={{ width: 230, display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start', gap: 14, padding: center ? '0 18px' : '0 30px 0 0', borderLeft: center && i > 0 ? `2px solid ${alpha(look.ink, 0.18)}` : undefined }}
            >
              <I size={58} strokeWidth={1.5} color={look.ink} />
              <span style={{ color: look.muted, fontFamily: BODY, fontSize: 25, lineHeight: 1.25, textAlign: center ? 'center' : 'left', fontWeight: 500 }}>{ic.label}</span>
            </div>
          )
        })}
      </div>,
    )
  if (c.variant === 'quote' && c.quote)
    items.push(
      <div key="q" style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: center ? 'center' : 'flex-start' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} size={38} fill="#F5B83D" color="#F5B83D" />
          ))}
        </div>
        <p style={{ margin: 0, color: look.ink, fontFamily: BODY, fontSize: fs * 1.05, lineHeight: 1.4, textAlign: look.align, fontWeight: 500 }}>
          <Quote size={36} style={{ display: 'inline', verticalAlign: '-4px', marginRight: 10, opacity: 0.6 }} />
          {c.quote.text}
        </p>
        <span style={{ color: look.muted, fontFamily: BODY, fontSize: fs * 0.82, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>— {c.quote.author}</span>
      </div>,
    )
  if (c.variant === 'poll' && c.poll)
    items.push(
      <div key="poll" style={{ display: 'flex', width: 720, maxWidth: '100%', background: '#FFFFFF', borderRadius: 28, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.25)', alignSelf: center ? 'center' : 'flex-start' }}>
        {c.poll.map((o, i) => (
          <div key={o} style={{ flex: 1, padding: '34px 10px', textAlign: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 38, color: i === 0 ? '#12B386' : '#1d1d1f', textTransform: 'uppercase', borderLeft: i ? '2px solid #e6e6e6' : undefined }}>
            {o}
          </div>
        ))}
      </div>,
    )
  return <>{items}</>
}

function PriceBlock({ c, look }: { c: CreativeT; look: Look }) {
  if (!c.price) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: look.align === 'center' ? 'center' : 'flex-start' }}>
      <span style={{ fontFamily: BODY, fontSize: 28, color: look.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
        {c.price.label} {c.price.old && <s style={{ opacity: 0.7, marginLeft: 8 }}>{c.price.old}</s>}
      </span>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: look.ink, fontFamily: SANS, fontWeight: 800, lineHeight: 0.9 }}>
        <span style={{ fontSize: 46, marginTop: 14 }}>R$</span>
        <span style={{ fontSize: 140, letterSpacing: '-0.04em' }}>{c.price.value}</span>
        {c.price.cents && <span style={{ fontSize: 56, marginTop: 14 }}>,{c.price.cents}</span>}
      </div>
    </div>
  )
}

function BeforeAfter({ c, inset, look }: { c: CreativeT; inset?: boolean; look: Look }) {
  const label = (t: string): CSSProperties => ({ position: 'absolute', bottom: inset ? 16 : 28, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.6)', color: '#fff', fontFamily: BODY, fontWeight: 700, fontSize: inset ? 20 : 28, letterSpacing: '0.12em', padding: inset ? '6px 14px' : '10px 22px', borderRadius: 999, ...(t ? {} : {}) })
  const src = c.photo2 ?? 'beforeafter'
  if (src === 'beforeafter')
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: inset ? 24 : 0, overflow: 'hidden', border: inset ? `6px solid ${look.bg === '#FFFFFF' ? '#eee' : '#fff'}` : undefined }}>
        <Photo id="beforeafter" />
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={label('a')}>ANTES</span>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={label('d')}>DEPOIS</span>
          </div>
        </div>
      </div>
    )
  return (
    <div style={{ display: 'flex', gap: 10, width: '100%', height: '100%' }}>
      {[c.photo, src].map((p, i) => (
        <div key={i} style={{ position: 'relative', flex: 1, borderRadius: 20, overflow: 'hidden', border: '5px solid #fff' }}>
          <Photo id={p} />
          <span style={label(i ? 'd' : 'a')}>{i ? 'DEPOIS' : 'ANTES'}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------- story chrome ---------- */

function StoryTop({ c, brand, light }: { c: CreativeT; brand: BrandMark; light: boolean }) {
  const col = light ? '#FFFFFF' : '#1d1d1f'
  return (
    <div style={{ position: 'absolute', top: 40, left: 40, right: 40, zIndex: 5 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, height: 8, borderRadius: 8, background: alpha(col, i <= c.order ? 0.95 : 0.35) }} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 28 }}>
        <div style={{ width: 72, height: 72, borderRadius: 99, background: 'linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)', padding: 4 }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 99, background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            {brand.logo ? <img src={brand.logo} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} /> : <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 30, color: '#111' }}>{brand.name.slice(0, 1)}</span>}
          </div>
        </div>
        <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 32, color: col }}>{brand.handle}</span>
        <span style={{ fontFamily: BODY, fontSize: 30, color: alpha(col, 0.7) }}>2 h</span>
      </div>
    </div>
  )
}

function StoryBottom({ light }: { light: boolean }) {
  const col = light ? '#FFFFFF' : '#1d1d1f'
  return (
    <div style={{ position: 'absolute', bottom: 50, left: 40, right: 40, display: 'flex', alignItems: 'center', gap: 26, zIndex: 5 }}>
      <div style={{ flex: 1, border: `3px solid ${alpha(col, 0.7)}`, borderRadius: 99, padding: '24px 36px', fontFamily: BODY, fontSize: 30, color: alpha(col, 0.9) }}>Enviar mensagem</div>
      <Heart size={54} color={col} strokeWidth={1.8} />
      <Send size={50} color={col} strokeWidth={1.8} />
    </div>
  )
}

/* ---------- main canvas ---------- */

export function CreativeCanvas({ c, style, palette, H, brand, chrome }: { c: CreativeT; style: StyleId; palette: Palette; H: number; brand: BrandMark; chrome: boolean }) {
  const look = lookFor(style, palette)
  const story = c.kind === 'story'
  const square = H === 1080
  const size = headSize(c.headline, story, square, style)
  const pad = story ? 80 : 76
  const showChrome = story && chrome
  const topSafe = showChrome ? 210 : pad
  const bottomSafe = showChrome ? 200 : pad
  const splitBA = c.variant === 'beforeafter' && c.photo === 'beforeafter'
  // dense bodies (lists, prices, quotes) get a smaller photo so text never collides with it
  const density = (c.bullets?.length ?? 0) + (c.icons ? 1.5 : 0) + (c.price ? 2.5 : 0) + (c.quote ? 2.5 : 0) + (c.headline.length > 36 ? 1 : 0)
  const shrink = density >= 4 ? 0.74 : density >= 2.5 ? 0.86 : 1

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: story ? 40 : 32, alignItems: look.align === 'center' ? 'center' : 'flex-start' }}>
      {look.mode === 'full' && c.tag && !story && <Tag text={c.tag} look={look} />}
      <Headline text={c.headline} highlight={c.highlight} look={look} size={size} />
      <Body c={c} look={look} story={story} />
      {c.variant === 'offer' && <PriceBlock c={c} look={look} />}
      {c.variant !== 'poll' && <div style={{ marginTop: 8 }}><Cta text={c.cta} look={look} /></div>}
    </div>
  )

  const baseStyle: CSSProperties = { position: 'absolute', inset: 0, background: look.bg, overflow: 'hidden', fontFamily: BODY }

  /* FULL: photo full-bleed with gradient (Moderno, Premium) */
  if (look.mode === 'full') {
    const light = true
    const fullH = story ? 0.66 : square ? 0.8 : 0.74
    return (
      <div style={baseStyle}>
        {/* photos are wider than the canvas: give them ~70% of the height so they aren't over-zoomed, then melt into the base color */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${fullH * 100}%` }}>{splitBA ? <BeforeAfter c={c} look={look} /> : <Photo id={c.photo} />}</div>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${alpha(look.bg, style === 'premium' ? 0.25 : 0.05)} 0%, ${alpha(look.bg, 0)} ${fullH * 28}%, ${alpha(look.bg, 0.5)} ${fullH * 62}%, ${alpha(look.bg, 0.93)} ${fullH * 86}%, ${look.bg} ${fullH * 100}%)` }} />
        {style === 'premium' && <div style={{ position: 'absolute', inset: 34, border: `2px solid ${alpha('#FFF8F2', 0.28)}`, borderRadius: 6, pointerEvents: 'none' }} />}
        {showChrome && <StoryTop c={c} brand={brand} light={light} />}
        {!story && (
          <div style={{ position: 'absolute', top: pad, right: pad }}>
            <BrandCorner brand={brand} look={look} light />
          </div>
        )}
        {story && c.tag && !showChrome && (
          <div style={{ position: 'absolute', top: pad, left: pad }}>
            <Tag text={c.tag} look={look} />
          </div>
        )}
        <div style={{ position: 'absolute', left: pad, right: pad, bottom: bottomSafe }}>
          {c.variant === 'beforeafter' && !splitBA && (
            <div style={{ width: 460, height: 300, marginBottom: 36 }}>
              <BeforeAfter c={c} inset look={look} />
            </div>
          )}
          {content}
        </div>
        {showChrome && <StoryBottom light />}
      </div>
    )
  }

  /* SPLIT: photo on top fading into a light panel (Elegante) */
  if (look.mode === 'split') {
    const photoH = (story ? 0.5 : square ? 0.44 : 0.48) * (shrink < 1 ? shrink + 0.06 : 1)
    return (
      <div style={baseStyle}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${photoH * 100 + 8}%` }}>
          {splitBA ? <BeforeAfter c={c} look={look} /> : <Photo id={c.photo} />}
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${alpha(look.bg, 0)} 55%, ${look.bg} 100%)` }} />
        </div>
        {showChrome && <StoryTop c={c} brand={brand} light />}
        {c.tag && !(c.variant === 'beforeafter' && !splitBA) && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: `calc(${photoH * 100}% - 30px)`, display: 'flex', justifyContent: 'center' }}>
            <Tag text={c.tag} look={look} />
          </div>
        )}
        {!story && (
          <div style={{ position: 'absolute', top: pad - 20, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <BrandCorner brand={brand} look={look} light />
          </div>
        )}
        <div style={{ position: 'absolute', left: pad, right: pad, top: `calc(${photoH * 100}% + 60px)`, bottom: bottomSafe, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {c.variant === 'beforeafter' && !splitBA && (
            <div style={{ width: 420, height: 230, margin: '0 auto 28px' }}>
              <BeforeAfter c={c} inset look={look} />
            </div>
          )}
          {content}
        </div>
        {showChrome && <StoryBottom light={false} />}
      </div>
    )
  }

  /* FRAMED: inset photo block, generous whitespace (Minimalista) */
  if (look.mode === 'framed') {
    const photoH = (story ? 0.46 : square ? 0.42 : 0.47) * shrink
    return (
      <div style={baseStyle}>
        {showChrome && <StoryTop c={c} brand={brand} light={false} />}
        <div style={{ position: 'absolute', left: pad, right: pad, top: topSafe, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!story ? <Tag text={c.tag} look={look} /> : <span />}
          {!story && <BrandCorner brand={brand} look={look} />}
        </div>
        <div style={{ position: 'absolute', left: pad, right: pad, top: topSafe + (story ? 0 : 80), height: `${photoH * 100}%`, borderRadius: 8, overflow: 'hidden' }}>
          {c.variant === 'beforeafter' ? <BeforeAfter c={{ ...c, photo2: c.photo2 ?? 'beforeafter' }} look={look} /> : <Photo id={c.photo} />}
        </div>
        <div style={{ position: 'absolute', left: pad, right: pad, bottom: bottomSafe, top: `calc(${topSafe + (story ? 0 : 80)}px + ${photoH * 100}% + 56px)`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {content}
        </div>
        {showChrome && <StoryBottom light={false} />}
      </div>
    )
  }

  /* POP: vivid color field, tilted photo card (Colorido) */
  if (look.mode === 'pop') {
    const photoH = (story ? 0.4 : square ? 0.4 : 0.42) * shrink
    const deco = luminance(look.bg) > 0.45 ? alpha('#000', 0.08) : alpha('#fff', 0.12)
    return (
      <div style={baseStyle}>
        <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: 999, background: deco, right: -380, top: -300 }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: 999, background: deco, left: -220, bottom: -160 }} />
        {showChrome && <StoryTop c={c} brand={brand} light={look.ink === '#FFFFFF'} />}
        <div style={{ position: 'absolute', right: pad, top: topSafe + 10, width: '62%', height: `${photoH * 100}%`, transform: 'rotate(3deg)', borderRadius: 36, overflow: 'hidden', border: '14px solid #FFFFFF', boxShadow: '0 30px 60px rgba(0,0,0,.25)' }}>
          {c.variant === 'beforeafter' ? <BeforeAfter c={{ ...c, photo2: c.photo2 ?? 'beforeafter' }} look={look} /> : <Photo id={c.photo} />}
        </div>
        {c.tag && (
          <div style={{ position: 'absolute', left: pad, top: topSafe + 40, width: 230, height: 230, borderRadius: 999, background: '#FFFFFF', display: 'grid', placeItems: 'center', transform: 'rotate(-10deg)', boxShadow: '0 16px 40px rgba(0,0,0,.18)', textAlign: 'center', padding: 24 }}>
            <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: c.tag.length > 10 ? 30 : 38, textTransform: 'uppercase', color: '#141414', lineHeight: 1.05 }}>{c.tag}</span>
          </div>
        )}
        {!story && (
          <div style={{ position: 'absolute', right: pad, bottom: pad + 22 }}>
            <BrandCorner brand={brand} look={look} light={look.ink === '#FFFFFF'} />
          </div>
        )}
        <div style={{ position: 'absolute', left: pad, right: pad, bottom: bottomSafe }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: story ? 40 : 30 }}>
            <Headline text={c.headline} highlight={c.highlight} look={look} size={size} />
            <Body c={c} look={look} story={story} />
            {c.variant === 'offer' && <PriceBlock c={c} look={look} />}
            {c.variant !== 'poll' && <div><Cta text={c.cta} look={look} /></div>}
          </div>
        </div>
        {showChrome && <StoryBottom light={look.ink === '#FFFFFF'} />}
      </div>
    )
  }

  /* ARCH: soft cream, arched photo (Natural) */
  const archW = (story ? 760 : square ? 560 : 640) * (shrink < 1 ? 0.92 : 1)
  const archH = (story ? 820 : square ? 440 : 600) * shrink
  return (
    <div style={baseStyle}>
      <div style={{ position: 'absolute', width: 340, height: 340, borderRadius: 999, background: alpha(look.accent, 0.14), left: -120, top: H * 0.38 }} />
      <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: 999, background: alpha(look.accent, 0.12), right: -80, top: H * 0.08 }} />
      {showChrome && <StoryTop c={c} brand={brand} light={false} />}
      {!story && (
        <div style={{ position: 'absolute', top: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <BrandCorner brand={brand} look={look} />
        </div>
      )}
      <div style={{ position: 'absolute', left: (BASE_W - archW) / 2, top: topSafe + (story ? 10 : 50), width: archW, height: archH, borderRadius: `${archW / 2}px ${archW / 2}px 28px 28px`, overflow: 'hidden', boxShadow: '0 20px 50px rgba(60,40,20,.15)' }}>
        {c.variant === 'beforeafter' ? <BeforeAfter c={{ ...c, photo2: c.photo2 ?? 'beforeafter' }} look={look} /> : <Photo id={c.photo} />}
      </div>
      {c.tag && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: topSafe + (story ? 10 : 50) + archH - 30, display: 'flex', justifyContent: 'center' }}>
          <Tag text={c.tag} look={{ ...look, tag: { ...look.tag, background: look.bg, border: `2px solid ${alpha(look.accent, 0.5)}` } }} />
        </div>
      )}
      <div style={{ position: 'absolute', left: pad, right: pad, top: topSafe + (story ? 10 : 50) + archH + 50, bottom: bottomSafe, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {content}
      </div>
      {showChrome && <StoryBottom light={false} />}
    </div>
  )
}
