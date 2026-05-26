import { expect, type Page, test } from '@playwright/test'

const savedQrCode = {
  createdAt: '2026-05-26T00:00:00.000Z',
  folderId: 'folder-print',
  id: 'saved-print',
  name: 'Saved print link',
  payload: {
    additionalText: '',
    additionalTextFont: 'google-sans',
    additionalTextPlacement: 'below',
    additionalTextSizeStep: 0,
    border: 'none',
    centerIcon: 'none',
    colorName: null,
    colorStep: 500,
    label: 'Saved',
    labelFont: 'google-sans',
    labelPosition: 'bottom',
    labelSizeStep: 0,
    url: 'https://example.com/saved-print-link',
    version: 1
  },
  previewHeight: 21,
  previewSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><rect width="21" height="21" fill="white"/><rect x="1" y="1" width="19" height="19" fill="black"/></svg>',
  previewWidth: 21,
  updatedAt: '2026-05-26T00:00:00.000Z'
}

const tallSavedQrCode = {
  ...savedQrCode,
  id: 'saved-tall',
  name: 'Tall saved print link',
  previewHeight: 100,
  previewSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 100"><rect width="70" height="100" fill="white"/><rect x="5" y="5" width="60" height="90" fill="black"/></svg>',
  previewWidth: 70
}

const wideSavedQrCode = {
  ...savedQrCode,
  id: 'saved-wide',
  name: 'Wide saved print link',
  previewHeight: 70,
  previewSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70"><rect width="100" height="70" fill="white"/><rect x="5" y="5" width="90" height="60" fill="black"/></svg>',
  previewWidth: 100
}

async function routeSavedPrintFixtures(page: Page, { balance = 0, qrCode = savedQrCode }: { balance?: number, qrCode?: typeof savedQrCode } = {}) {
  await page.route('**/api/auth/get-session', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      session: {
        createdAt: '2026-05-26T00:00:00.000Z',
        expiresAt: '2026-06-26T00:00:00.000Z',
        id: 'session-print',
        token: 'session-print',
        updatedAt: '2026-05-26T00:00:00.000Z',
        userId: 'user-print'
      },
      user: {
        createdAt: '2026-05-26T00:00:00.000Z',
        email: 'print@example.com',
        emailVerified: true,
        id: 'user-print',
        name: 'print@example.com',
        updatedAt: '2026-05-26T00:00:00.000Z'
      }
    })
  }))
  await page.route(/\/api\/qr\/saved$/, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      folders: [{
        createdAt: '2026-05-26T00:00:00.000Z',
        id: 'folder-print',
        name: 'Print folder',
        qrCodes: [qrCode],
        updatedAt: '2026-05-26T00:00:00.000Z'
      }]
    })
  }))
  await page.route(`**/api/qr/saved/${qrCode.id}`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ qrCode })
  }))
  await page.route('**/api/credits/summary', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      balance,
      packs: [],
      pdfs: [],
      transactions: []
    })
  }))
}

test('saved QR print link loads labels from the saved id', async ({ page }) => {
  await routeSavedPrintFixtures(page)

  await page.goto('/saved-qr-codes')
  await expect(page.getByText('Saved print link')).toBeVisible()

  await page.getByRole('button', { name: 'Print to Labels' }).click()

  await expect(page).toHaveURL(/\/print-labels\?saved=saved-print$/)
  await expect(page.getByText('Saved print link')).toBeVisible()
  await expect(page.getByTestId('label-template-suggested-badge-avery-presta-94100')).toBeVisible()
  await expect(page.getByTestId('label-template-suggested-badge-avery-presta-94101')).toBeVisible()

  await page.getByRole('radio', { name: 'Rectangle' }).click()
  await expect(page.getByTestId('label-template-preview-avery-presta-94256')).toBeVisible()

  const largeRectanglePreview = await page.getByTestId('label-template-preview-avery-presta-94256').boundingBox()

  expect(largeRectanglePreview?.width).toBeCloseTo(336, 0)
  expect(largeRectanglePreview?.height).toBeCloseTo(480, 0)

  const wideLabelPreview = await page.getByTestId('label-template-preview-avery-presta-94207').boundingBox()

  expect(wideLabelPreview?.width).toBeCloseTo(384, 0)
  expect(wideLabelPreview?.height).toBeCloseTo(192, 0)

  const rotatedArtwork = await page.getByTestId('label-template-artwork-avery-presta-94207').boundingBox()

  expect(rotatedArtwork?.width).toBeCloseTo(168, 0)
  expect(rotatedArtwork?.height).toBeCloseTo(168, 0)

  await page.setViewportSize({ width: 320, height: 720 })

  const widePreviewScroller = page.getByTestId('label-template-preview-scroll-avery-presta-94207')
  const mobileOverflow = await widePreviewScroller.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    touchAction: getComputedStyle(element).touchAction
  }))

  expect(mobileOverflow.scrollWidth).toBeGreaterThan(mobileOverflow.clientWidth)
  expect(mobileOverflow.touchAction).toContain('pan')

  const printUrl = page.url()

  await page.evaluate(() => sessionStorage.clear())
  await page.goto(printUrl)

  await expect(page.getByText('Saved print link')).toBeVisible()
  await expect(page.getByText('No QR code is ready for labels.')).toBeHidden()
})

test('unwatermarked purchase redirects to credits when balance is empty', async ({ page }) => {
  await routeSavedPrintFixtures(page, { balance: 0 })

  await page.goto('/print-labels?saved=saved-print')
  await expect(page.getByText('Saved print link')).toBeVisible()

  await page.getByTestId('label-template-purchase-button-avery-presta-94100').click()

  await expect(page).toHaveURL(/\/credits\?needCredits=1&returnTo=/)
  await expect(page.getByText('Purchase credits before creating an unwatermarked PDF.')).toBeVisible()
})

test('suggests rectangle labels closest to the QR aspect ratio', async ({ page }) => {
  await routeSavedPrintFixtures(page, { qrCode: tallSavedQrCode })

  await page.goto('/print-labels?saved=saved-tall')
  await expect(page.getByText('Tall saved print link')).toBeVisible()

  await expect(page.getByTestId('label-template-suggested-badge-avery-presta-94256')).toBeVisible()
  await expect(page.getByTestId('label-template-suggested-badge-avery-presta-94237')).toBeVisible()
  await expect(page.getByTestId('label-template-suggested-badge-avery-presta-94207')).toHaveCount(0)
})

test('rotates preview label outline for tall QR labels that print sideways', async ({ page }) => {
  await routeSavedPrintFixtures(page, { qrCode: tallSavedQrCode })

  await page.goto('/print-labels?saved=saved-tall')
  await expect(page.getByText('Tall saved print link')).toBeVisible()

  const tallOnPortraitTransform = await page.getByTestId('label-template-artwork-avery-presta-94256').locator('img').evaluate(element => (element as HTMLElement).style.transform)
  const tallOnLandscapeTransform = await page.getByTestId('label-template-artwork-avery-presta-94207').locator('img').evaluate(element => (element as HTMLElement).style.transform)
  const tallOnLandscapePreview = await page.getByTestId('label-template-preview-avery-presta-94207').boundingBox()
  const tallOnLandscapeArtwork = await page.getByTestId('label-template-artwork-avery-presta-94207').boundingBox()

  expect(tallOnLandscapePreview).not.toBeNull()
  expect(tallOnLandscapeArtwork).not.toBeNull()
  expect(tallOnPortraitTransform).not.toContain('rotate')
  expect(tallOnLandscapeTransform).not.toContain('rotate')
  expect(tallOnLandscapePreview!.height).toBeGreaterThan(tallOnLandscapePreview!.width)
  expect(tallOnLandscapeArtwork!.height).toBeGreaterThan(tallOnLandscapeArtwork!.width)
})

test('rotates preview label outline differently for wide QR labels', async ({ page }) => {
  await routeSavedPrintFixtures(page, { qrCode: wideSavedQrCode })

  await page.goto('/print-labels?saved=saved-wide')
  await expect(page.getByText('Wide saved print link')).toBeVisible()

  const wideOnPortraitTransform = await page.getByTestId('label-template-artwork-avery-presta-94256').locator('img').evaluate(element => (element as HTMLElement).style.transform)
  const wideOnLandscapeTransform = await page.getByTestId('label-template-artwork-avery-presta-94207').locator('img').evaluate(element => (element as HTMLElement).style.transform)
  const wideOnPortraitPreview = await page.getByTestId('label-template-preview-avery-presta-94256').boundingBox()
  const wideOnPortraitArtwork = await page.getByTestId('label-template-artwork-avery-presta-94256').boundingBox()

  expect(wideOnPortraitPreview).not.toBeNull()
  expect(wideOnPortraitArtwork).not.toBeNull()
  expect(wideOnPortraitTransform).not.toContain('rotate')
  expect(wideOnLandscapeTransform).not.toContain('rotate')
  expect(wideOnPortraitPreview!.width).toBeGreaterThan(wideOnPortraitPreview!.height)
  expect(wideOnPortraitArtwork!.width).toBeGreaterThan(wideOnPortraitArtwork!.height)
})
