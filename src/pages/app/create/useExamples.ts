import { useMemo } from 'react'
import { segmentDef } from '../../../lib/data'
import { generate } from '../../../lib/generator'
import type { ObjectiveId, Palette, PostFormat, SegmentId, StyleId, ToneId } from '../../../lib/types'

/** Sample creatives for the live previews of the creation flow. */
export function useExamples(o: {
  segment: SegmentId | ''
  themeId?: string | null
  customTheme?: string
  objective?: ObjectiveId
  tones?: ToneId[]
  style: StyleId
  palette: Palette
  format?: PostFormat
  seed?: number
  brandName: string
  handle: string
  city: string
}) {
  const seg = (o.segment || 'beleza') as SegmentId
  const key = JSON.stringify([seg, o.themeId, o.customTheme, o.objective, o.tones, o.seed, o.brandName, o.city])
  return useMemo(() => {
    const def = segmentDef(seg)
    return generate(
      {
        segment: seg,
        themeId: o.themeId ?? def.themes[0].id,
        customTheme: o.customTheme,
        objective: o.objective ?? 'atrair',
        tones: o.tones?.length ? o.tones : ['profissional'],
        style: o.style,
        palette: o.palette,
        postFormat: o.format ?? '4:5',
        posts: true,
        stories: true,
        brandName: o.brandName,
        handle: o.handle,
        city: o.city,
        seed: 100 + (o.seed ?? 0),
      },
      1 + (o.seed ?? 0),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
