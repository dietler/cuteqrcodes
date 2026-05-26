import { getHeaders, type H3Event } from 'h3'
import { createAuth, parseTrustedOrigins } from '~~/lib/auth'

type AuthSession = NonNullable<Awaited<ReturnType<ReturnType<typeof createAuth>['api']['getSession']>>>

export function useServerAuth() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'DATABASE_URL is required.'
    })
  }

  return createAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    databaseUrl,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS)
  })
}

export async function requireUserSession(event: H3Event): Promise<AuthSession> {
  const auth = useServerAuth()
  const headers = Object.entries(getHeaders(event)).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  const session = await auth.api.getSession({
    headers: new Headers(headers)
  })

  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Login is required.'
    })
  }

  return session
}
