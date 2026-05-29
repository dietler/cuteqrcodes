import { expect, type Page, test } from '@playwright/test'

type StatsRange = '24h' | '7d' | '30d' | '365d'

const statsByRange = {
  '7d': createStatsResponse({
    activeTrackedLinks: 2,
    range: '7d',
    totalScans: 42,
    topLabel: 'Menu QR',
    topScans: 35
  }),
  '30d': createStatsResponse({
    activeTrackedLinks: 3,
    range: '30d',
    totalScans: 89,
    topLabel: 'Review QR',
    topScans: 51
  })
}

test('shows aggregate QR scan stats for the selected range', async ({ page }) => {
  const requestedRanges: string[] = []

  await routeSession(page, 'stats@example.com')
  await routeStats(page, requestedRanges)

  await page.goto('/stats')

  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible()
  await expect(page.getByText('42', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('3', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Menu QR').first()).toBeVisible()
  await expect(page.getByText('US').first()).toBeVisible()
  await expect(page.getByText('Livermore, CA, US')).toBeVisible()
  expect(requestedRanges).toContain('7d')

  await page.getByRole('button', { name: 'Last 30 days' }).click()

  await expect.poll(() => requestedRanges.at(-1)).toBe('30d')
  await expect(page.getByText('89', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Review QR').first()).toBeVisible()
})

test('prompts logged-out visitors to log in before viewing stats', async ({ page }) => {
  await routeSession(page, null)

  await page.goto('/stats')

  await expect(page.getByRole('heading', { name: 'Login Required' })).toBeVisible()
  await expect(page.getByRole('link', { exact: true, name: 'Login' })).toHaveAttribute('href', '/login?redirect=/stats')
  await expect(page.getByRole('link', { exact: true, name: 'Register' })).toHaveAttribute('href', '/register?redirect=/stats')
})

async function routeStats(page: Page, requestedRanges: string[]) {
  await page.route('**/api/qr/stats**', (route) => {
    const url = new URL(route.request().url())
    const range = url.searchParams.get('range') || '7d'

    requestedRanges.push(range)

    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(statsByRange[range as keyof typeof statsByRange] || statsByRange['7d'])
    })
  })
}

async function routeSession(page: Page, email: string | null) {
  await page.route(/\/api\/auth\/get-session(?:\?|$)/, route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(email
        ? {
            session: {
              createdAt: '2026-05-28T00:00:00.000Z',
              expiresAt: '2026-06-28T00:00:00.000Z',
              id: 'session-stats',
              token: 'session-stats',
              updatedAt: '2026-05-28T00:00:00.000Z',
              userId: 'user-stats'
            },
            user: {
              createdAt: '2026-05-28T00:00:00.000Z',
              email,
              emailVerified: true,
              id: 'user-stats',
              name: email,
              updatedAt: '2026-05-28T00:00:00.000Z'
            }
          }
        : null)
    })
  )
}

function createStatsResponse({
  activeTrackedLinks,
  range,
  topLabel,
  topScans,
  totalScans
}: {
  activeTrackedLinks: number
  range: StatsRange
  topLabel: string
  topScans: number
  totalScans: number
}) {
  return {
    activeTrackedLinks,
    lastScannedAt: '2026-05-28T18:00:00.000Z',
    range,
    recentScans: [
      {
        city: 'Livermore',
        country: 'US',
        id: `${range}-scan-1`,
        linkId: `${range}-link-1`,
        linkName: topLabel,
        region: 'CA',
        scannedAt: '2026-05-28T18:00:00.000Z',
        slug: 'menu'
      }
    ],
    scansByCountry: [
      {
        count: Math.max(1, totalScans - 2),
        label: 'US'
      },
      {
        count: 2,
        label: 'Unknown'
      }
    ],
    scansByPeriod: [
      {
        count: Math.max(1, totalScans - 10),
        label: '2026-05-27'
      },
      {
        count: 10,
        label: '2026-05-28'
      }
    ],
    topLinks: [
      {
        count: topScans,
        id: `${range}-link-1`,
        label: topLabel,
        lastScannedAt: '2026-05-28T18:00:00.000Z',
        slug: 'menu'
      }
    ],
    totalScans,
    totalTrackedLinks: 3
  }
}
