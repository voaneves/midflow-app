/**
 * Client-side image preparation for uploads. Logos and photos are stored as data URLs inside brand, library and
 * generation data that also syncs to the cloud, so they are downscaled and re-encoded before they are kept.
 * Everything stays a same-origin data URL, so the canvas is never tainted and PNG export (html-to-image) keeps working.
 */

/** Logos are shown small (a corner mark); 1024 px is plenty even at 2x on a 1080 px creative. */
export const LOGO_MAX_SIDE = 1024
/**
 * Photos fill the whole creative. Stories are 1080x1920 and the photo is cover-fitted, so a portrait photo needs 1920 px
 * on its long side to be shown 1:1 in the exported PNG; 1350 px (the tallest feed post) would be upscaled ~1.4x there.
 */
export const PHOTO_MAX_SIDE = 1920
/** Encoded size target; quality, then dimensions, are lowered in steps until it fits. */
export const TARGET_BYTES = 1024 * 1024
/** Raw upload ceilings checked before decoding. */
export const MAX_LOGO_BYTES = 5 * 1024 * 1024
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024
/** Vector logos are stored untouched, so they get a tighter limit. */
export const MAX_SVG_BYTES = 1024 * 1024

/** An upload problem with a pt-BR message that is safe to show as is. */
export class ImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageError'
  }
}

/** Size that fits `w`x`h` inside a `max` px square, never enlarging. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

const readAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> => new Promise((res) => canvas.toBlob(res, type, quality))

/** Decodes with EXIF orientation applied (phones save portrait photos rotated via metadata). */
async function decode(file: File): Promise<{ source: CanvasImageSource; w: number; h: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() }
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return { source: img, w: img.naturalWidth, h: img.naturalHeight, close: () => {} }
    } catch {
      throw new ImageError('Não foi possível ler essa imagem. Tente outro arquivo (PNG, JPG ou WebP).')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const px = ctx.getImageData(0, 0, w, h).data
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) return true
  return false
}

interface EncodeOptions {
  maxSide: number
  /** Keep transparency (PNG) when the image uses it; otherwise encode as `lossy`. */
  keepAlpha: boolean
  lossy: 'image/jpeg' | 'image/webp'
  quality: number
}

async function downscale(file: File, o: EncodeOptions): Promise<string> {
  const img = await decode(file)
  try {
    let side = o.maxSide
    let quality = o.quality
    let best: Blob | null = null
    // Up to 4 attempts: full size at the wanted quality, then lower quality, then smaller dimensions.
    for (let attempt = 0; attempt < 4; attempt++) {
      const { w, h } = fitWithin(img.w, img.h, side)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: o.keepAlpha })
      if (!ctx) throw new ImageError('Seu navegador não conseguiu preparar a imagem.')
      ctx.imageSmoothingQuality = 'high'
      let alpha = false
      if (o.keepAlpha) {
        ctx.drawImage(img.source, 0, 0, w, h)
        alpha = hasTransparency(ctx, w, h)
      } else {
        // Opaque output: paint white first so transparent areas do not turn black.
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img.source, 0, 0, w, h)
      }
      if (alpha) {
        const png = await toBlob(canvas, 'image/png')
        if (png) best = png
        if (png && png.size <= TARGET_BYTES) break
        side = Math.round(side * 0.75)
        continue
      }
      let blob = await toBlob(canvas, o.lossy, quality)
      // Browsers that cannot encode WebP silently return PNG; use JPEG instead.
      if (!blob || blob.type !== o.lossy) blob = await toBlob(canvas, 'image/jpeg', quality)
      if (blob) best = blob
      if (blob && blob.size <= TARGET_BYTES) break
      if (attempt === 0) quality = Math.max(0.6, quality - 0.1)
      else side = Math.round(side * 0.8)
    }
    if (!best) throw new ImageError('Não foi possível preparar essa imagem. Tente outro arquivo.')
    return await readAsDataUrl(best)
  } finally {
    img.close()
  }
}

/**
 * Logo → data URL, longest side <= 1024 px. SVG is kept as vector. PNG is kept when it really uses transparency,
 * otherwise the logo is stored as WebP (JPEG where WebP encoding is missing).
 */
export async function prepareLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ImageError('Envie uma imagem (PNG, SVG, JPG ou WebP).')
  if (file.size > MAX_LOGO_BYTES) throw new ImageError('O arquivo passa de 5 MB.')
  if (file.type === 'image/svg+xml') {
    if (file.size > MAX_SVG_BYTES) throw new ImageError('Esse SVG é pesado demais. Exporte um SVG mais simples ou envie um PNG.')
    return readAsDataUrl(file)
  }
  return downscale(file, { maxSide: LOGO_MAX_SIDE, keepAlpha: true, lossy: 'image/webp', quality: 0.9 })
}

/** Photo → JPEG data URL (quality 0.85), longest side <= 1920 px, aiming at <= 1 MB. */
export async function preparePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ImageError('Envie uma imagem (JPG, PNG ou WebP).')
  if (file.size > MAX_PHOTO_BYTES) throw new ImageError('A foto passa de 20 MB.')
  return downscale(file, { maxSide: PHOTO_MAX_SIDE, keepAlpha: false, lossy: 'image/jpeg', quality: 0.85 })
}
