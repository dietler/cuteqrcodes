import { createAuth } from '~~/lib/auth'
import { getRuntimeAuthOptions } from '~~/server/utils/auth-config'

export default defineEventHandler(async (event) => {
  const authOptions = getRuntimeAuthOptions(event)
  const authPath = event.path?.split('?')[0] || ''
  const enableDash = authPath.startsWith('/api/auth/dash')
    || authPath.startsWith('/api/auth/events')

  const auth = enableDash
    ? (await import('~~/lib/auth-dash')).createDashAuth(authOptions)
    : createAuth(authOptions)

  return auth.handler(toWebRequest(event))
})
