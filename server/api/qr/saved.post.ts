import type { SavedQrPayload } from '~~/app/utils/saved-qr'
import { createSavedQrCode, normalizeName, normalizeSavedQrPayload, normalizeTags } from '~~/server/utils/saved-qr'

type SaveQrBody = {
  name?: unknown
  payload?: unknown
  previewHeight?: unknown
  previewSvg?: unknown
  previewWidth?: unknown
  tags?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody<SaveQrBody>(event)
  const name = normalizeName(body?.name, 'QR code name')
  const previewSvg = typeof body?.previewSvg === 'string' ? body.previewSvg : ''
  const previewWidth = typeof body?.previewWidth === 'number' ? body.previewWidth : 0
  const previewHeight = typeof body?.previewHeight === 'number' ? body.previewHeight : 0
  const payload = normalizeSavedQrPayload(body?.payload)
  const tags = normalizeTags(body?.tags)
  const sql = useNeon()

  if (!previewSvg || !previewWidth || !previewHeight) {
    throw createError({
      statusCode: 400,
      statusMessage: 'QR code preview is invalid.'
    })
  }

  return {
    qrCode: await createSavedQrCode(sql, {
      name,
      payload: payload as SavedQrPayload,
      previewHeight,
      previewSvg,
      previewWidth,
      status: 'draft',
      tags,
      userId: session.user.id
    })
  }
})
