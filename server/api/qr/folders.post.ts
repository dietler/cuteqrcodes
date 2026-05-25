import { ensureSavedQrTables, isUniqueViolation, mapFolderRow, normalizeName } from '~~/server/utils/saved-qr'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody(event)
  const name = normalizeName(body?.name, 'Folder name')
  const sql = useNeon()

  await ensureSavedQrTables(sql)

  try {
    const rows = await sql`
      insert into qr_folders (id, user_id, name)
      values (${crypto.randomUUID()}, ${session.user.id}, ${name})
      returning id, name, created_at, updated_at
    `

    return {
      folder: mapFolderRow(rows[0]!)
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A folder with that name already exists.'
      })
    }

    throw error
  }
})
