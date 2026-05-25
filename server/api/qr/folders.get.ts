import { ensureSavedQrTables, mapFolderRow } from '~~/server/utils/saved-qr'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const sql = useNeon()

  await ensureSavedQrTables(sql)

  const rows = await sql`
    select id, name, created_at, updated_at
    from qr_folders
    where user_id = ${session.user.id}
    order by lower(name), name
  `

  return {
    folders: rows.map(mapFolderRow)
  }
})
