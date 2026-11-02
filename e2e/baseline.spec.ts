import { test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { APP_ROUTES, PUBLIC_ROUTES, axe, enterDemo, go } from './helpers'

/**
 * Screenshots + axe summary of every route at 360 / 768 / 1280 px.
 * Run with `npm run e2e:baseline`; output goes to docs/ux-baseline/ (screenshots are git-ignored).
 */
const WIDTHS = [360, 768, 1280]
const OUT = 'docs/ux-baseline'

test.describe('@baseline', () => {
  test.skip(() => test.info().project.name !== 'desktop-chrome', 'single project is enough')
  test.setTimeout(240_000)

  test('capture', async ({ page }) => {
    mkdirSync(`${OUT}/screens`, { recursive: true })
    const rows: { route: string; width: number; violations: number; serious: number; ids: string[]; overflowX: boolean }[] = []
    const shoot = async (name: string, route: string) => {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: width < 800 ? 800 : 900 })
        await go(page, route)
        await page.waitForTimeout(400)
        await page.screenshot({ path: `${OUT}/screens/${name}-${width}.png`, fullPage: true })
        const v = await axe(page)
        const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
        rows.push({
          route,
          width,
          violations: v.length,
          serious: v.filter((x) => x.impact === 'serious' || x.impact === 'critical').length,
          ids: v.map((x) => `${x.id}(${x.nodes.length})`),
          overflowX,
        })
      }
    }
    for (const [name, route] of PUBLIC_ROUTES) await shoot(name, route)
    await enterDemo(page)
    for (const [name, route] of APP_ROUTES) await shoot(name, route)
    writeFileSync(`${OUT}/axe.json`, JSON.stringify(rows, null, 2))
  })
})
