import { createError, getRequestHeader, type H3Event } from 'h3'

export function assertContentLengthLimit(event: H3Event, maxBytes: number, statusMessage: string) {
  const contentLength = getRequestHeader(event, 'content-length')

  if (!contentLength) {
    return
  }

  const bytes = Number(contentLength)

  if (Number.isFinite(bytes) && bytes > maxBytes) {
    throw createError({
      statusCode: 413,
      statusMessage
    })
  }
}
