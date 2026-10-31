import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCloudflareImage } from '../ai/image.ts'

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5000, 1)])
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(5000, 1)])

test('flux-style JSON response (base64 image)', async () => {
  const res = new Response(JSON.stringify({ success: true, result: { image: jpeg.toString('base64') } }), {
    headers: { 'content-type': 'application/json' },
  })
  const r = await parseCloudflareImage(res)
  assert.ok(!('error' in r))
  assert.equal(r.mimeType, 'image/jpeg')
  assert.equal(r.buffer.length, jpeg.length)
})

test('raw PNG response (stable diffusion style)', async () => {
  const r = await parseCloudflareImage(new Response(png, { headers: { 'content-type': 'image/png' } }))
  assert.ok(!('error' in r))
  assert.equal(r.mimeType, 'image/png')
})

test('error response is reported, not thrown', async () => {
  const res = new Response(JSON.stringify({ success: false, errors: [{ message: 'Capacity temporarily exceeded' }] }), {
    headers: { 'content-type': 'application/json' },
  })
  const r = await parseCloudflareImage(res)
  assert.deepEqual(r, { error: 'Capacity temporarily exceeded' })
})

test('tiny/empty image is rejected', async () => {
  const res = new Response(JSON.stringify({ result: { image: Buffer.alloc(10).toString('base64') } }), {
    headers: { 'content-type': 'application/json' },
  })
  assert.ok('error' in (await parseCloudflareImage(res)))
})
