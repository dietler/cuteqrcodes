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

export type DynamicQrSlugAvailabilityResponse = {
  available: boolean
  slug: string
}

export type DynamicQrScanSummary = {
  count: number
  label: string
}

export type DynamicQrRecentScan = {
  city: string | null
  country: string | null
  id: string
  region: string | null
  scannedAt: string
}

export type DynamicQrStats = {
  lastScannedAt: string | null
  recentScans: DynamicQrRecentScan[]
  scansByCountry: DynamicQrScanSummary[]
  scansByDay: DynamicQrScanSummary[]
  totalScans: number
}

export const dynamicQrRedirectBaseUrl = 'https://qrcodesonlabels.com/r'
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
