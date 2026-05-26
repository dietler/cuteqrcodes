import { ensureSavedQrTables, mapSavedQrRow } from '~~/server/utils/saved-qr'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id') || ''

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Saved QR code is required.'
    })
  }

  const sql = useNeon()

  await ensureSavedQrTables(sql)

  const rows = await sql`
    select id, folder_id, name, payload, preview_svg, preview_width, preview_height, created_at, updated_at
    from saved_qr_codes
    where id = ${id}
      and user_id = ${session.user.id}
    limit 1
  `

  if (!rows.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Saved QR code not found.'
    })
  }

  return {
    qrCode: mapSavedQrRow(rows[0]!)
  }
})
