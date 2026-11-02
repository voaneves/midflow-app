/// <reference lib="dom" />
/**
 * Builds the example photo library (src/assets/photos/*.jpg) with Cloudflare Workers AI.
 * These photos illustrate previews, the offline template engine and the composed-artwork fallback.
 *
 *   npm run photos:generate              → only missing files
 *   npm run photos:generate -- --force   → regenerate all
 *   npm run photos:generate -- gym dog   → only these ids (always regenerated)
 *
 * Needs CF_AI_ACCOUNT_ID + CF_AI_TOKEN in .env. ~77 neurons per image (free daily allowance: 10,000).
 * Resizing/encoding runs in Playwright's Chromium (no native image library in the project).
 */
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { parseCloudflareImage } from '../ai/image.ts'
import { config } from '../config.ts'

const OUT = path.resolve('src/assets/photos')
const STYLE = 'Professional editorial photograph for a small business Instagram post in Brazil, natural soft light, realistic, sharp focus, no text, no letters, no logos, no watermark.'

/** id → subject. Ids already used by the app keep their names, so references stay valid. */
export const EXAMPLE_PHOTOS: Record<string, string> = {
  // Beleza
  'hair-portrait': 'Portrait of a smiling Brazilian woman with long healthy glossy wavy brown hair in a bright beauty salon',
  'hair-post': 'Hairdresser blow-drying the long hair of a client in a modern beauty salon, mirror and warm lights',
  'hair-tall': 'Woman touching her long shiny straight dark hair, close-up from behind, salon background softly blurred',
  'hair-waves': 'Close-up of soft defined caramel hair waves with healthy shine',
  'hair-wash': 'Client relaxing at a salon backwash basin while a professional washes her hair with foam',
  'story-hair': 'Hairstylist applying a nourishing treatment cream to long hair with a brush in a salon',
  'story-wash': 'Scalp massage during hair washing at a spa salon, calm atmosphere',
  'skin-tall': 'Aesthetician doing a facial cleansing treatment on a relaxed woman lying on a spa bed',
  'skin-post': 'Woman with glowing healthy skin applying serum with a dropper, bathroom with plants',
  'skin-thumb': 'Skincare products, serum bottles and cream jars on a marble surface with soft shadows',
  'smile-tall': 'Happy confident Brazilian woman smiling after a salon visit, natural light, salon blurred behind',
  'smile-thumb': 'Two friends laughing in a bright beauty salon waiting area',
  'story-smile': 'Satisfied client looking at herself in the salon mirror and smiling',
  'nails': 'Manicurist painting a client nails with nude polish, close-up of hands on a towel',
  'nails-land': 'Elegant hands with fresh almond shaped pink manicure holding a coffee cup',
  'products': 'Professional hair care products, shampoo and mask bottles arranged on a salon shelf',
  'transform': 'Woman with a new elegant shoulder length haircut turning her head, movement in the hair',
  'beforeafter': 'Hairdresser finishing a styling with a round brush, client with smooth shiny hair, salon chair',
  'booking': 'Salon receptionist scheduling an appointment on a tablet at a clean reception desk',
  'team': 'Friendly team of three beauty professionals in black uniforms smiling inside a modern salon',
  'gift': 'Gift box with ribbon and a voucher card next to beauty products, soft pastel background',
  // Alimentação
  'food': 'Plate of Brazilian homemade lunch, rice, beans, grilled chicken and salad on a rustic wooden table',
  'coffee': 'Barista pouring latte art into a cup in a cozy coffee shop',
  'food-burger': 'Gourmet burger with fries on a wooden board in a casual restaurant',
  'food-kitchen': 'Chef plating a dish in a clean restaurant kitchen, steam and warm light',
  'food-table': 'Friends sharing a meal at a restaurant table, hands passing dishes, warm evening light',
  'food-dessert': 'Slice of chocolate cake and coffee on a cafe table by the window',
  'food-delivery': 'Plain unbranded brown paper bag and plain kraft takeaway boxes on a counter ready for pickup',
  // Fitness
  'gym': 'Modern gym with plain unbranded black dumbbells and weight machines, large windows, morning light',
  'gym-training': 'Woman doing a dumbbell workout with focus in a bright gym',
  'gym-functional': 'Group functional training class with kettlebells in a gym studio',
  'gym-coach': 'Personal trainer guiding a man doing squats, friendly attitude',
  'gym-results': 'Fit happy woman resting after workout holding a water bottle, smiling',
  'gym-challenge': 'Runner tying sneakers before a workout, close-up, energetic mood',
  // Saúde
  'dental': 'Dentist examining a smiling patient in a modern bright dental clinic',
  'dental-smile': 'Close-up of a woman with a healthy white natural smile',
  'dental-care': 'Toothbrush, dental floss and toothpaste on a clean bathroom sink',
  'dental-consult': 'Dentist explaining a treatment to a patient using a tablet in the clinic office',
  'dental-tech': 'Modern dental equipment and chair in a clean clinic room, soft blue light',
  'dental-team': 'Friendly dental clinic team smiling at the reception',
  // Imóveis
  'interior': 'Bright modern apartment living room with sofa, plants and large windows',
  'home-keys': 'Hand giving house keys to a happy couple at the door of a new home',
  'home-facade': 'Modern residential house facade with garden on a sunny day',
  'home-kitchen': 'Clean modern kitchen with island and natural light in a new apartment',
  'home-agent': 'Real estate agent showing an apartment to a young couple',
  'home-building': 'New residential building with balconies against a blue sky',
  // Pet
  'dog': 'Happy golden dog smiling at a pet shop, bright and clean',
  'pet-grooming': 'Groomer drying a fluffy small white dog after a bath on a grooming table',
  'pet-cat': 'Cute cat resting on a soft blanket at home, window light',
  'pet-vet': 'Veterinarian examining a calm puppy on a clinic table',
  'pet-play': 'Two dogs playing with a ball on green grass',
  'pet-products': 'Pet food bowls, toys and treats arranged on a shelf in a pet store',
  // Serviços / outros
  'laptop': 'Small business owner working on a laptop at a tidy desk with coffee and notebook',
  'laptop-story': 'Hands typing on a laptop with charts on the screen, vertical composition',
  'office-meeting': 'Consultant meeting with a client at a bright office table, notebook and coffee',
  'office-tools': 'Desk with tablet, planner and phone organized for productivity, top view',
  'office-team': 'Small business team of four collaborating around a table with sticky notes in a bright office',
  'office-client': 'Professional shaking hands with a satisfied client in a modern office',
  // Moda
  'fashion-rack': 'Clothing rack with colorful new collection in a small boutique',
  'fashion-look': 'Woman wearing a stylish casual outfit walking on a city street',
  'fashion-store': 'Boutique owner folding clothes at the counter of a cozy clothing store',
  'fashion-detail': 'Close-up of accessories, handbag, sunglasses and jewelry on a table',
  'fashion-client': 'Happy woman leaving a boutique holding plain unbranded shopping bags',
  'fashion-atelier': 'Seamstress adjusting a dress on a mannequin in a small fashion atelier',
  // Estilos visuais (etapa Estilo)
  'st-moderno': 'Modern minimal beauty salon interior with bold geometric lighting',
  'st-minimal': 'Minimalist white interior with a single plant and lots of empty space',
  'st-elegante': 'Elegant luxury interior with velvet chair, gold details and soft light',
  'st-colorido': 'Colorful vibrant flat lay of products with bright pink and yellow background',
  'st-natural': 'Natural organic flat lay with leaves, wood and linen, earthy tones',
  'st-premium': 'Premium dark interior with marble, dramatic lighting and black accents',
}

const SIZE: Record<string, number> = { 'st-moderno': 400, 'st-minimal': 400, 'st-elegante': 400, 'st-colorido': 400, 'st-natural': 400, 'st-premium': 400 }

async function generate(id: string, subject: string): Promise<Buffer> {
  const { cfAccountId, cfApiToken, cfModel } = config.image
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfAccountId)}/ai/run/${cfModel}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfApiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: `${subject}. ${STYLE}`, steps: 8 }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`${id}: Cloudflare ${res.status} ${(await res.text()).slice(0, 200)}`)
  const parsed = await parseCloudflareImage(res)
  if ('error' in parsed) throw new Error(`${id}: ${parsed.error}`)
  return parsed.buffer
}

async function main() {
  if (!config.image.cfAccountId || !config.image.cfApiToken) throw new Error('Defina CF_AI_ACCOUNT_ID e CF_AI_TOKEN no .env')
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const only = args.filter((a) => !a.startsWith('--'))
  const ids = (only.length ? only : Object.keys(EXAMPLE_PHOTOS)).filter((id) => {
    if (!EXAMPLE_PHOTOS[id]) throw new Error(`Id desconhecido: ${id}`)
    return force || only.length > 0 || !existsSync(path.join(OUT, `${id}.jpg`))
  })
  console.log(`Gerando ${ids.length} foto(s)…`)

  const browser = await chromium.launch()
  const page = await browser.newPage()
  const encode = async (buf: Buffer, size: number) => {
    const dataUrl: string = await page.evaluate(
      async ({ src, size }) => {
        const img = new Image()
        img.src = src
        await img.decode()
        const s = Math.min(img.naturalWidth, img.naturalHeight)
        const c = document.createElement('canvas')
        c.width = c.height = size
        const ctx = c.getContext('2d')!
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size)
        return c.toDataURL('image/jpeg', 0.82)
      },
      { src: `data:image/jpeg;base64,${buf.toString('base64')}`, size },
    )
    return Buffer.from(dataUrl.split(',')[1], 'base64')
  }

  let done = 0
  const failed: string[] = []
  const queue = [...ids]
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        const jpg = await encode(await generate(id, EXAMPLE_PHOTOS[id]), SIZE[id] ?? 900)
        writeFileSync(path.join(OUT, `${id}.jpg`), jpg)
        console.log(`  ✓ ${id} (${Math.round(jpg.length / 1024)} KB) ${++done}/${ids.length}`)
      } catch (err) {
        failed.push(id)
        console.warn(`  ✗ ${(err as Error).message}`)
      }
    }
  }
  await Promise.all([worker(), worker(), worker()])
  await browser.close()
  if (failed.length) {
    console.error(`Falharam: ${failed.join(' ')} — rode de novo só com esses ids.`)
    process.exitCode = 1
  }
}

await main()
