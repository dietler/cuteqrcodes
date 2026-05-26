import { createAuth, parseTrustedOrigins } from '~~/lib/auth'

export default defineEventHandler((event) => {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'DATABASE_URL is required for Better Auth.'
    })
  }

  const auth = createAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    databaseUrl,
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromEmail: process.env.RESEND_FROM_EMAIL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS)
  })

  return auth.handler(toWebRequest(event))
})
