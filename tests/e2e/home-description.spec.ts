import { expect, test } from '@playwright/test'

const descriptionText = 'Create QR Codes for Menus, Waivers, Websites, Events, Documents, Tickets, Reviews, Music, Payment, Chat and more. Enter your URL. Customize the look and feel, and then select the label size you would like to print your QR Code on. Register for an account to Save QR Code designs.'
const descriptionCookieName = 'cuteqrcodes_home_description_dismissed'

test('dismisses the homepage description and remembers it with a cookie', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))

  const description = page.getByText(descriptionText, { exact: true })

  await expect(description).toBeVisible()

  await page.getByRole('button', { name: 'Dismiss homepage description' }).click()

  await expect(description).toBeHidden()

  const cookies = await page.context().cookies()
  const descriptionCookie = cookies.find(cookie => cookie.name === descriptionCookieName)

  expect(descriptionCookie?.value).toBe('1')

  await page.reload()

  await expect(page.getByText(descriptionText, { exact: true })).toBeHidden()
})
