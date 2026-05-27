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
