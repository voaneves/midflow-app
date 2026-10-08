import type { Palette, SegmentId, StyleId } from './types'
import { segmentDef } from './data'

type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [0, 0, 0]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: RGB) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function isHex(v: string) {
  return /^#?[0-9a-fA-F]{6}$/.test(v.trim()) || /^#?[0-9a-fA-F]{3}$/.test(v.trim())
}

export function normalizeHex(v: string) {
  const s = v.trim().replace('#', '')
  return rgbToHex(hexToRgb('#' + s))
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function saturation(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2
  return (max - min) / (1 - Math.abs(2 * l - 1))
}

export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t])
}

export function alpha(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

export function readableOn(bg: string, dark = '#141414', light = '#FFFFFF') {
  return luminance(bg) > 0.45 ? dark : light
}

/** Turn 1–5 brand colors into a role-based palette the templates can rely on. */
export function derivePalette(colors: string[]): Palette {
  const list = colors.filter(isHex).map(normalizeHex)
  if (list.length === 0) return derivePalette(['#0B4D3D', '#12B386', '#A8EAD5', '#F3F7F6'])
  const byLum = [...list].sort((a, b) => luminance(a) - luminance(b))
  let dark = byLum[0]
  let light = byLum[byLum.length - 1]
  if (luminance(dark) > 0.12) dark = mix(dark, '#0E0E10', 0.65)
  if (luminance(light) < 0.75) light = mix(light, '#FFFFFF', 0.82)
  const middles = byLum.slice(1, -1)
  const accent =
    [...list].filter((c) => c !== byLum[0] && c !== byLum[byLum.length - 1]).sort((a, b) => saturation(b) - saturation(a))[0] ??
    (list.length === 1 ? mix(list[0], '#FFFFFF', 0.35) : mix(dark, light, 0.45))
  const mid = middles[0] ?? mix(dark, accent, 0.5)
  const soft = middles[middles.length - 1] && middles.length > 1 ? middles[middles.length - 1] : mix(accent, '#FFFFFF', 0.6)
  return { dark, mid, soft, light, accent }
}

/** "Estilo sugerido pela IA": segment palette, nudged by the chosen style. */
export function suggestedColors(segment: SegmentId | '' | undefined, style: StyleId): string[] {
  const base = segmentDef(segment || 'outro').palette
  switch (style) {
    case 'colorido':
      return [base[0], base[1], base[2], '#FFFFFF']
    case 'minimalista':
      return [base[0], mix(base[1], '#FFFFFF', 0.3), '#EDEDED', '#FFFFFF']
    case 'natural':
      return [mix(base[0], '#5B4B3A', 0.4), mix(base[1], '#C8B79E', 0.4), '#E8DFD1', '#F8F4EC']
    default:
      return base
  }
}
