import type { H3Event } from 'h3'
import { getDynamicQrLinkBySlug, getDynamicQrScanSource, normalizeDynamicQrSlugForServer, recordDynamicQrScan } from '~~/server/utils/dynamic-qr'

export async function handleDynamicQrRedirect(event: H3Event) {
  const slug = normalizeDynamicQrSlugForServer(getRouterParam(event, 'slug') || '')
  const sql = useNeon()
  const link = await getDynamicQrLinkBySlug(sql, slug)

  if (!link) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Dynamic QR link not found.'
    })
  }

  if (link.trackStatistics) {
    await recordDynamicQrScan(sql, link.id, getDynamicQrScanSource(event))
  }

  return sendRedirect(event, link.destinationUrl, 302)
}
