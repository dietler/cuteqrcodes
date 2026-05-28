import { createError, type H3Event } from 'h3'
import { parseTrustedOrigins, type AuthOptions } from '~~/lib/auth'
import { getRuntimeEnv } from '~~/server/utils/runtime-env'

export type RuntimeAuthOptions = AuthOptions & {
  betterAuthApiKey?: string
}

export function getRuntimeAuthOptions(event: H3Event): RuntimeAuthOptions {
  const databaseUrl = getRuntimeEnv(event, 'DATABASE_URL')

  if (!databaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'DATABASE_URL is required for Better Auth.'
    })
  }

  return {
    baseURL: getRuntimeEnv(event, 'BETTER_AUTH_URL'),
    betterAuthApiKey: getRuntimeEnv(event, 'BETTER_AUTH_API_KEY'),
    databaseUrl,
    resendApiKey: getRuntimeEnv(event, 'RESEND_API_KEY'),
    resendFromEmail: getRuntimeEnv(event, 'RESEND_FROM_EMAIL'),
    secret: getRuntimeEnv(event, 'BETTER_AUTH_SECRET'),
    trustedOrigins: parseTrustedOrigins(
      getRuntimeEnv(event, 'BETTER_AUTH_TRUSTED_ORIGINS')
    )
  }
}
