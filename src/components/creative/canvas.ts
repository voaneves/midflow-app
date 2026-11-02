import type { Creative as CreativeT, PostFormat } from '../../lib/types'

/* Every creative is designed on a 1080-wide canvas and scaled to whatever size it is shown at,
   so thumbnails, the phone preview, the editor and the exported PNG are pixel-identical. */
export const BASE_W = 1080
export function baseHeight(kind: CreativeT['kind'], format: PostFormat) {
  if (kind === 'story') return 1920
  return format === '1:1' ? 1080 : 1350
}

/** Screen-reader description of a creative, e.g. "Story 3: Agende seu horário". */
export const creativeLabel = (c: CreativeT) => `${c.kind === 'story' ? 'Story' : 'Post'} ${c.order}: ${c.headline}`
