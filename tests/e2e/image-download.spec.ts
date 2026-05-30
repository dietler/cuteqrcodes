import { readFile } from 'node:fs/promises'
import { expect, type Page, test } from '@playwright/test'

const adminEmail = 'andy+testdesktop@dietler.net'

test('downloads generated QR artwork as SVG or PNG from the builder', async ({ page }) => {
  await routeSession(page, null)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com/image-download')

  const downloadButton = page.getByRole('button', { name: 'Download Image' })
  const printButton = page.getByRole('button', { name: 'Print to Labels', exact: true })

  await expect(downloadButton).toBeVisible()
  await expect(printButton).toBeVisible()

  const downloadBox = await downloadButton.boundingBox()
  const printBox = await printButton.boundingBox()

  expect(downloadBox?.x).toBeLessThan(printBox?.x ?? 0)

  await downloadButton.click()

  const svgDownloadPromise = page.waitForEvent('download')

  await page.getByRole('menuitem', { name: 'SVG' }).click()

  const svgDownload = await svgDownloadPromise
  const svgPath = await svgDownload.path()

  expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/)
  expect(svgPath).toBeTruthy()

  const svgText = await readFile(svgPath!, 'utf8')

  expect(svgText).toContain('<svg')
  expect(svgText).toContain('xmlns="http://www.w3.org/2000/svg"')
  expect(svgText).toContain('width=')
  expect(svgText).toContain('height=')
  expect(getSvgDimension(svgText, 'width')).toBe(500)
  expect(getSvgDimension(svgText, 'height')).toBe(500)

  await downloadButton.click()

  const pngDownloadPromise = page.waitForEvent('download')

  await page.getByRole('menuitem', { name: 'PNG' }).click()

  const pngDownload = await pngDownloadPromise
  const pngPath = await pngDownload.path()

  expect(pngDownload.suggestedFilename()).toMatch(/\.png$/)
  expect(pngPath).toBeTruthy()

  const pngBytes = await readFile(pngPath!)

  expect(Array.from(pngBytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(pngBytes.readUInt32BE(16)).toBe(500)
  expect(pngBytes.readUInt32BE(20)).toBe(500)
})

test('shows the QR settings export only to admin accounts', async ({ page }) => {
  await routeSession(page, 'user@example.com')

  await page.goto('/')
  await waitForBuilder(page)
  await page.locator('input[type="url"]').fill('https://example.com/non-admin-export')

  const downloadButton = page.getByRole('button', { name: 'Download Image' })

  await downloadButton.click()
  await expect(page.getByRole('menuitem', { name: 'Export' })).toHaveCount(0)
})

test('downloads QR settings as JSON from the admin export option', async ({ page }) => {
  await routeSession(page, adminEmail)

  await page.goto('/')
  await waitForBuilder(page)
  await page.locator('input[type="url"]').fill('https://example.com/admin-export')
  await page.getByRole('button', { name: 'Colors' }).click()
  await page.getByRole('button', { name: 'Use Red for the QR code' }).click()
  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Label' }).fill('Admin Export')
  await page.locator('#qr-additional-text').fill('Reusable settings')

  await page.getByRole('button', { name: 'Download Image' }).click()

  const jsonDownloadPromise = page.waitForEvent('download')

  await page.getByRole('menuitem', { name: 'Export' }).click()

  const jsonDownload = await jsonDownloadPromise
  const jsonPath = await jsonDownload.path()

  expect(jsonDownload.suggestedFilename()).toBe('example-com-settings.json')
  expect(jsonPath).toBeTruthy()

  const payload = JSON.parse(await readFile(jsonPath!, 'utf8')) as Record<string, unknown>

  expect(payload).toEqual(expect.objectContaining({
    additionalText: 'Reusable settings',
    colorName: 'Red',
    label: 'Admin Export',
    url: 'https://example.com/admin-export',
    version: 1
  }))
})

function getSvgDimension(svgText: string, attribute: 'height' | 'width') {
  const match = svgText.match(new RegExp(`\\s${attribute}="([^"]+)"`))

  return match ? Number(match[1]) : Number.NaN
}

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
              id: 'session-image-download',
              token: 'session-image-download',
              updatedAt: '2026-05-28T00:00:00.000Z',
              userId: 'user-image-download'
            },
            user: {
              createdAt: '2026-05-28T00:00:00.000Z',
              email,
              emailVerified: true,
              id: 'user-image-download',
              name: email,
              updatedAt: '2026-05-28T00:00:00.000Z'
            }
          }
        : null)
    })
  )
}
