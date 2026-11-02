import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isEditorialPhotoId, selectEditorialPhotoId } from '../imageService.ts'

// Card texts deliberately mix keywords ("máscara", "produto") so the topic pool differs per card,
// which is what made two cards land on the same photo before.
const CARDS = [
  'Seu cabelo merece recuperação profunda',
  'Três passos para manter o cabelo saudável com máscara nutritiva',
  'Por que escolher o Studio Aurora',
  'Sua melhor versão começa pelos cabelos',
  'Enquete: qual o seu tipo de fio?',
  'Rotina home care com produto certo',
  'Hidratação que dura',
  'Agende seu horário',
]

for (const segment of ['beleza', 'alimentacao', 'fitness', 'servicos', 'pet']) {
  for (const baseSeed of [1, 98, 4321]) {
    test(`no repeated photo within posts or stories (${segment}, seed ${baseSeed})`, () => {
      const used = new Set<string>()
      const byKind = { post: new Set<string>(), story: new Set<string>() }
      const ids = CARDS.map((headline, i) => {
        const order = i + 1
        const kind = order <= 4 ? 'post' : 'story'
        const seed = baseSeed + order * (kind === 'post' ? 31 : 37)
        return selectEditorialPhotoId({ segment, themeId: 'cuidados-capilares', headline, order, seed, usedIds: used, usedSameKind: byKind[kind] })
      })
      const [posts, stories] = [ids.slice(0, 4), ids.slice(4)]
      assert.equal(new Set(posts).size, 4, `repeated feed photo: ${posts.join(', ')}`)
      assert.equal(new Set(stories).size, 4, `repeated story photo: ${stories.join(', ')}`)
      // With 8+ photos in the pool (beleza today), all 8 cards are different.
      if (segment === 'beleza') assert.equal(new Set(ids).size, 8, `repeated photo: ${ids.join(', ')}`)
      assert.ok(ids.every(isEditorialPhotoId))
    })
  }
}

test('only catalogued photo ids are accepted from the URL', () => {
  assert.equal(isEditorialPhotoId('photo-1560066984-138dadb4c035'), true)
  assert.equal(isEditorialPhotoId('photo-0000000000000-evil'), false)
  assert.equal(isEditorialPhotoId('../../etc/passwd'), false)
  assert.equal(isEditorialPhotoId(''), false)
  assert.equal(isEditorialPhotoId(null), false)
})
