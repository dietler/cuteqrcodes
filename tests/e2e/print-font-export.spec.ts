import { expect, test } from '@playwright/test'

const labelPrintPayloadStorageKey = 'cuteqrcodes.labelPrintPayload'
const labelText = 'Claire\'s Creative Play'
const configuredLabelFontFamilies = [
  'Google Sans',
  'Bebas Neue',
  'Oswald',
  'Roboto',
  'Roboto Condensed',
  'Figtree',
  'Libre Baskerville',
  'Changa One',
  'Lexend',
  'Rye',
  'Sancreek',
  'IM Fell Great Primer',
  'Creepster',
  'Jersey 25'
]

test('embeds selected web fonts in the print-label SVG payload', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com/claires-creative-play')
  await page.waitForFunction(() => document.fonts?.ready)

  const missingFontFamilies = await page.evaluate((fontFamilies) => {
    const fontFaceFamilies = new Set<string>()

    Array.from(document.styleSheets).forEach((styleSheet) => {
      let rules: CSSRuleList

      try {
        rules = styleSheet.cssRules
      } catch {
        return
      }

      Array.from(rules).forEach((rule) => {
        const isFontFaceRule = typeof CSSFontFaceRule !== 'undefined'
          ? rule instanceof CSSFontFaceRule
          : rule.type === CSSRule.FONT_FACE_RULE

        if (!isFontFaceRule) {
          return
        }

        const fontFamily = (rule as CSSFontFaceRule).style
          .getPropertyValue('font-family')
          .trim()
          .replace(/^['"]/, '')
          .replace(/['"]$/, '')
          .toLowerCase()

        fontFaceFamilies.add(fontFamily)
      })
    })

    return fontFamilies.filter(fontFamily => !fontFaceFamilies.has(fontFamily.toLowerCase()))
  }, configuredLabelFontFamilies)

  expect(missingFontFamilies).toEqual([])

  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
  await page.getByTestId('rectangle-label-desktop-primary-controls').getByPlaceholder('Add a word').fill(labelText)
  await page.getByTestId('rectangle-label-desktop-primary-controls').getByRole('combobox').click()
  await page.getByRole('option', { name: 'Roboto Condensed' }).click()
  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await page.getByRole('radio', { name: 'Medium' }).click()
  await page.waitForFunction(() => document.fonts?.ready)
  await page.getByRole('button', { name: 'Print to Labels', exact: true }).click()
  await page.waitForURL('**/print-labels')
  await expect(page.getByText('Print to Labels')).toBeVisible()

  const payloadDetails = await page.evaluate(({ label, storageKey }) => {
    const rawPayload = sessionStorage.getItem(storageKey)
    const svg = rawPayload ? (JSON.parse(rawPayload) as { svg: string }).svg : ''
    const parsedSvg = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const labelElement = Array.from(parsedSvg.querySelectorAll('text'))
      .find(element => element.textContent === label && element.getAttribute('opacity') !== '0')

    return {
      hasDataUrl: svg.includes('data:'),
      hasEmbeddedFontStyle: svg.includes('data-cuteqrcodes-embedded-fonts'),
      hasFontFace: svg.includes('@font-face'),
      hasLabelText: svg.includes(label),
      hasRobotoCondensedLabel: Boolean(labelElement?.style.getPropertyValue('font-family').includes('Roboto Condensed'))
    }
  }, { label: labelText, storageKey: labelPrintPayloadStorageKey })

  expect(payloadDetails).toEqual({
    hasDataUrl: true,
    hasEmbeddedFontStyle: true,
    hasFontFace: true,
    hasLabelText: true,
    hasRobotoCondensedLabel: true
  })
})
