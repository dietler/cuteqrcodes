import { expect, type Page, test } from '@playwright/test'

const checkoutStateStorageKey = 'cuteqrcodes.creditCheckout'

test('automatically refreshes credits after returning from checkout', async ({ page }) => {
  await routeSession(page)

  await page.addInitScript(({ storageKey }) => {
    sessionStorage.setItem(storageKey, JSON.stringify({
      credits: 1000,
      packId: 'credits-1000',
      startedAt: '2026-05-28T22:59:00.000Z'
    }))
  }, { storageKey: checkoutStateStorageKey })

  let summaryRequests = 0

  await page.route('**/api/credits/summary', (route) => {
    summaryRequests += 1
    const isUpdated = summaryRequests >= 2

    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        balance: isUpdated ? 1100 : 100,
        packs: [],
        pdfs: [],
        transactions: isUpdated
          ? [{
              balanceAfter: 1100,
              createdAt: '2026-05-28T23:00:00.000Z',
              credits: 1000,
              description: '1,000 credits purchase',
              id: 'credit-purchase-1000',
              lemonSqueezyOrderId: 'order-1000',
              lemonSqueezyVariantId: 'variant-1000',
              pdfPurchaseId: null,
              type: 'credit_purchase'
            }]
          : []
      })
    })
  })

  await page.goto('/credits?checkout=success')

  await expect(page.getByText('Payment complete. Updating your credits...')).toBeVisible()
  await expect(page.getByText('1100', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('1,000 credits purchase')).toBeVisible()
  await expect.poll(() => summaryRequests).toBeGreaterThanOrEqual(2)
})

async function routeSession(page: Page) {
  await page.route('**/api/auth/get-session', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        session: {
          createdAt: '2026-05-28T00:00:00.000Z',
          expiresAt: '2026-06-28T00:00:00.000Z',
          id: 'session-credits',
          token: 'session-credits',
          updatedAt: '2026-05-28T00:00:00.000Z',
          userId: 'user-credits'
        },
        user: {
          createdAt: '2026-05-28T00:00:00.000Z',
          email: 'credits@example.com',
          emailVerified: true,
          id: 'user-credits',
          name: 'credits@example.com',
          updatedAt: '2026-05-28T00:00:00.000Z'
        }
      })
    })
  )
}
