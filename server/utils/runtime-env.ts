import type { H3Event } from 'h3'

type CloudflareEventContext = {
  _platform?: {
    cloudflare?: {
      env?: Record<string, unknown>
    }
  }
  cloudflare?: {
    env?: Record<string, unknown>
  }
}

export function getCloudflareEnv(event: H3Event) {
  const context = event.context as CloudflareEventContext

  return context._platform?.cloudflare?.env || context.cloudflare?.env
}

export function getRuntimeEnv(event: H3Event, key: string) {
  const cloudflareValue = getCloudflareEnv(event)?.[key]

  if (typeof cloudflareValue === 'string') {
    return cloudflareValue
  }

  return process.env[key] || ''
}

export function populateProcessEnvFromRuntime(event: H3Event) {
  const cloudflareEnv = getCloudflareEnv(event)

  if (!cloudflareEnv) {
    return
  }

  for (const [key, value] of Object.entries(cloudflareEnv)) {
    if (typeof value === 'string' && typeof process.env[key] === 'undefined') {
      process.env[key] = value
    }
  }
}
