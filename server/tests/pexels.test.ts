import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { config } from '../config.ts'
import { fetchPexelsPhoto, isPexelsImageUrl, pexelsQuery } from '../pexels.ts'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  config.image.pexelsKey = ''
})

test('search query: first sentence of the image prompt, a few words, no style text', () => {
  const q = pexelsQuery('A hairdresser applying a nourishing mask to long wavy hair in a bright salon. Main subject centered. Style: editorial photography, 85mm', 'beleza')
  assert.equal(q, 'hairdresser applying nourishing mask long wavy hair')
  assert.ok(!/style|85mm/i.test(q))
})

test('search query falls back to the segment when the prompt is empty', () => {
  assert.equal(pexelsQuery('', 'pet'), 'dog grooming pet shop')
  assert.equal(pexelsQuery(undefined, 'unknown-segment'), 'small business')
})

test('only images.pexels.com over https is downloaded', () => {
  assert.equal(isPexelsImageUrl('https://images.pexels.com/photos/1/pexels-photo-1.jpeg'), true)
  assert.equal(isPexelsImageUrl('http://images.pexels.com/photos/1.jpeg'), false)
  assert.equal(isPexelsImageUrl('https://evil.example/images.pexels.com.jpg'), false)
  assert.equal(isPexelsImageUrl('http://169.254.169.254/latest'), false)
})

test('no key → no request, returns null', async () => {
  let called = false
  globalThis.fetch = (async () => {
    called = true
    return new Response('')
  }) as typeof fetch
  assert.equal(await fetchPexelsPhoto({ prompt: 'salon', segment: 'beleza' }), null)
  assert.equal(called, false)
})

test('searches, picks a Pexels photo, downloads it cropped, returns the credit', async () => {
  config.image.pexelsKey = 'test-key'
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(8000, 7)])
  const calls: string[] = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    if (url.startsWith('https://api.pexels.com/')) {
      assert.equal((init?.headers as Record<string, string> | undefined)?.Authorization, 'test-key')
      return Response.json({
        photos: [
          { photographer: 'Ana', src: { original: 'https://images.pexels.com/photos/1/a.jpeg' } },
          { photographer: 'Bad', src: { original: 'https://evil.example/b.jpeg' } }, // dropped
        ],
      })
    }
    return new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } })
  }) as typeof fetch

  const photo = await fetchPexelsPhoto({ prompt: 'Coffee shop barista pouring latte art', segment: 'alimentacao', kind: 'story', order: 2, seed: 5 })
  assert.ok(photo)
  assert.equal(photo.credit, 'Ana / Pexels')
  assert.equal(photo.mimeType, 'image/jpeg')
  assert.match(calls[0], /orientation=portrait/)
  assert.match(calls[1], /^https:\/\/images\.pexels\.com\/photos\/1\/a\.jpeg\?.*h=1920/)
  assert.ok(!calls.some((c) => c.includes('evil.example')))
})
