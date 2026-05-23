import { neon } from '@neondatabase/serverless'
import { betterAuth } from 'better-auth'
import { Kysely } from 'kysely'
import { NeonDialect } from 'kysely-neon'

type AuthOptions = {
  baseURL?: string
  databaseUrl?: string
  secret?: string
  trustedOrigins?: string[]
}

type Database = Record<string, never>

const placeholderDatabaseUrl = 'postgresql://user:password@example.neon.tech/neondb?sslmode=require'

export function parseTrustedOrigins(value?: string) {
  return value
    ?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}

export function createAuth(options: AuthOptions = {}) {
  const db = new Kysely<Database>({
    dialect: new NeonDialect({
      neon: neon(options.databaseUrl || placeholderDatabaseUrl)
    })
  })

  return betterAuth({
    baseURL: options.baseURL,
    database: {
      db,
      type: 'postgres'
    },
    emailAndPassword: {
      enabled: true
    },
    secret: options.secret,
    trustedOrigins: options.trustedOrigins
  })
}

export const auth = createAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  databaseUrl: process.env.DATABASE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS)
})
