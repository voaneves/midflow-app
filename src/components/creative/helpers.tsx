import { Copy, Plus, Trash2 } from 'lucide-react'
import { copyText, slug, type ExportJob } from '../../lib/export'
import { currentLook, useApp } from '../../lib/store'
import { track } from '../../lib/telemetry'
import type { Creative as CreativeT, Palette, PostFormat, StyleId } from '../../lib/types'
import { toast, type MenuItem } from '../ui'
import type { BrandMark } from './Creative'

export type Look = { palette: Palette; style: StyleId; format: PostFormat; brand: BrandMark }

/** Current palette, style, format and brand mark of the creation flow. */
export function useLook(): Look {
  const style = useApp((s) => s.style)
  const briefing = useApp((s) => s.briefing)
  const brand = useApp((s) => s.brand)
  const { palette, style: st } = currentLook({ style, briefing })
  const mark: BrandMark = { name: brand.name, handle: brand.handle, logo: style.logo ?? brand.logo }
  return { palette, style: st, format: style.postFormat, brand: mark }
}

export const tileMenu = (o: { caption: string; onDuplicate?: () => void; onDelete?: () => void }): MenuItem[] =>
  [
    { label: 'Copiar legenda', icon: <Copy className="size-4" />, onClick: async () => void ((await copyText(o.caption)) && toast('Legenda copiada')) },
    o.onDuplicate && { label: 'Duplicar', icon: <Plus className="size-4" />, onClick: o.onDuplicate },
    o.onDelete && { label: 'Remover', icon: <Trash2 className="size-4" />, onClick: o.onDelete, danger: true },
  ].filter(Boolean) as MenuItem[]

/* ---------- Export (PNG / ZIP / native share) ----------
   The dialog lives in <ExportHost> (parts.tsx); it registers itself here when it mounts. */
let openExport: (jobs: ExportJob[]) => void = () => {}
export const setExportOpener = (fn: (jobs: ExportJob[]) => void) => {
  openExport = fn
}
export const exportCreatives = (jobs: ExportJob[]) => {
  track('download', { count: jobs.length, brandName: jobs[0]?.brand.name })
  openExport(jobs)
}

export function jobFor(c: CreativeT, look: Look, i: number, theme: string): ExportJob {
  const kind = c.kind === 'story' ? 'story' : 'post'
  return { creative: c, ...look, name: `${String(i + 1).padStart(2, '0')}-${kind}-${slug(theme || c.headline)}.png` }
}
