import { expect, test } from '@playwright/test'

const sideLabelTextFitRatio = 0.92
const sideLabelAdditionalTextGapRatio = 0.18

test('aligns label panel controls', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com')
  await page.getByRole('button', { name: 'Label', exact: true }).click()

  const primaryControls = page.getByTestId('rectangle-label-desktop-primary-controls')
  const additionalControls = page.getByTestId('rectangle-label-desktop-additional-controls')

  await expect(page.getByRole('radio', { name: 'Top' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radiogroup', { name: 'Label position' }).locator('button').first()).toHaveText('Top')

  const metrics = await page.evaluate(() => {
    function bounds(rootSelector: string, selector: string) {
      const root = document.querySelector(rootSelector)
      const element = root?.querySelector(selector)

      if (!element) {
        throw new Error(`Missing element: ${rootSelector} ${selector}`)
      }

      const rect = element.getBoundingClientRect()

      return {
        height: rect.height,
        top: rect.top
      }
    }

    return {
      additionalDecrease: bounds('[data-testid="rectangle-label-desktop-additional-controls"]', 'button[aria-label="Decrease additional text size"]'),
      additionalFont: bounds('[data-testid="rectangle-label-desktop-additional-controls"]', 'button[role="combobox"][aria-labelledby="qr-additional-font-label"]'),
      additionalInput: bounds('[data-testid="rectangle-label-desktop-additional-controls"]', '#qr-additional-text'),
      labelDecrease: bounds('[data-testid="rectangle-label-desktop-primary-controls"]', 'button[aria-label="Decrease label size"]'),
      labelFont: bounds('[data-testid="rectangle-label-desktop-primary-controls"]', 'button[role="combobox"]:not([aria-labelledby])'),
      labelInput: bounds('[data-testid="rectangle-label-desktop-primary-controls"]', 'input[placeholder="Add a word"]')
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
  await expect(primaryControls).toBeVisible()
  await expect(additionalControls).toBeVisible()
})

test('positions side labels beside the QR code', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com/side-label-test')
  await page.getByRole('button', { name: 'Label', exact: true }).click()
  await page.getByTestId('rectangle-label-desktop-primary-controls').getByPlaceholder('Add a word').fill('A very long side label for width fitting')
  await page.getByTestId('rectangle-label-desktop-additional-controls').locator('#qr-additional-text').fill('Centered beside QR')
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
  expect(leftMetrics.maxTextWidth).toBeLessThanOrEqual(leftMetrics.qrSize * sideLabelTextFitRatio + 0.01)
  expect(leftMetrics.labelToAdditionalTextGap).toBeCloseTo(leftMetrics.labelFontSize * sideLabelAdditionalTextGapRatio, 4)

  await rightPosition.click()

  const rightMetrics = await page.evaluate(getSideLabelMetrics)

  expect(rightMetrics.qrX).toBeCloseTo(0, 4)
  expect(rightMetrics.textX).toBeGreaterThan(rightMetrics.qrX + rightMetrics.qrSize)
  expect(rightMetrics.textX).toBeCloseTo(rightMetrics.qrSize + rightMetrics.gap + rightMetrics.qrSize / 2, 4)
  expect(rightMetrics.outputWidth).toBeCloseTo(rightMetrics.qrSize * 2 + rightMetrics.gap, 4)
  expect(rightMetrics.textBlockCenterY).toBeCloseTo(rightMetrics.qrCenterY, 4)
  expect(rightMetrics.maxTextWidth).toBeLessThanOrEqual(rightMetrics.qrSize + 0.01)
  expect(rightMetrics.maxTextWidth).toBeLessThanOrEqual(rightMetrics.qrSize * sideLabelTextFitRatio + 0.01)
  expect(rightMetrics.labelToAdditionalTextGap).toBeCloseTo(rightMetrics.labelFontSize * sideLabelAdditionalTextGapRatio, 4)
})

test('resizes long additional text visibly', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com/additional-text-size')
  await page.getByRole('button', { name: 'Label', exact: true }).click()
  const primaryControls = page.getByTestId('rectangle-label-desktop-primary-controls')
  const additionalControls = page.getByTestId('rectangle-label-desktop-additional-controls')

  await primaryControls.getByPlaceholder('Add a word').fill('Testing big')
  await additionalControls.locator('#qr-additional-text').fill('and smaller because we love to have some smaller text as well here')
  await page.evaluate(() => document.fonts?.ready)

  const before = await page.evaluate(getAdditionalTextMetrics)

  await additionalControls.getByRole('button', { name: 'Increase additional text size' }).click()

  const afterIncrease = await page.evaluate(getAdditionalTextMetrics)

  expect(afterIncrease.fontSize).toBeGreaterThan(before.fontSize * 1.2)
  expect(afterIncrease.maxTextWidth).toBeLessThanOrEqual(afterIncrease.qrSize + 0.01)

  await additionalControls.getByRole('button', { name: 'Decrease additional text size' }).click()
  await additionalControls.getByRole('button', { name: 'Decrease additional text size' }).click()

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
      text: element.textContent?.trim() ?? '',
      top: y - height / 2,
      width: element.getComputedTextLength(),
      x: Number(element.getAttribute('x'))
    }
  }).sort((first, second) => first.top - second.top)

  const outputWidth = svg.viewBox.baseVal.width
  const qrSize = Number(qrSvg.getAttribute('width'))
  const qrX = Number(qrSvg.getAttribute('x'))
  const qrY = Number(qrSvg.getAttribute('y'))

  return {
    gap: outputWidth - qrSize * 2,
    labelFontSize: textBounds[0]!.bottom - textBounds[0]!.top,
    labelToAdditionalTextGap: textBounds.length > 1 ? textBounds[1]!.top - textBounds[0]!.bottom : 0,
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
