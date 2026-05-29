import { expect, test } from '@playwright/test'

test('cycles sample QR images below the empty URL box', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0
  })

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))

  const carousel = page.getByTestId('sample-qr-carousel')
  const carouselStage = page.getByTestId('sample-qr-carousel-stage')

  await expect(carousel).toBeVisible()
  await expect(carouselStage).toBeVisible()
  await expect(page.getByTestId('qr-url-card')).toBeVisible()
  expect(await carousel.evaluate(element => Boolean(element.closest('[data-testid="qr-url-card"]')))).toBe(false)
  await expect(carousel).not.toHaveClass(/border|bg-/)
  await expect(page.getByTestId('sample-qr-image-childrens-fairyland')).toHaveCSS('filter', 'none')
  const carouselStageBox = await carouselStage.boundingBox()

  expect(carouselStageBox?.width).toBeGreaterThan(600)
  expect(carouselStageBox?.height).toBeGreaterThan(600)

  const sampleImages = page.locator('[data-testid^="sample-qr-image-"]')
  const sampleImageCount = await sampleImages.count()

  expect(sampleImageCount).toBeGreaterThanOrEqual(3)
  await expect(carousel).toHaveAttribute('data-sample-count', String(sampleImageCount))
  const sampleSources = await sampleImages.evaluateAll(images => images.map(image => image.getAttribute('src') ?? ''))
  const sortedSampleSources = [...sampleSources].sort((firstSource, secondSource) => firstSource.localeCompare(secondSource))
  const expectedShuffledSources = [...sortedSampleSources]

  for (let index = expectedShuffledSources.length - 1; index > 0; index--) {
    const image = expectedShuffledSources[index]

    expectedShuffledSources[index] = expectedShuffledSources[0]
    expectedShuffledSources[0] = image
  }

  expect(sampleSources.every(src => src.startsWith('/samples/') && src.endsWith('.svg'))).toBe(true)
  expect(sampleSources).toEqual(expectedShuffledSources)
  expect(sampleSources).not.toEqual(sortedSampleSources)
  await expect(page.getByTestId('sample-qr-image-childrens-fairyland')).toHaveAttribute('src', /\/samples\/childrens-fairyland\.svg/)
  const activeSampleImage = page.locator('[data-testid^="sample-qr-image-"][data-state="active"], [data-testid^="sample-qr-image-"][data-state="entering"]')

  await expect(activeSampleImage).toHaveCount(1)
  await expect(activeSampleImage).toHaveAttribute('src', /\/samples\/.+\.svg/)
  const activeSampleImageBox = await activeSampleImage.boundingBox()

  expect(activeSampleImageBox?.width).toBeGreaterThan(560)
  expect(activeSampleImageBox?.height).toBeGreaterThan(560)

  await expect.poll(async () => carousel.getAttribute('data-active-index'), {
    timeout: 7500
  }).toBe('1')

  await page.locator('input[type="url"]').fill('https://example.com')
  await expect(carousel).toHaveCount(0)
})
