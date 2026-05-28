export type DynamicQrLinkPayload = {
  destinationUrl: string
  id: string
  redirectUrl: string
  slug: string
  trackStatistics: boolean
  useDynamicUrl: boolean
}

export type DynamicQrLinkResponse = {
  balance: number
  link: DynamicQrLinkPayload
}

export const dynamicQrRedirectBaseUrl = 'https://qrcodesonlabels.com/redirect'
export const dynamicQrSlugMaxLength = 64
export const dynamicQrSlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

export function createDynamicQrRedirectUrl(slug: string) {
  return `${dynamicQrRedirectBaseUrl}/${encodeURIComponent(slug)}`
}

export function createRandomDynamicQrSlug() {
  const randomValue = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replaceAll('-', '')
    : Math.random().toString(36).slice(2)

  return normalizeDynamicQrSlug(randomValue.slice(0, 12)) || 'qr-link'
}

export function normalizeDynamicQrSlug(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, dynamicQrSlugMaxLength)
    .replace(/-+$/g, '')
}

export function isValidDynamicQrSlug(value: string) {
  return dynamicQrSlugPattern.test(value)
}
