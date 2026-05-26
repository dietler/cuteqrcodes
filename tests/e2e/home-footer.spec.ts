import { expect, test } from '@playwright/test'

test('shows the support footer with an email link', async ({ page }) => {
  await page.goto('/')

  const footer = page.getByRole('contentinfo')

  await expect(footer).toContainText('Questions? Issues? Suggestions? E-mail me at andy@qrcodesonlabels.com and I\'ll get back to you ASAP.')
  await expect(footer.getByRole('link', { name: 'andy@qrcodesonlabels.com' })).toHaveAttribute('href', 'mailto:andy@qrcodesonlabels.com')
})
