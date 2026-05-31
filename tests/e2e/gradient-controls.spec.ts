import { expect, test } from '@playwright/test'

test('applies separate QR gradients after choosing a non-black first color', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com/gradient-test')

  await page.getByRole('button', { name: 'Colors' }).click()
  await expect(page.getByRole('button', { name: 'Gradient' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Use Red for the QR code' }).click()
  await expect(page.getByRole('button', { name: 'Gradient' })).toBeVisible()

  await page.getByRole('button', { name: 'Use Black for the QR code' }).click()
  await expect(page.getByRole('button', { name: 'Gradient' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Use Red for the QR code' }).click()
  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Label' }).fill('Gradient')
  await page.locator('#qr-additional-text').fill('Label text')

  await page.getByRole('button', { name: 'Icon' }).click()
  await page.getByRole('button', { name: 'Open Website icons' }).click()
  await page.getByRole('radio', { name: 'Use Link as the center icon' }).click()

  await page.getByRole('button', { name: 'Border' }).click()
  await page.getByRole('radio', { name: 'Small' }).click()

  await page.getByRole('button', { name: 'Gradient' }).click()
  await expect(page.getByRole('button', { name: 'No Gradient' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Directional' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Radial' })).toBeVisible()

  await page.getByRole('button', { name: 'Radial' }).click()
  await expect(page.getByRole('button', { name: 'Left to Right' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Directional' }).click()
  await expect(page.getByRole('button', { name: 'Left to Right' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Top to Bottom' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Diagonal' })).toBeVisible()
  await page.getByRole('button', { name: 'Diagonal' }).click()

  await expect(page.getByText('2nd Color')).toBeVisible()
  await expect(page.getByText('3rd Color', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use no 3rd gradient color' })).toHaveText('No 3rd Color')

  await page.getByRole('button', { name: 'Use Blue as the 2nd gradient color' }).click()
  await page.getByRole('button', { name: 'Use Fuchsia as the 3rd gradient color' }).click()
  await expect(page.getByTestId('gradient-second-color-step-control')).toContainText('Blue 500')
  await expect(page.getByTestId('gradient-third-color-step-control')).toContainText('Fuchsia 500')
  await page.getByTestId('gradient-second-color-step-control').getByRole('slider').press('ArrowRight')
  await page.getByTestId('gradient-third-color-step-control').getByRole('slider').press('ArrowLeft')
  await expect(page.getByTestId('gradient-second-color-step-control')).toContainText('Blue 600')
  await expect(page.getByTestId('gradient-third-color-step-control')).toContainText('Fuchsia 400')

  const gradientState = await page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null

    if (!svg) {
      throw new Error('Missing generated QR SVG.')
    }

    const qrSvg = svg.querySelector('g svg') as SVGSVGElement | null
    const textFills = Array.from(svg.querySelectorAll('text'))
      .filter(element => element.getAttribute('opacity') !== '0')
      .map(element => element.getAttribute('fill'))
    const borderStrokes = Array.from(svg.querySelectorAll('rect[fill="none"]'))
      .map(element => element.getAttribute('stroke'))

    return {
      borderStops: svg.querySelectorAll('#qr-border-gradient stop').length,
      borderStrokes,
      gradientIds: Array.from(svg.querySelectorAll('linearGradient, radialGradient')).map(element => element.id).sort(),
      iconFill: svg.querySelector('rect[mask="url(#center-icon-mask)"]')?.getAttribute('fill'),
      pathFill: qrSvg?.querySelector('path')?.getAttribute('fill'),
      pathStopClasses: Array.from(qrSvg?.querySelectorAll('#qr-path-gradient stop') ?? []).map(element => element.getAttribute('class')),
      pathStops: qrSvg?.querySelectorAll('#qr-path-gradient stop').length,
      textFills,
      textStops: svg.querySelectorAll('#qr-text-gradient stop').length
    }
  })

  expect(gradientState.gradientIds).toEqual(expect.arrayContaining([
    'qr-artwork-gradient',
    'qr-border-gradient',
    'qr-path-gradient',
    'qr-text-gradient'
  ]))
  expect(gradientState.pathFill).toBe('url(#qr-path-gradient)')
  expect(gradientState.iconFill).toBe('url(#qr-artwork-gradient)')
  expect(gradientState.borderStrokes).toContain('url(#qr-border-gradient)')
  expect(gradientState.textFills).toContain('url(#qr-text-gradient)')
  expect(gradientState.borderStops).toBe(3)
  expect(gradientState.pathStops).toBe(3)
  expect(gradientState.textStops).toBe(3)
  expect(gradientState.pathStopClasses).toEqual(['text-red-500', 'text-blue-600', 'text-fuchsia-400'])
})
