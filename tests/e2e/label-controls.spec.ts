import { expect, test } from '@playwright/test'

test('aligns label panel controls', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com')
  await page.getByRole('button', { name: 'Label', exact: true }).click()

  const metrics = await page.evaluate(() => {
    function bounds(selector: string) {
      const element = document.querySelector(selector)

      if (!element) {
        throw new Error(`Missing element: ${selector}`)
      }

      const rect = element.getBoundingClientRect()

      return {
        height: rect.height,
        top: rect.top
      }
    }

    return {
      additionalDecrease: bounds('button[aria-label="Decrease additional text size"]'),
      additionalFont: bounds('button[role="combobox"][aria-labelledby="qr-additional-font-label"]'),
      additionalInput: bounds('#qr-additional-text'),
      labelDecrease: bounds('button[aria-label="Decrease label size"]'),
      labelFont: bounds('button[role="combobox"]:not([aria-labelledby])'),
      labelInput: bounds('input[placeholder="Add a word"]')
    }
  })

  const controlNames = Object.keys(metrics) as Array<keyof typeof metrics>

  for (const name of controlNames) {
    expect(metrics[name].height).toBeCloseTo(36, 0)
  }

  expect(metrics.labelDecrease.top).toBeCloseTo(metrics.labelInput.top, 0)
  expect(metrics.labelFont.top).toBeCloseTo(metrics.labelInput.top, 0)
  expect(metrics.additionalDecrease.top).toBeCloseTo(metrics.additionalInput.top, 0)
  expect(metrics.additionalFont.top).toBeCloseTo(metrics.additionalInput.top, 0)
})

test('positions side labels beside the QR code', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com/side-label-test')
  await page.getByRole('button', { name: 'Label', exact: true }).click()
  await page.locator('input[placeholder="Add a word"]').fill('A very long side label for width fitting')
  await page.locator('#qr-additional-text').fill('Centered beside QR')
  await page.waitForFunction(() => document.fonts?.ready)

  const leftPosition = page.getByRole('radio', { name: 'Left' })
  const rightPosition = page.getByRole('radio', { name: 'Right' })

  await expect(leftPosition).toBeEnabled()
  await expect(rightPosition).toBeEnabled()

  await leftPosition.click()

  const leftMetrics = await page.evaluate(getSideLabelMetrics)

  expect(leftMetrics.textX).toBeLessThan(leftMetrics.qrX)
  expect(leftMetrics.qrX).toBeCloseTo(leftMetrics.qrSize + leftMetrics.gap, 4)
  expect(leftMetrics.outputWidth).toBeCloseTo(leftMetrics.qrSize * 2 + leftMetrics.gap, 4)
  expect(leftMetrics.textBlockCenterY).toBeCloseTo(leftMetrics.qrCenterY, 4)
  expect(leftMetrics.maxTextWidth).toBeLessThanOrEqual(leftMetrics.qrSize + 0.01)

  await rightPosition.click()

  const rightMetrics = await page.evaluate(getSideLabelMetrics)

  expect(rightMetrics.qrX).toBeCloseTo(0, 4)
  expect(rightMetrics.textX).toBeGreaterThan(rightMetrics.qrX + rightMetrics.qrSize)
  expect(rightMetrics.textX).toBeCloseTo(rightMetrics.qrSize + rightMetrics.gap + rightMetrics.qrSize / 2, 4)
  expect(rightMetrics.outputWidth).toBeCloseTo(rightMetrics.qrSize * 2 + rightMetrics.gap, 4)
  expect(rightMetrics.textBlockCenterY).toBeCloseTo(rightMetrics.qrCenterY, 4)
  expect(rightMetrics.maxTextWidth).toBeLessThanOrEqual(rightMetrics.qrSize + 0.01)
})

test('resizes long additional text visibly', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com/additional-text-size')
  await page.getByRole('button', { name: 'Label', exact: true }).click()
  await page.locator('input[placeholder="Add a word"]').fill('Testing big')
  await page.locator('#qr-additional-text').fill('and smaller because we love to have some smaller text as well here')
  await page.evaluate(() => document.fonts?.ready)

  const before = await page.evaluate(getAdditionalTextMetrics)

  await page.getByRole('button', { name: 'Increase additional text size' }).click()

  const afterIncrease = await page.evaluate(getAdditionalTextMetrics)

  expect(afterIncrease.fontSize).toBeGreaterThan(before.fontSize * 1.2)
  expect(afterIncrease.maxTextWidth).toBeLessThanOrEqual(afterIncrease.qrSize + 0.01)

  await page.getByRole('button', { name: 'Decrease additional text size' }).click()
  await page.getByRole('button', { name: 'Decrease additional text size' }).click()

  const afterDecrease = await page.evaluate(getAdditionalTextMetrics)

  expect(afterDecrease.fontSize).toBeLessThan(before.fontSize * 0.8)
  expect(afterDecrease.maxTextWidth).toBeLessThan(afterIncrease.maxTextWidth)
})

function getSideLabelMetrics() {
  const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
  const qrSvg = svg?.querySelector('g svg') as SVGSVGElement | null

  if (!svg || !qrSvg) {
    throw new Error('Missing generated QR SVG.')
  }

  const visibleTextElements = Array.from(svg.querySelectorAll('text'))
    .filter(element => element.getAttribute('opacity') !== '0' && element.textContent?.trim())

  if (!visibleTextElements.length) {
    throw new Error('Missing visible side label text.')
  }

  const textBounds = visibleTextElements.map((element) => {
    const y = Number(element.getAttribute('y'))
    const height = Number(element.getAttribute('font-size'))

    return {
      bottom: y + height / 2,
      top: y - height / 2,
      width: element.getComputedTextLength(),
      x: Number(element.getAttribute('x'))
    }
  })

  const outputWidth = svg.viewBox.baseVal.width
  const qrSize = Number(qrSvg.getAttribute('width'))
  const qrX = Number(qrSvg.getAttribute('x'))
  const qrY = Number(qrSvg.getAttribute('y'))

  return {
    gap: outputWidth - qrSize * 2,
    maxTextWidth: Math.max(...textBounds.map(bounds => bounds.width)),
    outputWidth,
    qrCenterY: qrY + qrSize / 2,
    qrSize,
    qrX,
    textBlockCenterY: (Math.min(...textBounds.map(bounds => bounds.top)) + Math.max(...textBounds.map(bounds => bounds.bottom))) / 2,
    textX: textBounds[0]!.x
  }
}

function getAdditionalTextMetrics() {
  const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
  const qrSvg = svg?.querySelector('g svg') as SVGSVGElement | null

  if (!svg || !qrSvg) {
    throw new Error('Missing generated QR SVG.')
  }

  const additionalTextElements = Array.from(svg.querySelectorAll('text'))
    .filter(element => element.getAttribute('opacity') !== '0' && element.textContent?.trim() !== 'Testing big')

  if (!additionalTextElements.length) {
    throw new Error('Missing visible additional text.')
  }

  const fontSizes = additionalTextElements.map(element => Number(element.getAttribute('font-size')))
  const widths = additionalTextElements.map(element => element.getComputedTextLength())

  return {
    fontSize: fontSizes[0]!,
    lineCount: additionalTextElements.length,
    maxTextWidth: Math.max(...widths),
    qrSize: Number(qrSvg.getAttribute('width'))
  }
}
