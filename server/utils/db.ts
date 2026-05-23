import { neon } from '@neondatabase/serverless'
import { createError } from 'h3'

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || ''
}

export function requireDatabaseUrl() {
  const databaseUrl = getDatabaseUrl()

  if (!databaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'DATABASE_URL is required.'
    })
  }

  return databaseUrl
}

export function useNeon() {
  return neon(requireDatabaseUrl())
}
