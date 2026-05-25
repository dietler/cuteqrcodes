import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge'
      }
    }
  ],
  webServer: {
    command: `bun ./node_modules/nuxt/bin/nuxt.mjs dev --host 127.0.0.1 --port ${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL
  }
})
