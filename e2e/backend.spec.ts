import { expect, test, type Page, type Route } from '@playwright/test'
import { axe, enterDemo, go, serious } from './helpers'

/**
 * Backend-facing UI, with the API mocked through page.route: generation retry, review requests,
 * plan-limit / session errors, and the staff panel role matrix. No real AI is called.
 * Run: npx playwright test e2e/backend.spec.ts --project=desktop-chrome
 */
test.describe('@backend', () => {
  test.skip(() => test.info().project.name !== 'desktop-chrome', 'one project is enough')

  /** Walks the create flow with the action bar until step 4. */
  async function toStep4(page: Page) {
    await page.goto('/#/app/criar/1')
    for (let i = 0; i < 4 && !/criar\/4/.test(page.url()); i++) {
      await page.getByRole('button', { name: /^(Continuar|Gerar criativos)$/ }).filter({ visible: true }).last().click()
      await page.waitForTimeout(600)
    }
  }

  /** Answers /api/generate with the real (template) result of the dev server, tagged as the AI having failed. */
  async function mockGenerate(page: Page, tag: (n: number) => { aiErrorKind: string | null; retryable: boolean }) {
    const state = { calls: 0 }
    await page.route('**/api/generate', async (route: Route) => {
      state.calls++
      const real = await route.fetch()
      const json = await real.json()
      json.generation.engine = 'template'
      Object.assign(json, tag(state.calls))
      await route.fulfill({ response: real, json })
    })
    return state
  }

  test('retries a temporary AI failure with a live status, then shows the template result honestly', async ({ page }) => {
    test.setTimeout(120_000)
    await page.clock.install()
    const state = await mockGenerate(page, () => ({ aiErrorKind: 'transient', retryable: true }))
    await enterDemo(page)
    await toStep4(page)

    const status = page.getByRole('status').filter({ hasText: /Ainda processando/ })
    await expect(status).toHaveText('Ainda processando, tentando novamente (1/3)…')
    await page.clock.fastForward(6_000)
    await expect(status).toHaveText('Ainda processando, tentando novamente (2/3)…')
    await page.clock.fastForward(16_000)
    await expect(status).toHaveText('Ainda processando, tentando novamente (3/3)…')
    await page.clock.fastForward(31_000)

    // 1 try + 3 retries, then the template result is kept with its honest label and the review prompt.
    await page.locator('[data-creative]').first().waitFor({ timeout: 30_000 })
    expect(state.calls).toBe(4)
    await expect(page.getByRole('button', { name: /Versão padrão/ }).first()).toBeVisible()
    await expect(page.getByText('Não ficou como esperado?')).toBeVisible()
  })

  test('does not retry when the daily cap is reached', async ({ page }) => {
    const state = await mockGenerate(page, () => ({ aiErrorKind: 'daily_cap', retryable: false }))
    await enterDemo(page)
    await toStep4(page)
    await page.locator('[data-creative]').first().waitFor({ timeout: 30_000 })
    expect(state.calls).toBe(1)
    await expect(page.getByText(/Ainda processando/)).toHaveCount(0)
  })

  test('shows a plan-limit message with a link to Planos on 402', async ({ page }) => {
    const message = 'Você já usou os 5 conteúdos grátis deste mês. Assine um plano para continuar criando. Seus conteúdos grátis renovam no dia 1º.'
    await page.route('**/api/generate', (route) => route.fulfill({ status: 402, json: { error: message, code: 'quota_exceeded', plan: 'free', limit: 5, used: 5 } }))
    await enterDemo(page)
    await toStep4(page)
    await expect(page.getByText(message)).toBeVisible()
    // The demo account is on Pro, so the link says "Ver planos"; a free account would read "Assinar um plano".
    await page.locator('#main').getByRole('link', { name: 'Ver planos' }).click()
    await expect(page).toHaveURL(/#\/app\/planos(\?motivo=limite)?$/)
  })

  test('review dialog: sends text-only payload, handles 429, confirms with a toast', async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockGenerate(page, () => ({ aiErrorKind: 'config', retryable: false }))
    let posted: Record<string, unknown> | null = null
    let attempts = 0
    await page.route('**/api/review', async (route) => {
      attempts++
      if (attempts === 1) return route.fulfill({ status: 429, json: { error: 'rate' } })
      posted = route.request().postDataJSON()
      return route.fulfill({ status: 201, json: { id: 'rev-1' } })
    })
    await enterDemo(page)
    await toStep4(page)
    await page.locator('[data-creative]').first().waitFor({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Solicitar revisão' }).filter({ visible: true }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Solicitar revisão' })
    await expect(dialog).toBeVisible()
    expect(serious(await axe(page)).map((v) => v.id)).toEqual([])

    await dialog.getByLabel(/O que você gostaria de melhorar/).fill('A legenda do post 2 ficou genérica.')
    await dialog.getByRole('button', { name: 'Enviar pedido' }).click()
    await expect(dialog.getByRole('alert')).toContainText('muitos pedidos')

    await dialog.getByRole('button', { name: 'Enviar pedido' }).click()
    await expect(page.getByText('Recebemos seu pedido de revisão. Nossa equipe vai analisar.')).toBeVisible()
    await expect(dialog).toHaveCount(0)

    const body = posted as unknown as { comment: string; engine: string; aiErrorKind: string; outputs: Record<string, unknown>[]; briefing: Record<string, unknown> }
    expect(body.comment).toBe('A legenda do post 2 ficou genérica.')
    expect(body.engine).toBe('template')
    expect(body.aiErrorKind).toBe('config')
    expect(body.outputs).toHaveLength(8)
    for (const o of body.outputs) expect(Object.keys(o).sort()).toEqual(['caption', 'hashtags', 'kind', 'title'])
    expect(JSON.stringify(body)).not.toContain('data:image')
  })

  test('review dialog explains the offline case when there is no API', async ({ page }) => {
    test.setTimeout(120_000)
    await mockGenerate(page, () => ({ aiErrorKind: 'config', retryable: false }))
    await page.route('**/api/review', (route) => route.abort('connectionrefused'))
    await enterDemo(page)
    await toStep4(page)
    await page.locator('[data-creative]').first().waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Solicitar revisão' }).filter({ visible: true }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Enviar pedido' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Sem conexão')
  })

  test('rating has visible and spoken anchors; the template result is labelled as not AI', async ({ page }) => {
    test.setTimeout(120_000)
    await mockGenerate(page, () => ({ aiErrorKind: 'daily_cap', retryable: false }))
    await enterDemo(page)
    await toStep4(page)
    await page.locator('[data-creative]').first().waitFor({ timeout: 30_000 })
    await expect(page.getByText('Pouco útil', { exact: true })).toBeVisible()
    await expect(page.getByText('Muito útil', { exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: '1 (pouco útil)' })).toBeAttached()
    await expect(page.getByRole('radio', { name: '5 (muito útil)' })).toBeAttached()
    await expect(page.getByRole('button', { name: /Versão padrão \(IA indisponível no momento\)/ }).first()).toBeVisible()
  })

  test('password fields have an accessible show/hide toggle; browser-only mode has no password recovery', async ({ page }) => {
    for (const route of ['/entrar', '/cadastro']) {
      await go(page, route)
      const field = page.getByLabel('Senha', { exact: false }).first()
      await field.fill('segredo123')
      await expect(field).toHaveAttribute('type', 'password')
      const show = page.getByRole('button', { name: 'Mostrar senha' })
      await expect(show).toHaveAttribute('aria-pressed', 'false')
      await show.click()
      await expect(field).toHaveAttribute('type', 'text')
      await expect(page.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')
    }
    await go(page, '/entrar')
    await expect(page.getByRole('link', { name: 'Esqueci minha senha' })).toHaveCount(0)
    await go(page, '/esqueci-senha')
    await expect(page).toHaveURL(/#\/entrar/)
    await go(page, '/nova-senha')
    await expect(page).toHaveURL(/#\/entrar/)
  })

  test('settings: demo mode keeps "Restaurar dados de demonstração" and the browser-only delete copy', async ({ page }) => {
    await enterDemo(page)
    await go(page, '/app/config')
    await expect(page.getByText('Restaurar dados de demonstração')).toBeVisible()
    await expect(page.getByText('Excluir todos os meus dados')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Excluir minha conta' })).toHaveCount(0)
  })

  /** A smooth w x h image encoded in the browser (gradients compress well, so the raw upload stays small). */
  async function makeImage(page: Page, w: number, h: number, opts: { transparent?: boolean } = {}) {
    const b64 = await page.evaluate(
      async ({ w, h, transparent }) => {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')!
        const g = ctx.createLinearGradient(0, 0, w, h)
        g.addColorStop(0, '#0b4d3d')
        g.addColorStop(1, '#f3b53c')
        if (transparent) {
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(w / 2, h / 2, Math.min(w, h) / 2.2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillStyle = g
          ctx.fillRect(0, 0, w, h)
        }
        const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'))
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let bin = ''
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        return btoa(bin)
      },
      { w, h, transparent: !!opts.transparent },
    )
    return Buffer.from(b64, 'base64')
  }

  const dims = (page: Page, src: string) =>
    page.evaluate(async (u) => {
      const img = new Image()
      img.src = u
      await img.decode()
      return { w: img.naturalWidth, h: img.naturalHeight, kb: Math.round(u.length * 0.75) / 1024 }
    }, src)

  test('brand logo upload is downscaled to 1024 px; transparency keeps PNG, opaque logos become WebP', async ({ page }) => {
    await enterDemo(page)
    await go(page, '/app/marca')
    const remove = page.getByRole('button', { name: 'Remover', exact: true })
    if (await remove.count()) await remove.first().click()
    const input = page.locator('input[type=file][accept*="svg"]')

    await input.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: await makeImage(page, 3000, 2000, { transparent: true }) })
    const logo = page.getByRole('img', { name: /^Logo de / })
    await expect(logo).toBeVisible()
    let src = (await logo.getAttribute('src'))!
    expect(src.startsWith('data:image/png')).toBe(true)
    let d = await dims(page, src)
    expect(Math.max(d.w, d.h)).toBe(1024)
    expect(d.kb).toBeLessThan(1024)

    await page.getByRole('button', { name: 'Remover', exact: true }).first().click()
    await input.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: await makeImage(page, 2400, 1200) })
    src = (await logo.getAttribute('src'))!
    expect(src.startsWith('data:image/webp') || src.startsWith('data:image/jpeg')).toBe(true)
    d = await dims(page, src)
    expect(d.w).toBe(1024)
    expect(d.kb).toBeLessThan(1024)
  })

  test('editor: uploaded photos are stored as <= 1920 px JPEG; daily AI limits are explained honestly', async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/api/generate-image', (route) =>
      route.fulfill({ json: { success: true, imageUrl: '/api/image?stock=1', seed: 1, aiEnabled: false, code: 'daily_user_limit' } }),
    )
    await page.route('**/api/rewrite', async (route) => {
      const real = await route.fetch()
      const json = await real.json()
      json.engine = 'template'
      json.aiErrorKind = 'daily_cap'
      await route.fulfill({ response: real, json })
    })
    await enterDemo(page)
    await toStep4(page)
    await page.locator('[data-creative]').first().waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: /^Editar(?! briefing)/ }).filter({ visible: true }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    await dialog.getByRole('tab', { name: 'Texto' }).click()
    await dialog.getByRole('button', { name: 'Reescrever', exact: true }).click()
    await expect(page.getByText('O limite diário de textos com IA foi atingido. Reescrevemos com a versão padrão, sem IA.')).toBeVisible()

    await dialog.getByRole('tab', { name: 'Imagem' }).click()
    await dialog.getByRole('button', { name: 'Gerar imagem' }).click()
    await expect(page.getByText('Você atingiu o limite diário de imagens com IA. Usamos uma foto de banco por enquanto.')).toBeVisible()

    await dialog.locator('input[type=file]').first().setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: await makeImage(page, 4000, 3000) })
    const sent = dialog.getByRole('img', { name: 'Foto enviada (selecionada)' })
    await expect(sent).toBeVisible()
    const src = (await sent.getAttribute('src'))!
    expect(src.startsWith('data:image/jpeg')).toBe(true)
    const d = await dims(page, src)
    expect(Math.max(d.w, d.h)).toBe(1920)
    expect(d.kb).toBeLessThan(1024)
  })
})

/* ------------------------------------------------------------------ */
/* Staff panel: role matrix                                            */
/* ------------------------------------------------------------------ */

/** Same camelCase shape as server/reviews.ts `toItem`. The queue list leaves out briefing/outputs; the detail has them. */
const REVIEW = {
  id: '3f0c9f7e-5d1a-4b7e-9a55-0c1d2e3f4a5b',
  createdAt: '2026-11-03T12:00:00Z',
  updatedAt: '2026-11-03T12:00:00Z',
  userId: null,
  status: 'pending',
  brandName: 'Studio Aurora',
  segment: 'beleza',
  engine: 'template',
  aiErrorKind: 'transient',
  comment: 'A legenda ficou genérica.',
  contactEmail: 'cliente@exemplo.com.br',
  adminNote: null,
  assignedTo: null,
  resolvedAt: null,
}
const REVIEW_DETAIL = {
  ...REVIEW,
  briefing: { about: 'Salão de beleza em Palmas', segment: 'beleza', tones: ['profissional'] },
  outputs: [{ kind: 'post', title: 'Cabelo novo', caption: 'Venha conhecer.', hashtags: ['#cabelo', '#beleza'] }],
  revisedOutputs: null,
}

const SERIES = Array.from({ length: 24 }, (_, i) => ({
  bucket: new Date(Date.UTC(2026, 10, 2, i)).toISOString(),
  calls: 4 + (i % 5),
  ok: 3 + (i % 4),
  fallback: i % 3 === 0 ? 2 : 0,
  p95: i % 6 === 5 ? null : 4000 + i * 120,
}))

const AI_HEALTH = {
  range: '24h',
  storage: 'supabase',
  totals: { calls: 120, ok: 110, fallback: 10, successRate: 91.7, fallbackByKind: { transient: 6, daily_cap: 3, config: 1 } },
  latency: { p50: 4200, p95: 9800 },
  quality: { avg: 91.2, belowThreshold: 2 },
  images: { ai: 30, stock: 20, procedural: 5 },
  dailyCap: { text: { used: 40, max: 200 }, images: { used: 12, max: null } },
  providers: [
    { name: 'gemini', configured: true, model: 'gemini-flash' },
    { name: 'openai', configured: false, model: null },
  ],
  lastError: { at: Date.parse('2026-11-02T20:00:00Z'), route: 'generate', outcome: 'transient', errorCode: 'http_503' },
  series: SERIES,
}

const METRICS = {
  periodDays: 30,
  generations: 42,
  businesses: 9,
  aiShare: 80,
  avgQualityAI: 90,
  avgQualityAll: 88,
  avgLatencyMs: 5000,
  ratings: { count: 4, average: 4.5 },
  usage: { downloads: 10, edits: 5 },
  aiUnavailable: { total: 10, transient: 6, daily_cap: 3, config: 1 },
  reviewRequests: 3,
  aiErrors: [],
  topIssues: [],
  recentFeedback: [],
}

type Who = 'admin' | 'editor' | 'customer'
const TOKENS: Record<string, Who> = { 'admin-token': 'admin', 'editor-token': 'editor', 'customer-token': 'customer' }

async function mockStaffApi(page: Page) {
  await page.route('**/api/admin/**', async (route) => {
    const url = new URL(route.request().url())
    const token = (route.request().headers().authorization ?? '').replace('Bearer ', '')
    const who = TOKENS[token]
    if (!who) return route.fulfill({ status: 401, json: { error: 'Token inválido.' } })
    const path = url.pathname.replace(/^.*\/api\/admin/, '')
    if (path === '/me') {
      if (who === 'customer') return route.fulfill({ status: 403, json: { error: 'Sem permissão.' } })
      return route.fulfill({ json: { role: who, userId: who === 'editor' ? 'user-editor' : null, via: 'token' } })
    }
    if (path === '/reviews') return route.fulfill({ json: { items: [REVIEW], storage: 'supabase' } })
    if (path === `/reviews/${REVIEW.id}`) return route.fulfill({ json: { item: REVIEW_DETAIL, events: [], storage: 'supabase' } })
    if (who !== 'admin') return route.fulfill({ status: 403, json: { error: 'Apenas administradores.' } })
    if (path.startsWith('/ai-health')) return route.fulfill({ json: AI_HEALTH })
    if (path === '/metrics') return route.fulfill({ json: METRICS })
    if (path === '/staff') return route.fulfill({ json: { items: [{ userId: 'user-editor', email: 'editor@exemplo.com.br', name: 'Edu', role: 'editor', createdAt: '2026-10-01T00:00:00Z', createdBy: null }] } })
    return route.fulfill({ status: 404, json: { error: 'x' } })
  })
}

async function loginWithToken(page: Page, token: string) {
  await go(page, '/painel')
  await page.getByLabel(/Token de acesso/).fill(token)
  await page.getByRole('button', { name: 'Usar token de acesso' }).click()
}

test.describe('@painel', () => {
  test.skip(() => test.info().project.name !== 'desktop-chrome', 'one project is enough')
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockStaffApi(page)
  })

  test('on a phone the review queue is a list of cards, not a wide table', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await loginWithToken(page, 'admin-token')
    const list = page.getByRole('list', { name: 'Pedidos de revisão' })
    await expect(list).toContainText('Studio Aurora')
    await expect(page.getByRole('table', { name: /Pedidos de revisão/ })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    expect(serious(await axe(page)).map((v) => v.id)).toEqual([])
    await list.getByRole('button', { name: /Abrir/ }).click()
    await expect(page.getByRole('dialog', { name: 'Pedido de revisão' })).toBeVisible()
  })

  test('administrator sees every tab and each one renders its data', async ({ page }) => {
    await loginWithToken(page, 'admin-token')
    await expect(page.getByRole('tab')).toHaveText(['Revisões', 'Saúde da IA', 'Métricas', 'Equipe'])

    await expect(page.getByRole('table', { name: /Pedidos de revisão/ })).toContainText('Studio Aurora')
    expect(serious(await axe(page)).map((v) => v.id)).toEqual([])

    await page.getByRole('button', { name: /Abrir/ }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Pedido de revisão' })
    await expect(dialog).toContainText('Salão de beleza em Palmas')
    await expect(dialog).toContainText('Cabelo novo')
    await expect(dialog.getByRole('button', { name: 'Enviar revisão' })).toBeEnabled()
    expect(serious(await axe(page)).map((v) => v.id)).toEqual([])
    await page.keyboard.press('Escape')

    await page.getByRole('tab', { name: 'Saúde da IA' }).click()
    await expect(page.locator('span.rounded-full', { hasText: 'Status geral' })).toContainText('Instável')
    await expect(page.getByText('91,7%')).toBeVisible()
    await expect(page.getByRole('img', { name: /Chamadas por hora/ })).toBeVisible()
    await expect(page.getByRole('table', { name: /Provedores de IA/ })).toContainText('gemini')
    await expect(page.getByText('sem limite')).toBeVisible()
    expect(serious(await axe(page)).map((v) => v.id)).toEqual([])

    await page.getByRole('tab', { name: 'Métricas' }).click()
    await expect(page.getByRole('table', { name: /Falhas da IA por tipo/ })).toContainText('Instabilidade')
    await page.getByRole('tab', { name: 'Equipe' }).click()
    await expect(page.getByRole('table', { name: /Pessoas com acesso/ })).toContainText('editor@exemplo.com.br')
    expect(serious(await axe(page)).map((v) => v.id)).toEqual([])
  })

  test('editor sees only the Revisões tab', async ({ page }) => {
    await loginWithToken(page, 'editor-token')
    await expect(page.getByRole('tab')).toHaveText(['Revisões'])
    await expect(page.getByRole('tab', { name: 'Métricas' })).toHaveCount(0)
    await page.getByRole('button', { name: /Abrir/ }).first().click()
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Enviar revisão' })).toBeVisible()
  })

  test('a customer account gets the restricted-access screen', async ({ page }) => {
    await loginWithToken(page, 'customer-token')
    await expect(page.getByRole('heading', { name: 'Acesso restrito à equipe' })).toBeVisible()
    await expect(page.getByRole('tab')).toHaveCount(0)
  })

  test('an invalid token is rejected and not kept', async ({ page }) => {
    await loginWithToken(page, 'wrong')
    await expect(page.getByRole('region', { name: 'Entre para continuar' }).getByRole('alert')).toContainText('Token de acesso inválido.')
    expect(await page.evaluate(() => sessionStorage.getItem('mf.admin-token'))).toBeNull()
  })
  test('refuses to run inside a frame (clickjacking guard)', async ({ page, baseURL }) => {
    await page.setContent(`<iframe title="x" src="${baseURL}/#/painel" style="width:900px;height:600px"></iframe>`)
    const frame = page.frameLocator('iframe')
    await expect(frame.getByRole('heading', { name: 'Abra o MIDFLOW em uma nova aba' })).toBeVisible()
    await expect(frame.getByRole('link', { name: 'Abrir em uma nova aba' })).toHaveAttribute('target', '_blank')
    await expect(frame.getByRole('region', { name: 'Entre para continuar' })).toHaveCount(0)
    // The same route opened as a top-level page still works.
    await page.goto('/#/painel')
    await expect(page.getByRole('region', { name: 'Entre para continuar' })).toBeVisible()
  })
})
