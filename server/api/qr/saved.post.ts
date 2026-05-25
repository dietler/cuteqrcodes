import type { SavedQrPayload } from '~~/app/utils/saved-qr'
import { ensureSavedQrTables, isUniqueViolation, mapSavedQrRow, normalizeName } from '~~/server/utils/saved-qr'

type SaveQrBody = {
  folderId?: unknown
  name?: unknown
  payload?: unknown
  previewHeight?: unknown
  previewSvg?: unknown
  previewWidth?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody<SaveQrBody>(event)
  const name = normalizeName(body?.name, 'QR code name')
  const folderId = typeof body?.folderId === 'string' ? body.folderId : ''
  const previewSvg = typeof body?.previewSvg === 'string' ? body.previewSvg : ''
  const previewWidth = typeof body?.previewWidth === 'number' ? body.previewWidth : 0
  const previewHeight = typeof body?.previewHeight === 'number' ? body.previewHeight : 0
  const payload = body?.payload as Partial<SavedQrPayload> | undefined
  const sql = useNeon()

  if (!folderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Folder is required.'
    })
  }

  if (!payload || payload.version !== 1 || typeof payload.url !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'QR code settings are invalid.'
    })
  }

  if (!previewSvg || !previewWidth || !previewHeight) {
    throw createError({
      statusCode: 400,
      statusMessage: 'QR code preview is invalid.'
    })
  }

  await ensureSavedQrTables(sql)

  const folderRows = await sql`
    select id
    from qr_folders
    where id = ${folderId}
      and user_id = ${session.user.id}
    limit 1
  `

  if (!folderRows.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Folder not found.'
    })
  }

  try {
    const rows = await sql`
      insert into saved_qr_codes (
        id,
        user_id,
        folder_id,
        name,
        payload,
        preview_svg,
        preview_width,
        preview_height
      )
      values (
        ${crypto.randomUUID()},
        ${session.user.id},
        ${folderId},
        ${name},
        ${JSON.stringify(payload)}::jsonb,
        ${previewSvg},
        ${previewWidth},
        ${previewHeight}
      )
      returning id, folder_id, name, payload, preview_svg, preview_width, preview_height, created_at, updated_at
    `

    return {
      qrCode: mapSavedQrRow(rows[0]!)
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A saved QR code with that name already exists.'
      })
    }

    throw error
  }
})
