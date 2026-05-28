import { neon } from '@neondatabase/serverless'
import { betterAuth } from 'better-auth'
import { Kysely } from 'kysely'
import { NeonDialect } from 'kysely-neon'
import { hashPassword, verifyPassword } from './auth-password'

type BetterAuthOptions = Parameters<typeof betterAuth>[0]

export type AuthOptions = {
  baseURL?: string
  databaseUrl?: string
  plugins?: BetterAuthOptions['plugins']
  resendApiKey?: string
  resendFromEmail?: string
  secret?: string
  trustedOrigins?: string[]
}

type Database = Record<string, never>

type PasswordResetEmailOptions = {
  apiKey?: string
  from?: string
  to: string
  url: string
}

const appName = 'QR Codes On Labels'
const placeholderDatabaseUrl
  = 'postgresql://user:password@example.neon.tech/neondb?sslmode=require'
const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;'
}

export function parseTrustedOrigins(value?: string) {
  return value
    ?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    character => htmlEntities[character] || character
  )
}

function buildPasswordResetEmailHtml(url: string) {
  const escapedUrl = escapeHtml(url)

  return [
    `<p>Use this link to reset your ${appName} password:</p>`,
    `<p><a href="${escapedUrl}">Reset password</a></p>`,
    `<p>If the button does not work, paste this URL into your browser:</p>`,
    `<p><a href="${escapedUrl}">${escapedUrl}</a></p>`,
    '<p>If you did not request this, you can ignore this email.</p>'
  ].join('')
}

function buildPasswordResetEmailText(url: string) {
  return [
    `Reset your ${appName} password:`,
    '',
    url,
    '',
    'If you did not request this, you can ignore this email.'
  ].join('\n')
}

async function getResendErrorMessage(response: Response) {
  const fallback = `${response.status} ${response.statusText}`.trim()
  const body = await response.text()

  if (!body) {
    return fallback
  }

  try {
    const parsed = JSON.parse(body) as { message?: string }

    return parsed.message || body
  } catch {
    return body
  }
}

async function sendPasswordResetEmail({
  apiKey,
  from,
  to,
  url
}: PasswordResetEmailOptions) {
  const resendApiKey = apiKey?.trim()
  const resendFromEmail = from?.trim()

  if (!resendApiKey) {
    throw new Error(
      'RESEND_API_KEY is required to send password reset emails.'
    )
  }

  if (!resendFromEmail) {
    throw new Error(
      'RESEND_FROM_EMAIL is required to send password reset emails.'
    )
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to,
      subject: `Reset your ${appName} password`,
      html: buildPasswordResetEmailHtml(url),
      text: buildPasswordResetEmailText(url)
    })
  })

  if (!response.ok) {
    throw new Error(
      `Unable to send password reset email with Resend: ${await getResendErrorMessage(response)}`
    )
  }
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
      enabled: true,
      password: {
        hash: hashPassword,
        verify: verifyPassword
      },
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail({
          apiKey: options.resendApiKey,
          from: options.resendFromEmail,
          to: user.email,
          url
        })
      }
    },
    plugins: options.plugins || [],
    secret: options.secret,
    trustedOrigins: options.trustedOrigins
  })
}

export const auth = createAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  databaseUrl: process.env.DATABASE_URL,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS)
})
