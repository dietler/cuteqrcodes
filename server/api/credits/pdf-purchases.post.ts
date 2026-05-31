import { labelTemplates } from '~~/app/utils/label-print'
import { savePurchasedPdf } from '~~/server/utils/credits'
import { normalizeDestinationUrl, normalizeDynamicQrSlugForServer, type DynamicQrLinkInput } from '~~/server/utils/dynamic-qr'
import { assertContentLengthLimit } from '~~/server/utils/request-limits'
import { normalizePreviewDimension, normalizePreviewSvg, normalizeSavedQrPayload } from '~~/server/utils/saved-qr'

type PdfPurchaseBody = {
  dynamicLink?: {
    destinationUrl?: unknown
    id?: unknown
    slug?: unknown
    trackStatistics?: unknown
    useDynamicUrl?: unknown
  }
  pdfBase64?: unknown
  previewHeight?: unknown
  previewSvg?: unknown
  previewWidth?: unknown
  qrPayload?: unknown
  qrTitle?: unknown
  templateId?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  assertContentLengthLimit(event, 15_000_000, 'PDF purchase request is too large.')

  const body = await readBody<PdfPurchaseBody>(event)
  const templateId = typeof body?.templateId === 'string' ? body.templateId : ''
  const template = labelTemplates.find(item => item.id === templateId)
  const qrTitle = normalizeQrTitle(body?.qrTitle)
  const pdfBase64 = typeof body?.pdfBase64 === 'string' ? body.pdfBase64 : ''
  const dynamicLink = normalizePurchaseDynamicLink(body?.dynamicLink, session.user.id)
  const previewSvg = normalizePreviewSvg(body?.previewSvg)
  const previewWidth = normalizePreviewDimension(body?.previewWidth, 'QR code preview width')
  const previewHeight = normalizePreviewDimension(body?.previewHeight, 'QR code preview height')
  const qrPayload = normalizeSavedQrPayload(body?.qrPayload)

  if (!template) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Label template is required.'
    })
  }

  const pdfBytes = decodePdfBase64(pdfBase64)
  const result = await savePurchasedPdf(event, {
    ...(dynamicLink ? { dynamicLink } : {}),
    pdfBytes,
    previewHeight,
    previewSvg,
    previewWidth,
    qrPayload,
    qrTitle,
    templateId: template.id,
    templateLabel: template.label,
    userId: session.user.id
  })

  return result
})

function normalizePurchaseDynamicLink(value: PdfPurchaseBody['dynamicLink'], userId: string): DynamicQrLinkInput | undefined {
  if (!value || (value.useDynamicUrl !== true && value.trackStatistics !== true)) {
    return undefined
  }

  const existingLinkId = typeof value.id === 'string' && value.id ? value.id : undefined

  return {
    destinationUrl: normalizeDestinationUrl(value.destinationUrl),
    ...(existingLinkId ? { existingLinkId } : {}),
    slug: normalizeDynamicQrSlugForServer(value.slug),
    trackStatistics: value.trackStatistics === true,
    useDynamicUrl: value.useDynamicUrl === true,
    userId
  }
}

function normalizeQrTitle(value: unknown) {
  const title = typeof value === 'string' ? value.trim() : ''

  if (!title) {
    return 'QR code labels'
  }

  return title.length > 160 ? title.slice(0, 160) : title
}

function decodePdfBase64(pdfBase64: string) {
  if (!pdfBase64) {
    throw createError({
      statusCode: 400,
      statusMessage: 'PDF data is required.'
    })
  }

  if (pdfBase64.length > 14_000_000) {
    throw createError({
      statusCode: 413,
      statusMessage: 'PDF is too large.'
    })
  }

  const pdfBytes = Buffer.from(pdfBase64, 'base64')

  if (pdfBytes.byteLength > 10 * 1024 * 1024) {
    throw createError({
      statusCode: 413,
      statusMessage: 'PDF is too large.'
    })
  }

  if (pdfBytes.subarray(0, 4).toString('utf8') !== '%PDF') {
    throw createError({
      statusCode: 400,
      statusMessage: 'PDF data is invalid.'
    })
  }

  return pdfBytes
}
