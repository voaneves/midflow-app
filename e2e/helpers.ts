import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/** Hash routes of the app shell. */
export const APP_ROUTES = [
  ['dashboard', '/app'],
  ['criar-1', '/app/criar/1'],
  ['posts', '/app/posts'],
  ['biblioteca', '/app/biblioteca'],
  ['calendario', '/app/calendario'],
  ['marca', '/app/marca'],
  ['relatorios', '/app/relatorios'],
  ['planos', '/app/planos'],
  ['config', '/app/config'],
] as const

export const PUBLIC_ROUTES = [
  ['landing', '/'],
  ['entrar', '/entrar'],
  ['cadastro', '/cadastro'],
  ['privacidade', '/privacidade'],
  ['termos', '/termos'],
  ['painel', '/painel'],
] as const

/** Opens the demo account (Studio Aurora) through the public login screen. */
export async function enterDemo(page: Page) {
  await page.goto('/#/entrar')
  await page.getByRole('button', { name: /demonstração/i }).first().click()
  await page.waitForURL(/#\/app/)
}

export async function go(page: Page, route: string) {
  await page.goto(`/#${route}`)
  await page.waitForLoadState('networkidle')
}

/** Runs axe with WCAG 2.2 A/AA rules. Creatives are artwork rendered at 1080 px, so they are excluded. */
export async function axe(page: Page) {
  const res = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('[data-creative]')
    .analyze()
  return res.violations
}

export const serious = (v: Awaited<ReturnType<typeof axe>>) => v.filter((x) => x.impact === 'serious' || x.impact === 'critical')
