import { expect, test } from '@playwright/test'

const addedCenterIcons = [
  { folder: 'Faces', icons: ['Smile', 'Laugh', 'Wink'] },
  { folder: 'Mystery', icons: ['Clue', 'Padlock', 'Puzzle', 'Question Mark'] },
  { folder: 'Restaurant', icons: ['Dessert', 'Pastry', 'Salad'] },
  { folder: 'Rewards', icons: ['Gift', 'Trophy'] }
]

test('shows added center icons and lets them be selected', async ({ page }) => {
  await page.goto('/')
  const urlInput = page.locator('input[type="url"]')

  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await urlInput.fill('https://example.com/new-center-icons')

  await page.getByRole('button', { name: 'Icon' }).click()

  for (const { folder, icons } of addedCenterIcons) {
    await page.getByRole('button', { name: `Open ${folder} icons` }).click()

    for (const icon of icons) {
      await expect(page.getByRole('radio', { name: `Use ${icon} as the center icon` })).toBeVisible()
    }

    const iconOption = page.getByRole('radio', { name: `Use ${icons[icons.length - 1]} as the center icon` })

    await iconOption.click()
    await expect(iconOption).toHaveAttribute('aria-checked', 'true')

    await page.getByRole('button', { name: 'Folders' }).click()
  }
})

test('uses high error correction with version 3 minimum when a center icon is selected', async ({ page }) => {
  await page.goto('/')
  const urlInput = page.locator('input[type="url"]')

  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await urlInput.fill('https://q.co')

  const qrSvg = page.locator('svg[aria-label="Generated QR code"]')

  await expect(qrSvg).toHaveAttribute('data-error-correction-level', 'medium')
  await expect(page.getByText('Version 1', { exact: false })).toBeVisible()

  await page.getByRole('button', { name: 'Icon' }).click()
  await page.getByRole('button', { name: 'Open Restaurant icons' }).click()
  await page.getByRole('radio', { name: 'Use Salad as the center icon' }).click()

  await expect(qrSvg).toHaveAttribute('data-error-correction-level', 'high')
  await expect(page.getByText('Version 3', { exact: false })).toBeVisible()
})
