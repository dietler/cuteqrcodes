import { dash } from '@better-auth/infra'
import { createAuth, type AuthOptions } from './auth'

type DashAuthOptions = AuthOptions & {
  betterAuthApiKey?: string
}

export function createDashAuth(options: DashAuthOptions = {}) {
  const { betterAuthApiKey, plugins, ...authOptions } = options

  return createAuth({
    ...authOptions,
    plugins: betterAuthApiKey
      ? [...(plugins || []), dash({ apiKey: betterAuthApiKey })]
      : plugins
  })
}
