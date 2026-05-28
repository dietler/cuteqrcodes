import { getHeaders, type H3Event } from 'h3'
import { createAuth } from '~~/lib/auth'
import { getRuntimeAuthOptions } from '~~/server/utils/auth-config'

type AuthSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createAuth>['api']['getSession']>>
>

export function useServerAuth(event: H3Event) {
  return createAuth(getRuntimeAuthOptions(event))
}

export async function requireUserSession(event: H3Event): Promise<AuthSession> {
  const auth = useServerAuth(event)
  const headers = Object.entries(getHeaders(event)).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  )
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
