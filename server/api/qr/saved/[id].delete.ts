import { ensureSavedQrTables } from '~~/server/utils/saved-qr'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Saved QR code id is required.'
    })
  }

  const sql = useNeon()

  await ensureSavedQrTables(sql)

  const rows = await sql`
    delete from saved_qr_codes
    where id = ${id}
      and user_id = ${session.user.id}
    returning id
  `

  if (!rows.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Saved QR code not found.'
    })
  }

  return { deleted: true }
})
