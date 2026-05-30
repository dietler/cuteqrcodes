const adminEmails = [
  'andy+testdesktop@dietler.net'
] as const

const normalizedAdminEmails = new Set(adminEmails.map(normalizeAdminEmail))

export function isAdminEmail(email: string | null | undefined) {
  return normalizedAdminEmails.has(normalizeAdminEmail(email))
}

function normalizeAdminEmail(email: string | null | undefined) {
  return (email || '').trim().toLowerCase()
}
