import type { DynamicQrSlugAvailabilityResponse } from '~~/app/utils/dynamic-qr'
import { ensureDynamicQrTables, normalizeDynamicQrSlugForServer } from '~~/server/utils/dynamic-qr'

export default defineEventHandler(async (event): Promise<DynamicQrSlugAvailabilityResponse> => {
  const session = await requireUserSession(event)
  const query = getQuery(event)
  const slug = normalizeDynamicQrSlugForServer(query.slug)
  const existingLinkId = typeof query.existingLinkId === 'string' ? query.existingLinkId : ''
  const sql = useNeon()

  await ensureDynamicQrTables(sql)

  const rows = await sql`
    select id, user_id
    from dynamic_qr_links
    where slug = ${slug}
    limit 1
  `
  const existingLink = rows[0] as Record<string, unknown> | undefined

  return {
    available: !existingLink
      || (existingLink.id === existingLinkId && existingLink.user_id === session.user.id),
    slug
  }
})
