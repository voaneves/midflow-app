import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { toPng } from 'html-to-image'
import JSZip from 'jszip'
import { BASE_W, baseHeight, CreativeCanvas, type BrandMark } from '../components/creative/Creative'
import type { Creative, Palette, PostFormat, StyleId } from './types'

export interface ExportJob {
  creative: Creative
  style: StyleId
  palette: Palette
  format: PostFormat
  brand: BrandMark
  name: string
}

/** Renders a creative off-screen at full resolution (1080 px wide) and returns a PNG data URL. */
export async function renderPng(job: ExportJob): Promise<string> {
  const H = baseHeight(job.creative.kind, job.format)
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${BASE_W}px;height:${H}px;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(
        createElement(
          'div',
          { style: { position: 'relative', width: BASE_W, height: H } },
          createElement(CreativeCanvas, {
            c: job.creative,
            style: job.creative.style ?? job.style,
            palette: job.creative.palette ?? job.palette,
            H,
            brand: job.brand,
            chrome: false,
          }),
        ),
    )
    await new Promise((r) => setTimeout(r, 60))
    await Promise.all(Array.from(host.querySelectorAll('img')).map((img) => img.decode().catch(() => undefined)))
    await document.fonts?.ready
    const node = host.firstElementChild as HTMLElement
    return await toPng(node, { width: BASE_W, height: H, pixelRatio: 1, cacheBust: false })
  } finally {
    root.unmount()
    host.remove()
  }
}

export async function makeZip(files: { name: string; dataUrl: string }[]) {
  const zip = new JSZip()
  for (const f of files) zip.file(f.name, f.dataUrl.split(',')[1], { base64: true })
  return zip.generateAsync({ type: 'blob' })
}

export function dataUrlToBlob(dataUrl: string) {
  const [meta, b64] = dataUrl.split(',')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: meta.split(':')[1]?.split(';')[0] ?? 'application/octet-stream' })
}

type DownloadsNs = { save: (r: { filename: string; data: Blob }) => Promise<{ status: string }> }
type ClaudeHost = { use?: (name: string) => Promise<unknown> }

/**
 * Saves a file. Inside the claude.ai artifact viewer the page can't download directly,
 * so it goes through the viewer's `downloads` capability (the viewer confirms the save);
 * everywhere else (local dev, any static host) it is a normal browser download.
 * Resolves to 'saved' | 'declined' | 'failed'.
 */
export async function saveFile(filename: string, data: Blob): Promise<'saved' | 'declined' | 'failed'> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  if (host?.use) {
    const downloads = (await host.use('downloads').catch(() => null)) as DownloadsNs | null
    if (downloads) {
      try {
        await downloads.save({ filename, data })
        return 'saved'
      } catch (e) {
        return (e as { code?: string })?.code === 'declined' ? 'declined' : 'failed'
      }
    }
  }
  const url = URL.createObjectURL(data)
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return 'saved'
}

export function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
