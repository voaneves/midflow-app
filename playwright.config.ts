import { defineConfig, devices } from '@playwright/test'

/**
 * E2E + accessibility suite.
 * The dev server runs with AI disabled, so generation uses the server template engine
 * (labelled "fallback" in the UI) and tests never spend API credits.
 */
const PORT = Number(process.env.E2E_PORT || 5199)

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
  },
  projects: [
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    // WebKit is used in CI; locally Chromium with the iPhone viewport keeps the install small.
    { name: 'iphone-14', use: { ...devices['iPhone 14'], ...(process.env.CI ? {} : { browserName: 'chromium' as const, defaultBrowserType: 'chromium' }) } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { AI_PROVIDER: 'none', IMAGE_PROVIDER: 'none', GEMINI_API_KEY: '', OPENAI_API_KEY: '' },
  },
})
