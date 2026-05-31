import type { SavedQrPayload } from '~~/app/utils/saved-qr'
import { createSavedQrCode, normalizeName, normalizePreviewDimension, normalizePreviewSvg, normalizeSavedQrPayload, normalizeTags } from '~~/server/utils/saved-qr'
import { assertContentLengthLimit } from '~~/server/utils/request-limits'

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
  assertContentLengthLimit(event, 1_500_000, 'Saved QR request is too large.')

  const body = await readBody<SaveQrBody>(event)
  const name = normalizeName(body?.name, 'QR code name')
  const previewSvg = normalizePreviewSvg(body?.previewSvg)
  const previewWidth = normalizePreviewDimension(body?.previewWidth, 'QR code preview width')
  const previewHeight = normalizePreviewDimension(body?.previewHeight, 'QR code preview height')
  const payload = normalizeSavedQrPayload(body?.payload)
  const tags = normalizeTags(body?.tags)
  const sql = useNeon(event)

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
