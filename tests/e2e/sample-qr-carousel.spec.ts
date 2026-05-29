import { expect, test } from '@playwright/test'

test('cycles sample QR images below the empty URL box', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))

  const carousel = page.getByTestId('sample-qr-carousel')

  await expect(carousel).toBeVisible()
  await expect(page.getByTestId('qr-url-card')).toBeVisible()
  expect(await carousel.evaluate(element => Boolean(element.closest('[data-testid="qr-url-card"]')))).toBe(false)
  await expect(carousel).not.toHaveClass(/border|bg-/)
  await expect(page.getByTestId('sample-qr-image-childrens-fairyland')).toHaveCSS('filter', 'none')

  const sampleImages = page.locator('[data-testid^="sample-qr-image-"]')
  const sampleImageCount = await sampleImages.count()

  expect(sampleImageCount).toBeGreaterThanOrEqual(3)
  await expect(carousel).toHaveAttribute('data-sample-count', String(sampleImageCount))
  await expect(page.getByTestId('sample-qr-image-childrens-fairyland')).toHaveAttribute('src', /\/samples\/childrens-fairyland\.png/)
  await expect(page.getByTestId('sample-qr-image-childrens-fairyland')).toHaveAttribute('data-state', /^(active|entering)$/)

  await expect.poll(async () => carousel.getAttribute('data-active-index'), {
    timeout: 7500
  }).toBe('1')

  await page.locator('input[type="url"]').fill('https://example.com')
  await expect(carousel).toHaveCount(0)
})
