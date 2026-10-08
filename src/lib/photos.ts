// Photo library. In the prototype these are crops of the client's mockups;
// in the MVP they come from user uploads, a stock API or an image model.
const files = import.meta.glob('../assets/photos/*.jpg', { eager: true, import: 'default' }) as Record<string, string>

export const PHOTOS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.jpg', ''), url]),
)

/** Focal point (object-position) per photo so tall/wide crops keep the subject. */
export const FOCUS: Record<string, string> = {
  'hair-portrait': '72% 35%',
  'hair-post': '62% 30%',
  'hair-tall': '50% 25%',
  'story-hair': '45% 30%',
  'hair-waves': '50% 50%',
  'hair-wash': '35% 50%',
  'story-wash': '50% 40%',
  'skin-tall': '40% 40%',
  'skin-post': '40% 40%',
  'skin-thumb': '50% 50%',
  'smile-tall': '45% 35%',
  'smile-thumb': '45% 40%',
  'story-smile': '50% 40%',
  transform: '70% 50%',
  beforeafter: '50% 50%',
  nails: '60% 50%',
  'nails-land': '60% 50%',
  products: '50% 60%',
  booking: '70% 40%',
  team: '50% 40%',
  gift: '50% 50%',
  gym: '78% 40%',
  food: '45% 55%',
  dental: '40% 40%',
  interior: '50% 60%',
  dog: '60% 40%',
  laptop: '55% 60%',
  coffee: '50% 40%',
  'laptop-story': '50% 50%',
}

export function photoUrl(id?: string) {
  if (!id) return undefined
  if (id.startsWith('data:') || id.startsWith('blob:')) return id
  return PHOTOS[id]
}

export function photoFocus(id?: string) {
  return (id && FOCUS[id]) || '50% 40%'
}
