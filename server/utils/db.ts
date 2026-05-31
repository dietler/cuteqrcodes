import { neon } from '@neondatabase/serverless'
import { createError, type H3Event } from 'h3'
import { getRuntimeEnv } from '~~/server/utils/runtime-env'

export function getDatabaseUrl(event?: H3Event) {
  return event ? getRuntimeEnv(event, 'DATABASE_URL') : process.env.DATABASE_URL || ''
}

export function requireDatabaseUrl(event?: H3Event) {
  const databaseUrl = getDatabaseUrl(event)

  if (!databaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'DATABASE_URL is required.'
    })
  }

  return databaseUrl
}

export function useNeon(event?: H3Event) {
  return neon(requireDatabaseUrl(event))
}
