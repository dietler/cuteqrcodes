import { expect, test } from '@playwright/test'

test('shows the support and made-with footer on a white background', async ({ page }) => {
  await page.goto('/')

  const footer = page.getByRole('contentinfo')

  await expect(footer).toContainText('Questions? Issues? Suggestions? E-mail me at andy@qrcodesonlabels.com and I\'ll get back to you ASAP.')
  await expect(footer.getByRole('link', { name: 'andy@qrcodesonlabels.com' })).toHaveAttribute('href', 'mailto:andy@qrcodesonlabels.com')
  await expect(footer).toContainText('Made with')
  await expect(footer).toContainText('and')
  await expect(footer).toContainText('in Livermore, California')
  await expect(footer).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})
