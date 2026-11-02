import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { config } from '../config.ts'
import { fetchStockPhoto, isPixabayImageUrl, stockQuery } from '../pixabay.ts'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  config.image.pixabayKey = ''
})

test('search query: first sentence of the image prompt, a few words, no style text', () => {
  const q = stockQuery('A hairdresser applying a nourishing mask to long wavy hair in a bright salon. Main subject centered. Style: editorial photography, 85mm', 'beleza')
  assert.equal(q, 'hairdresser applying nourishing mask')
  assert.ok(!/style|85mm/i.test(q))
})

test('search query falls back to the segment when the prompt is empty', () => {
  assert.equal(stockQuery('', 'pet'), 'dog grooming')
  assert.equal(stockQuery(undefined, 'unknown-segment'), 'small business')
})

test('only Pixabay hosts over https are downloaded', () => {
  assert.equal(isPixabayImageUrl('https://pixabay.com/get/abc_1280.jpg'), true)
  assert.equal(isPixabayImageUrl('https://cdn.pixabay.com/photo/2020/01/01/a_1280.jpg'), true)
  assert.equal(isPixabayImageUrl('http://pixabay.com/get/abc.jpg'), false)
  assert.equal(isPixabayImageUrl('https://evil.example/pixabay.com.jpg'), false)
  assert.equal(isPixabayImageUrl('http://169.254.169.254/latest'), false)
})

test('no key → no request, returns null', async () => {
  let called = false
  globalThis.fetch = (async () => {
    called = true
    return new Response('')
  }) as typeof fetch
  assert.equal(await fetchStockPhoto({ prompt: 'salon', segment: 'beleza' }), null)
  assert.equal(called, false)
})

test('searches, picks a Pixabay photo, downloads it, returns the credit', async () => {
  config.image.pixabayKey = 'test-key'
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(8000, 7)])
  const calls: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    if (url.startsWith('https://pixabay.com/api/')) {
      assert.equal(new URL(url).searchParams.get('key'), 'test-key')
      return Response.json({
        hits: [
          { user: 'Ana', largeImageURL: 'https://pixabay.com/get/a_1280.jpg' },
          { user: 'Bad', largeImageURL: 'https://evil.example/b.jpg' }, // dropped
        ],
      })
    }
    return new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } })
  }) as typeof fetch

  const photo = await fetchStockPhoto({ prompt: 'Coffee shop barista pouring latte art', segment: 'alimentacao', kind: 'story', order: 2, seed: 5 })
  assert.ok(photo)
  assert.equal(photo.credit, 'Ana / Pixabay')
  assert.equal(photo.mimeType, 'image/jpeg')
  assert.match(calls[0], /orientation=vertical/)
  assert.match(calls[0], /safesearch=true/)
  assert.equal(calls[1], 'https://pixabay.com/get/a_1280.jpg')
  assert.ok(!calls.some((c) => c.includes('evil.example')))
})
