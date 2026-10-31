// Quick check of AI images:  npm run check:image
import fs from 'fs'
fs.mkdirSync('server/data', { recursive: true })
import { generateAIImage, imageHealth } from '../ai/image.ts'
import { config, imageModelName } from '../config.ts'
console.log(`Provedor de imagem: ${config.image.provider} | modelo: ${imageModelName()}`)
const t0 = Date.now()
const img = await generateAIImage('a bowl of fresh handmade Italian pasta with tomato sauce on a rustic wooden table in a cozy restaurant', 'post')
if (img) {
  const out = `server/data/teste-imagem.${img.mimeType.includes('png') ? 'png' : 'jpg'}`
  fs.writeFileSync(out, img.buffer)
  console.log(`OK — ${Math.round(img.buffer.length / 1024)} KB em ${Date.now() - t0} ms → ${out}`)
} else console.log(`FALHOU: ${imageHealth.lastError}`)
