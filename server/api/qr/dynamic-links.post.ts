import type { DynamicQrLinkResponse } from '~~/app/utils/dynamic-qr'
import { createOrUpdateDynamicQrLink, normalizeDestinationUrl, normalizeDynamicQrSlugForServer } from '~~/server/utils/dynamic-qr'

type DynamicLinkBody = {
  destinationUrl?: unknown
  existingLinkId?: unknown
  slug?: unknown
  trackStatistics?: unknown
  useDynamicUrl?: unknown
}

export default defineEventHandler(async (event): Promise<DynamicQrLinkResponse> => {
  const session = await requireUserSession(event)
  const body = await readBody<DynamicLinkBody>(event)
  const sql = useNeon()

  return createOrUpdateDynamicQrLink(sql, {
    destinationUrl: normalizeDestinationUrl(body?.destinationUrl),
    existingLinkId: typeof body?.existingLinkId === 'string' ? body.existingLinkId : undefined,
    slug: normalizeDynamicQrSlugForServer(body?.slug),
    trackStatistics: body?.trackStatistics === true,
    useDynamicUrl: body?.useDynamicUrl === true,
    userId: session.user.id
  })
})
