import { expect, type Locator, type Page, test } from '@playwright/test'

const labelPrintPayloadStorageKey = 'cuteqrcodes.labelPrintPayload'
const destinationUrl = 'https://example.com/menu'
const dynamicRedirectUrl = 'https://qrcodesonlabels.com/r/menu-special'
const trackStatsOnlyDescription = 'Your QR code will scan to this redirect link. We will send visitors to the URL above and record scan time plus IP-based location.'

type DynamicLinkRequest = {
  destinationUrl?: string
  existingLinkId?: string
  slug?: string
  trackStatistics?: boolean
  useDynamicUrl?: boolean
}

type SavedQrRequest = {
  name?: string
  payload?: {
    dynamicLink?: {
      destinationUrl: string
      id: string
      redirectUrl: string
      slug: string
      trackStatistics: boolean
      useDynamicUrl: boolean
    }
    url?: string
  }
  tags?: string[]
}

type SavedDynamicLinkPayload = NonNullable<SavedQrRequest['payload']>['dynamicLink']

type PdfPurchaseRequest = {
  dynamicLink?: DynamicLinkRequest & {
    id?: string
    redirectUrl?: string
  }
  pdfBase64?: string
  qrTitle?: string
  templateId?: string
}

type PrintStoragePayload = {
  dynamicLink?: SavedDynamicLinkPayload
  qrPayload?: {
    dynamicLink?: SavedDynamicLinkPayload
  }
  title?: string
  url?: string
}

test('creates a paid dynamic tracking link when purchasing a printable PDF', async ({ page }) => {
  let dynamicRequest: DynamicLinkRequest | null = null
  let pdfPurchaseRequest: PdfPurchaseRequest | null = null

  await page.addInitScript(() => {
    window.open = () =>
      ({
        close() {},
        location: { href: '' }
      }) as Window
  })
  await routeLoggedInSession(page)
  await routeCreditsSummary(page)
  await routeDynamicSlugAvailability(page)
  await page.route('**/api/qr/dynamic-links', async (route) => {
    dynamicRequest = route.request().postDataJSON() as DynamicLinkRequest

    await route.fulfill({
      body: 'Dynamic links should not be created before the PDF purchase.',
      status: 500
    })
  })
  await page.route('**/api/credits/pdf-purchases', async (route) => {
    pdfPurchaseRequest = route.request().postDataJSON() as PdfPurchaseRequest

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        balance: 5,
        dynamicLink: createDynamicLinkResponse(),
        pdf: {
          createdAt: '2026-05-28T00:00:00.000Z',
          downloadUrl: '/api/credits/pdfs/pdf-dynamic',
          id: 'pdf-dynamic',
          qrTitle: pdfPurchaseRequest.qrTitle ?? 'Dynamic QR Code',
          sizeBytes: 1234,
          templateId: pdfPurchaseRequest.templateId ?? 'avery-presta-94100',
          templateLabel: 'Printable labels'
        }
      })
    })
  })

  await page.goto('/')
  await waitForBuilder(page)
  await configureDynamicQr(page)

  await page.getByRole('button', { name: 'Print to Labels', exact: true }).click()
  await page.waitForURL('**/print-labels')

  expect(dynamicRequest).toBeNull()

  const printPayload = await page.evaluate((storageKey) => {
    const rawPayload = sessionStorage.getItem(storageKey)

    return rawPayload
      ? JSON.parse(rawPayload) as PrintStoragePayload
      : null
  }, labelPrintPayloadStorageKey)

  expect(printPayload).toEqual(expect.objectContaining({
    dynamicLink: {
      destinationUrl,
      id: '',
      redirectUrl: dynamicRedirectUrl,
      slug: 'menu-special',
      trackStatistics: true,
      useDynamicUrl: true
    },
    title: dynamicRedirectUrl,
    url: dynamicRedirectUrl
  }))

  const previewButton = page.locator('[data-testid^="label-template-preview-button-"]').first()
  await expect(previewButton).toContainText('Preview')
  await expect(previewButton).toContainText('Watermarked')

  const purchaseButton = page.locator('[data-testid^="label-template-purchase-button-"]').first()
  await expect(purchaseButton).toContainText('Purchase Printable PDF')
  await expect(purchaseButton).toContainText('1 Credit')
  await expect(purchaseButton).toContainText('Create Editable Link & Track Stats')
  await expect(purchaseButton).toContainText('2 Credit')

  await purchaseButton.click()
  await expect.poll(() => pdfPurchaseRequest).not.toBeNull()

  expect(pdfPurchaseRequest).toEqual(expect.objectContaining({
    dynamicLink: {
      destinationUrl,
      id: '',
      redirectUrl: dynamicRedirectUrl,
      slug: 'menu-special',
      trackStatistics: true,
      useDynamicUrl: true
    },
    pdfBase64: expect.any(String),
    previewHeight: expect.any(Number),
    previewSvg: expect.stringContaining('<svg'),
    previewWidth: expect.any(Number),
    qrPayload: expect.objectContaining({
      dynamicLink: {
        destinationUrl,
        id: '',
        redirectUrl: dynamicRedirectUrl,
        slug: 'menu-special',
        trackStatistics: true,
        useDynamicUrl: true
      },
      url: destinationUrl
    }),
    templateId: expect.any(String)
  }))

  const purchasedPrintPayload = await page.evaluate((storageKey) => {
    const rawPayload = sessionStorage.getItem(storageKey)

    return rawPayload
      ? JSON.parse(rawPayload) as PrintStoragePayload
      : null
  }, labelPrintPayloadStorageKey)

  expect(purchasedPrintPayload).toEqual(expect.objectContaining({
    dynamicLink: createDynamicLinkResponse(),
    qrPayload: expect.objectContaining({
      dynamicLink: createDynamicLinkResponse()
    }),
    title: dynamicRedirectUrl,
    url: dynamicRedirectUrl
  }))
})

test('hides dynamic options until a URL is entered without clearing selected settings', async ({ page }) => {
  await routeLoggedInSession(page)
  await routeCreditsSummary(page)

  await page.goto('/')
  await waitForBuilder(page)

  const editableToggle = page.getByRole('checkbox', { name: 'Editable' })
  const statsToggle = page.getByRole('checkbox', { name: 'Track Stats' })

  await expect(editableToggle).toHaveCount(0)
  await expect(statsToggle).toHaveCount(0)

  await page.locator('input[type="url"]').fill(destinationUrl)
  await expect(editableToggle).toBeVisible()
  await expect(statsToggle).toBeVisible()
  await expect(page.getByText('Use a Dynamic URL that I can update later')).toHaveCount(0)
  await expect(page.getByText('Track Statistics on when and where the QR Code is scanned')).toHaveCount(0)
  await expectSameVisualRow(editableToggle, statsToggle)

  await statsToggle.click()
  await expect(statsToggle).toHaveAttribute('aria-checked', 'true')
  await expectDifferentVisualRows(editableToggle, statsToggle)
  await expect(page.getByText(trackStatsOnlyDescription)).toBeVisible()

  await editableToggle.click()
  await expect(editableToggle).toHaveAttribute('aria-checked', 'true')
  await expect(statsToggle).toHaveAttribute('aria-checked', 'true')
  await expectDifferentVisualRows(editableToggle, statsToggle)
  await expect(page.getByText('Use a Dynamic URL that I can update later')).toBeVisible()
  await expect(page.getByText('Track Statistics on when and where the QR Code is scanned')).toBeVisible()
  await routeDynamicSlugAvailability(page)
  await page.getByRole('button', { name: 'Customize Link.' }).click()
  await page.getByPlaceholder('custom-slug').fill('menu-special')
  await expect(page.getByText(dynamicRedirectUrl)).toBeVisible()

  await page.locator('input[type="url"]').fill('')
  await expect(editableToggle).toHaveCount(0)
  await expect(statsToggle).toHaveCount(0)
  await expect(page.getByText(dynamicRedirectUrl)).toHaveCount(0)

  await page.locator('input[type="url"]').fill('https://example.com/changed')
  await expect(editableToggle).toHaveAttribute('aria-checked', 'true')
  await expect(statsToggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByPlaceholder('custom-slug')).toHaveValue('menu-special')
  await expect(page.getByText(dynamicRedirectUrl)).toBeVisible()
})

test('saves dynamic link settings in a draft QR payload without creating the paid link', async ({ page }) => {
  let savedRequest: SavedQrRequest | null = null
  let dynamicRequest: DynamicLinkRequest | null = null

  await routeLoggedInSession(page)
  await routeDynamicSlugAvailability(page)
  await page.route('**/api/qr/dynamic-links', async (route) => {
    dynamicRequest = route.request().postDataJSON() as DynamicLinkRequest

    await route.fulfill({
      body: 'Draft saves should not create dynamic links.',
      status: 500
    })
  })
  await page.route('**/api/qr/saved', async (route) => {
    savedRequest = route.request().postDataJSON() as SavedQrRequest

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ qrCode: { id: 'saved-dynamic' } })
    })
  })

  await page.goto('/')
  await waitForBuilder(page)
  await configureDynamicQr(page)

  await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Save Draft' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Save Draft', exact: true }).click()
  await expect.poll(() => savedRequest).not.toBeNull()

  expect(dynamicRequest).toBeNull()
  expect(savedRequest?.tags).toEqual([])
  expect(savedRequest?.payload).toEqual(expect.objectContaining({
    url: destinationUrl,
    dynamicLink: {
      destinationUrl,
      id: '',
      redirectUrl: dynamicRedirectUrl,
      slug: 'menu-special',
      trackStatistics: true,
      useDynamicUrl: true
    }
  }))
})

test('checks custom link availability and saves existing link updates', async ({ page }) => {
  let dynamicRequest: DynamicLinkRequest | null = null

  await page.addInitScript(({ destinationUrl, dynamicRedirectUrl, storageKey }) => {
    sessionStorage.setItem(storageKey, JSON.stringify({
      additionalText: '',
      additionalTextFont: 'google-sans',
      additionalTextPlacement: 'below',
      border: 'none',
      centerIcon: 'none',
      colorName: null,
      colorStep: 500,
      dynamicLink: {
        destinationUrl,
        id: 'dynamic-link-1',
        redirectUrl: dynamicRedirectUrl,
        slug: 'menu-special',
        trackStatistics: true,
        useDynamicUrl: true
      },
      label: '',
      labelFont: 'google-sans',
      labelPosition: 'top',
      labelSizeStep: 0,
      url: destinationUrl,
      version: 1
    }))
  }, { destinationUrl, dynamicRedirectUrl, storageKey: 'cuteqrcodes.editQrPayload' })

  await routeLoggedInSession(page)
  await routeCreditsSummary(page)
  await routeDynamicSlugAvailability(page, slug => slug !== 'taken-link')
  await page.route('**/api/qr/dynamic-links', async (route) => {
    dynamicRequest = route.request().postDataJSON() as DynamicLinkRequest

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        balance: 8,
        link: {
          destinationUrl,
          id: 'dynamic-link-1',
          redirectUrl: 'https://qrcodesonlabels.com/r/fresh-link',
          slug: 'fresh-link',
          trackStatistics: true,
          useDynamicUrl: true
        }
      })
    })
  })

  await page.goto('/')
  await waitForBuilder(page)
  await page.getByRole('button', { name: 'Customize Link.' }).click()

  await expect(page.getByRole('button', { name: 'Customize Link.' })).toHaveCount(0)
  const saveButton = page.getByRole('button', { name: 'Save Update' })

  await page.getByPlaceholder('custom-slug').fill('taken-link')
  await expect(page.getByText('That custom link is not available.')).toBeVisible()
  await expect(saveButton).toBeDisabled()

  await page.getByPlaceholder('custom-slug').fill('fresh-link')
  await expect(page.getByText('This custom link is available.')).toBeVisible()
  await expect(saveButton).toBeEnabled()
  await saveButton.click()

  await expect.poll(() => dynamicRequest).not.toBeNull()
  expect(dynamicRequest).toEqual(expect.objectContaining({
    destinationUrl,
    existingLinkId: 'dynamic-link-1',
    slug: 'fresh-link',
    trackStatistics: true,
    useDynamicUrl: true
  }))
  await expect(page.getByText('https://qrcodesonlabels.com/r/fresh-link')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Customize Link.' })).toBeVisible()
})

async function configureDynamicQr(page: Page) {
  await page.locator('input[type="url"]').fill(destinationUrl)
  await page.getByRole('checkbox', { name: 'Editable' }).click()
  await page.getByRole('checkbox', { name: 'Track Stats' }).click()
  await expect(page.getByRole('checkbox', { name: 'Editable' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('checkbox', { name: 'Track Stats' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('This costs 2 credits when the link is created. Printable PDFs include this cost at purchase.')).toBeVisible()

  await page.getByRole('button', { name: 'Customize Link.' }).click()
  await page.getByPlaceholder('custom-slug').fill('menu-special')
  await expect(page.getByText(dynamicRedirectUrl)).toBeVisible()
  await expect(page.getByText(/Version \d+ · \d+×\d+ modules/)).toBeVisible()
}

async function expectSameVisualRow(first: Locator, second: Locator) {
  const [firstBox, secondBox] = await Promise.all([
    first.boundingBox(),
    second.boundingBox()
  ])

  expect(firstBox).not.toBeNull()
  expect(secondBox).not.toBeNull()
  expect(Math.abs(firstBox!.y - secondBox!.y)).toBeLessThanOrEqual(2)
}

async function expectDifferentVisualRows(first: Locator, second: Locator) {
  const [firstBox, secondBox] = await Promise.all([
    first.boundingBox(),
    second.boundingBox()
  ])

  expect(firstBox).not.toBeNull()
  expect(secondBox).not.toBeNull()
  expect(Math.abs(firstBox!.y - secondBox!.y)).toBeGreaterThan(2)
}

async function waitForBuilder(page: Page) {
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
}

async function routeLoggedInSession(page: Page) {
  await page.route('**/api/auth/get-session', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        session: {
          createdAt: '2026-05-28T00:00:00.000Z',
          expiresAt: '2026-06-28T00:00:00.000Z',
          id: 'session-dynamic',
          token: 'session-dynamic',
          updatedAt: '2026-05-28T00:00:00.000Z',
          userId: 'user-dynamic'
        },
        user: {
          createdAt: '2026-05-28T00:00:00.000Z',
          email: 'dynamic@example.com',
          emailVerified: true,
          id: 'user-dynamic',
          name: 'dynamic@example.com',
          updatedAt: '2026-05-28T00:00:00.000Z'
        }
      })
    })
  )
}

async function routeCreditsSummary(page: Page) {
  await page.route('**/api/credits/summary', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        balance: 8,
        packs: [],
        pdfs: [],
        transactions: []
      })
    })
  )
}

async function routeDynamicSlugAvailability(page: Page, isAvailable: (slug: string) => boolean = () => true) {
  await page.route('**/api/qr/dynamic-links/availability**', (route) => {
    const url = new URL(route.request().url())
    const slug = url.searchParams.get('slug') || ''

    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        available: isAvailable(slug),
        slug
      })
    })
  })
}

function createDynamicLinkResponse() {
  return {
    destinationUrl,
    id: 'dynamic-link-1',
    redirectUrl: dynamicRedirectUrl,
    slug: 'menu-special',
    trackStatistics: true,
    useDynamicUrl: true
  }
}
