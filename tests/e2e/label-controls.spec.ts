import { expect, test } from '@playwright/test'

test('aligns label panel controls', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com')
  await page.getByRole('button', { name: 'Label' }).click()

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
