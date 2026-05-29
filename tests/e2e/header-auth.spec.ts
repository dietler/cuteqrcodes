import { expect, type Page, test } from '@playwright/test'

test('shows logged-out header auth buttons instead of the account avatar', async ({ page }) => {
  await routeSession(page, null)

  await page.goto('/')
  await waitForBuilder(page)

  const header = page.getByRole('banner')

  await expect(header.getByRole('link', { name: 'Login to Save Drafts' })).toHaveAttribute('href', '/login')
  await expect(header.getByRole('link', { name: 'Create an Account' })).toHaveAttribute('href', '/register')
  await expect(header.getByRole('button', { name: 'Account menu' })).toHaveCount(0)

  await page.locator('input[type="url"]').fill('https://example.com')

  await expect(page.getByRole('button', { name: 'Save Draft QR Code', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Login to Save Drafts' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Print to Labels', exact: true })).toBeVisible()
})

test('keeps the account menu and builder save button for logged-in users', async ({ page }) => {
  await routeSession(page, 'user@example.com')

  await page.goto('/')
  await waitForBuilder(page)

  const header = page.getByRole('banner')

  await expect(header.getByRole('button', { name: 'Account menu for user@example.com' })).toBeVisible()
  await expect(header.getByRole('link', { name: 'Login to Save Drafts' })).toHaveCount(0)
  await expect(header.getByRole('link', { name: 'Create an Account' })).toHaveCount(0)

  await page.locator('input[type="url"]').fill('https://example.com')

  await expect(page.getByRole('button', { name: 'Save Draft QR Code', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print to Labels', exact: true })).toBeVisible()
})

async function waitForBuilder(page: Page) {
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
}

async function routeSession(page: Page, email: string | null) {
  await page.route('**/api/auth/get-session', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(email
        ? {
            session: {
              createdAt: '2026-05-28T00:00:00.000Z',
              expiresAt: '2026-06-28T00:00:00.000Z',
              id: 'session-header',
              token: 'session-header',
              updatedAt: '2026-05-28T00:00:00.000Z',
              userId: 'user-header'
            },
            user: {
              createdAt: '2026-05-28T00:00:00.000Z',
              email,
              emailVerified: true,
              id: 'user-header',
              name: email,
              updatedAt: '2026-05-28T00:00:00.000Z'
            }
          }
        : null)
    })
  )
}
