import type { SavedQrFolderWithCodes } from '~~/app/utils/saved-qr'
import { ensureSavedQrTables, mapFolderRow, mapSavedQrRow } from '~~/server/utils/saved-qr'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const sql = useNeon()

  await ensureSavedQrTables(sql)

  const folderRows = await sql`
    select id, name, created_at, updated_at
    from qr_folders
    where user_id = ${session.user.id}
    order by lower(name), name
  `
  const savedRows = await sql`
    select id, folder_id, name, payload, preview_svg, preview_width, preview_height, created_at, updated_at
    from saved_qr_codes
    where user_id = ${session.user.id}
    order by updated_at desc
  `
  const folders: SavedQrFolderWithCodes[] = folderRows.map(row => ({
    ...mapFolderRow(row),
    qrCodes: []
  }))
  const folderMap = new Map(folders.map(folder => [folder.id, folder]))

  savedRows.map(mapSavedQrRow).forEach((qrCode) => {
    folderMap.get(qrCode.folderId)?.qrCodes.push(qrCode)
  })

  return { folders }
})
