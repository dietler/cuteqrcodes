import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('downloads generated QR artwork as SVG or PNG from the builder', async ({ page }) => {
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

  await downloadButton.click()

  const pngDownloadPromise = page.waitForEvent('download')

  await page.getByRole('menuitem', { name: 'PNG' }).click()

  const pngDownload = await pngDownloadPromise
  const pngPath = await pngDownload.path()

  expect(pngDownload.suggestedFilename()).toMatch(/\.png$/)
  expect(pngPath).toBeTruthy()

  const pngBytes = await readFile(pngPath!)

  expect(Array.from(pngBytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
})
