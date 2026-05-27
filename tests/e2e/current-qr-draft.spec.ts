import { expect, type Page, test } from '@playwright/test'

const currentQrDraftStorageKey = 'cuteqrcodes.currentQrDraft'
const draftLabel = 'Session Draft'
const draftAdditionalText = 'Saved across navigation'
const originalUrl = 'https://example.com/original'
const replacementUrl = 'https://example.com/replacement'

test('keeps the current QR draft across navigation and clears it only from the Clear button', async ({ page }) => {
  await page.goto('/')
  await waitForBuilder(page)

  await createDraftQr(page)
  await expectStoredDraft(page, {
    colorName: 'Red',
    label: draftLabel,
    url: originalUrl
  })

  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible()
  await page.goto('/')
  await waitForBuilder(page)
  await expectDraftControls(page, originalUrl)

  await page.getByRole('button', { name: 'Print to Labels', exact: true }).click()
  await page.waitForURL('**/print-labels')
  await page.getByRole('button', { name: 'QR Code' }).click()
  await expect(page).toHaveURL(/\/$/)
  await waitForBuilder(page)
  await expectDraftControls(page, originalUrl)

  await page.getByRole('button', { name: 'Print to Labels', exact: true }).click()
  await page.waitForURL('**/print-labels')
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await waitForBuilder(page)
  await expectDraftControls(page, originalUrl)

  const urlInput = page.locator('input[type="url"]')

  await urlInput.fill('')
  await expect(page.getByText('Enter a URL to generate a QR code.')).toBeVisible()
  await expectStoredDraft(page, {
    label: draftLabel,
    url: ''
  })

  await urlInput.fill(replacementUrl)
  await expectDraftControls(page, replacementUrl)

  await page.getByRole('button', { name: 'Clear current QR code' }).click()
  await expect(urlInput).toHaveValue('')
  await expect.poll(() => getStoredDraft(page)).toBeNull()

  await urlInput.fill('https://example.com/after-clear')
  await page.getByRole('button', { name: 'Label', exact: true }).click()
  await expect(page.locator('input[placeholder="Add a word"]')).toHaveValue('')
  await expect(page.locator('#qr-additional-text')).toHaveValue('')

  await page.getByRole('button', { name: 'Colors' }).click()
  await expect(page.getByRole('button', { name: 'Use Black for the QR code' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'No border' })).toHaveAttribute('aria-checked', 'true')
})

async function waitForBuilder(page: Page) {
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
}

async function createDraftQr(page: Page) {
  await page.locator('input[type="url"]').fill(originalUrl)

  await page.getByRole('button', { name: 'Colors' }).click()
  await page.getByRole('button', { name: 'Use Red for the QR code' }).click()

  await page.getByRole('button', { name: 'Gradient' }).click()
  await page.getByRole('button', { name: 'Directional' }).click()
  await page.getByRole('button', { name: 'Use Blue as the 2nd gradient color' }).click()

  await page.getByRole('button', { name: 'Label', exact: true }).click()
  await page.locator('input[placeholder="Add a word"]').fill(draftLabel)
  await page.locator('#qr-additional-text').fill(draftAdditionalText)

  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await page.getByRole('radio', { name: 'Thin border' }).click()

  await page.getByRole('button', { name: 'Icon' }).click()
  await page.getByRole('button', { name: 'Open Website icons' }).click()
  await page.getByRole('radio', { name: 'Use Link as the center icon' }).click()
}

async function expectDraftControls(page: Page, expectedUrl: string) {
  await expect(page.locator('input[type="url"]')).toHaveValue(expectedUrl)

  await page.getByRole('button', { name: 'Label', exact: true }).click()
  await expect(page.locator('input[placeholder="Add a word"]')).toHaveValue(draftLabel)
  await expect(page.locator('#qr-additional-text')).toHaveValue(draftAdditionalText)

  await page.getByRole('button', { name: 'Colors' }).click()
  await expect(page.getByRole('button', { name: 'Use Red for the QR code' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Gradient' })).toBeVisible()

  await page.getByRole('button', { name: 'Gradient' }).click()
  await expect(page.getByRole('button', { name: 'Directional' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Use Blue as the 2nd gradient color' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Thin border' })).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('button', { name: 'Icon' }).click()

  const linkIcon = page.getByRole('radio', { name: 'Use Link as the center icon' })

  if (!await linkIcon.isVisible()) {
    await page.getByRole('button', { name: 'Open Website icons' }).click()
  }

  await expect(linkIcon).toHaveAttribute('aria-checked', 'true')
}

async function expectStoredDraft(page: Page, expected: Record<string, unknown>) {
  await expect.poll(() => getStoredDraft(page)).toEqual(expect.objectContaining(expected))
}

async function getStoredDraft(page: Page) {
  return page.evaluate((storageKey) => {
    const rawDraft = sessionStorage.getItem(storageKey)

    return rawDraft ? JSON.parse(rawDraft) as Record<string, unknown> : null
  }, currentQrDraftStorageKey)
}
