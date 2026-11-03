import { expect, test, type Page } from '@playwright/test'
import { APP_ROUTES, PUBLIC_ROUTES, axe, enterDemo, go, serious } from './helpers'

/**
 * Accessibility gate (WCAG 2.2 AA via axe): no serious/critical violations on any route at
 * 360 / 768 / 1280 px, nor inside the main dialogs. Run: npx playwright test e2e/a11y.spec.ts --project=desktop-chrome
 */
const WIDTHS = [360, 768, 1280]

async function expectClean(page: Page, where: string) {
  const v = serious(await axe(page))
  expect(v.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`), where).toEqual([])
}

/** Walks the create flow with the action bar until step 4 shows its results. */
async function toResults(page: Page) {
  await page.goto('/#/app/criar/1')
  for (let i = 0; i < 4 && !/criar\/4/.test(page.url()); i++) {
    await page.getByRole('button', { name: /^(Continuar|Gerar criativos)$/ }).filter({ visible: true }).last().click()
    await page.waitForTimeout(600)
  }
  await page.locator('[data-creative]').first().waitFor({ timeout: 60_000 })
}

test.describe('@a11y', () => {
  test.skip(() => test.info().project.name !== 'desktop-chrome', 'widths are set per test')
  // Entrance animations fade text in; scanning mid-fade reports false contrast failures.
  test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }))

  for (const width of WIDTHS) {
    test(`routes at ${width}px`, async ({ page }) => {
      test.setTimeout(180_000)
      await page.setViewportSize({ width, height: 860 })
      for (const [, route] of PUBLIC_ROUTES) {
        await go(page, route)
        await expectClean(page, `${route} @${width}`)
      }
      await enterDemo(page)
      for (const [, route] of APP_ROUTES) {
        await go(page, route)
        await expectClean(page, `${route} @${width}`)
      }
    })

    test(`dialogs at ${width}px`, async ({ page }) => {
      test.setTimeout(180_000)
      await page.setViewportSize({ width, height: 860 })
      await enterDemo(page)
      await toResults(page)
      const dialog = page.getByRole('dialog')
      const close = async () => {
        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
      }

      // Quality verdict
      await page.locator('button[aria-haspopup="dialog"]').filter({ hasText: /Qualidade|Criado com IA|Revise|Versão padrão/ }).first().click()
      await expect(dialog).toBeVisible()
      await expectClean(page, `quality dialog @${width}`)
      await close()

      // Editor
      // Keyboard path (focus + Enter): also checks the button is reachable without a pointer.
      await page.getByRole('button', { name: /^Editar(?! briefing)/ }).filter({ visible: true }).first().focus()
      await page.keyboard.press('Enter')
      await expect(dialog).toBeVisible({ timeout: 15_000 })
      await expectClean(page, `editor @${width}`)
      await close()

      // Story player
      await page.getByRole('tab', { name: /stories/i }).first().click()
      await page.getByRole('button', { name: /reproduzir sequência/i }).first().click()
      await expect(dialog).toBeVisible()
      await expectClean(page, `story player @${width}`)
      await close()

      // Calendar: schedule sheet
      await go(page, '/app/calendario')
      await page.getByRole('button', { name: /agendar (neste dia|em)/i }).first().click()
      await expect(dialog).toBeVisible()
      await expectClean(page, `schedule dialog @${width}`)
      await close()

      // Plans: checkout sheet
      await go(page, '/app/planos')
      await page.getByRole('button', { name: /fazer upgrade|mudar para/i }).first().click()
      await expect(dialog).toBeVisible()
      await expectClean(page, `checkout @${width}`)
      await close()
    })
  }
})
