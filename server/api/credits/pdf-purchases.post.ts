import { labelTemplates } from '~~/app/utils/label-print'
import { savePurchasedPdf } from '~~/server/utils/credits'

type PdfPurchaseBody = {
  pdfBase64?: unknown
  qrTitle?: unknown
  templateId?: unknown
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody<PdfPurchaseBody>(event)
  const templateId = typeof body?.templateId === 'string' ? body.templateId : ''
  const template = labelTemplates.find(item => item.id === templateId)
  const qrTitle = normalizeQrTitle(body?.qrTitle)
  const pdfBase64 = typeof body?.pdfBase64 === 'string' ? body.pdfBase64 : ''

  if (!template) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Label template is required.'
    })
  }

  const pdfBytes = decodePdfBase64(pdfBase64)
  const result = await savePurchasedPdf(event, {
    pdfBytes,
    qrTitle,
    templateId: template.id,
    templateLabel: template.label,
    userId: session.user.id
  })

  return result
})

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
