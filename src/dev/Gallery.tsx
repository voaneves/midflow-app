import { Creative } from '../components/creative/Creative'
import { derivePalette } from '../lib/color'
import { STYLES } from '../lib/data'
import { generate } from '../lib/generator'

export default function Gallery() {
  const colors = new URLSearchParams(location.hash.split('?')[1] ?? '').get('c')?.split(',').map((x) => '#' + x) ?? ['#5A1428', '#C98B8B', '#F5C9D6', '#F4EADF']
  const seg = (new URLSearchParams(location.hash.split('?')[1] ?? '').get('s') ?? 'beleza') as any
  const palette = derivePalette(colors)
  const g = generate({ segment: seg, themeId: seg === 'beleza' ? 'cabelo' : 'x', objective: 'atrair', tones: ['profissional'], style: 'premium', palette, postFormat: '4:5', posts: true, stories: true, brandName: 'Studio Aurora', handle: 'studioaurora', city: 'Palmas - TO', seed: 3 }, 1)
  return (
    <div style={{ padding: 20, display: 'grid', gap: 24 }}>
      {STYLES.map((s) => (
        <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <b style={{ width: 90 }}>{s.id}</b>
          {g.posts.map((c) => <Creative key={c.id} c={c} style={s.id} palette={palette} format="4:5" brand={{ name: 'Studio Aurora', handle: 'studioaurora' }} width={220} />)}
          {g.stories.map((c) => <Creative key={c.id} c={c} style={s.id} palette={palette} format="4:5" brand={{ name: 'Studio Aurora', handle: 'studioaurora' }} width={150} />)}
        </div>
      ))}
    </div>
  )
}
