import { getPdfBucket, getPurchasedPdfStorageKey } from '~~/server/utils/credits'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id') || ''

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Purchased PDF is required.'
    })
  }

  const sql = useNeon(event)
  const storageKey = await getPurchasedPdfStorageKey(sql, session.user.id, id)

  if (!storageKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Purchased PDF not found.'
    })
  }

  const object = await getPdfBucket(event).get(storageKey)

  if (!object?.body) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Purchased PDF file not found.'
    })
  }

  setHeader(event, 'content-type', object.httpMetadata?.contentType || 'application/pdf')
  setHeader(event, 'content-disposition', `attachment; filename="${id}.pdf"`)

  return object.body
})
