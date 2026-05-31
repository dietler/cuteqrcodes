import { createError, type H3Event } from 'h3'
import { requireUserSession } from '~~/server/utils/auth-session'
import { getRuntimeEnv } from '~~/server/utils/runtime-env'

export async function requireAdminSession(event: H3Event) {
  const session = await requireUserSession(event)

  if (!isServerAdminEmail(event, session.user.email)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access is required.'
    })
  }

  return session
}

export function isServerAdminEmail(event: H3Event, email: string | null | undefined) {
  return getAdminEmailSet(event).has(normalizeAdminEmail(email))
}

function getAdminEmailSet(event: H3Event) {
  return new Set(
    getRuntimeEnv(event, 'ADMIN_EMAILS')
      .split(',')
      .map(normalizeAdminEmail)
      .filter(Boolean)
  )
}

function normalizeAdminEmail(email: string | null | undefined) {
  return (email || '').trim().toLowerCase()
}
