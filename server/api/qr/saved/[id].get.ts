import { ensureDynamicQrTables } from '~~/server/utils/dynamic-qr'
import { ensureSavedQrTables, mapSavedQrRow } from '~~/server/utils/saved-qr'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id') || ''

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'QR code is required.'
    })
  }

  const sql = useNeon()

  await Promise.all([
    ensureDynamicQrTables(sql),
    ensureSavedQrTables(sql)
  ])

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

  if (!rows.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'QR code not found.'
    })
  }

  return {
    qrCode: mapSavedQrRow(rows[0]!)
  }
})
