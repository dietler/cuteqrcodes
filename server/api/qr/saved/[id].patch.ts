import type { DynamicQrLinkPayload } from '~~/app/utils/dynamic-qr'
import { ensureDynamicQrTables } from '~~/server/utils/dynamic-qr'
import { ensureSavedQrTables, mapSavedQrRow, normalizeTags } from '~~/server/utils/saved-qr'

type UpdateSavedQrBody = {
  dynamicLink?: unknown
  tags?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody<UpdateSavedQrBody>(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'QR code id is required.'
    })
  }

  const tags = Object.hasOwn(body || {}, 'tags') ? normalizeTags(body?.tags) : undefined
  const dynamicLink = Object.hasOwn(body || {}, 'dynamicLink')
    ? normalizeDynamicLink(body?.dynamicLink)
    : undefined
  const sql = useNeon()

  await Promise.all([
    ensureDynamicQrTables(sql),
    ensureSavedQrTables(sql)
  ])

  const existingRows = await sql`
    select id
    from saved_qr_codes
    where id = ${id}
      and user_id = ${session.user.id}
    limit 1
  `

  if (!existingRows.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'QR code not found.'
    })
  }

  if (dynamicLink) {
    const linkRows = await sql`
      select id
      from dynamic_qr_links
      where id = ${dynamicLink.id}
        and user_id = ${session.user.id}
      limit 1
    `

    if (!linkRows.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Dynamic QR link not found.'
      })
    }
  }

  if (typeof tags !== 'undefined' && dynamicLink) {
    await sql`
      update saved_qr_codes
      set tags = ${tags},
          payload = jsonb_set(payload, '{dynamicLink}', ${JSON.stringify(dynamicLink)}::jsonb, true),
          updated_at = now()
      where id = ${id}
        and user_id = ${session.user.id}
    `
  } else if (typeof tags !== 'undefined') {
    await sql`
      update saved_qr_codes
      set tags = ${tags},
          updated_at = now()
      where id = ${id}
        and user_id = ${session.user.id}
    `
  } else if (dynamicLink) {
    await sql`
      update saved_qr_codes
      set payload = jsonb_set(payload, '{dynamicLink}', ${JSON.stringify(dynamicLink)}::jsonb, true),
          updated_at = now()
      where id = ${id}
        and user_id = ${session.user.id}
    `
  }

  const rows = await sql`
    select
      saved_qr_codes.id,
      saved_qr_codes.name,
      saved_qr_codes.payload,
      saved_qr_codes.preview_svg,
      saved_qr_codes.preview_width,
      saved_qr_codes.preview_height,
      saved_qr_codes.status,
      saved_qr_codes.tags,
      saved_qr_codes.pdf_purchase_id,
      saved_qr_codes.created_at,
      saved_qr_codes.updated_at,
      dynamic_qr_links.id as dynamic_link_id,
      dynamic_qr_links.destination_url as dynamic_destination_url,
      concat('https://qrcodesonlabels.com/redirect/', dynamic_qr_links.slug) as dynamic_redirect_url,
      dynamic_qr_links.slug as dynamic_slug,
      dynamic_qr_links.tracks_statistics as dynamic_tracks_statistics,
      dynamic_qr_links.is_dynamic as dynamic_is_dynamic
    from saved_qr_codes
    left join dynamic_qr_links
      on dynamic_qr_links.id = saved_qr_codes.payload #>> '{dynamicLink,id}'
      and dynamic_qr_links.user_id = saved_qr_codes.user_id
    where saved_qr_codes.id = ${id}
      and saved_qr_codes.user_id = ${session.user.id}
    limit 1
  `

  return {
    qrCode: mapSavedQrRow(rows[0]!)
  }
})

function normalizeDynamicLink(value: unknown): DynamicQrLinkPayload {
  const link = value as Partial<DynamicQrLinkPayload> | undefined

  if (!link
    || typeof link.destinationUrl !== 'string'
    || typeof link.id !== 'string'
    || typeof link.redirectUrl !== 'string'
    || typeof link.slug !== 'string'
    || typeof link.trackStatistics !== 'boolean'
    || typeof link.useDynamicUrl !== 'boolean'
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dynamic QR link is invalid.'
    })
  }

  return link as DynamicQrLinkPayload
}
