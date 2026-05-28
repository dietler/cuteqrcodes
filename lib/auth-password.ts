import { verifyPassword as verifyDefaultPassword } from 'better-auth/crypto'

const passwordHashPrefix = 'pbkdf2-sha256'
const passwordHashIterations = 100000
const passwordSaltBytes = 16
const passwordHashBytes = 32

function toBase64Url(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function fromBase64Url(value: string) {
  const base64 = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  let difference = a.length ^ b.length
  const length = Math.max(a.length, b.length)

  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0)
  }

  return difference === 0
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number
) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations
    },
    key,
    passwordHashBytes * 8
  )

  return new Uint8Array(bits)
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(passwordSaltBytes))
  const hash = await derivePasswordHash(
    password,
    salt,
    passwordHashIterations
  )

  return [
    passwordHashPrefix,
    passwordHashIterations,
    toBase64Url(salt),
    toBase64Url(hash)
  ].join('$')
}

export async function verifyPassword({
  hash,
  password
}: {
  hash: string
  password: string
}) {
  if (!hash.startsWith(`${passwordHashPrefix}$`)) {
    return verifyDefaultPassword({ hash, password })
  }

  const [, iterationsValue, saltValue, hashValue] = hash.split('$')
  const iterations = Number(iterationsValue)

  if (!iterations || !saltValue || !hashValue) {
    return false
  }

  const salt = fromBase64Url(saltValue)
  const expectedHash = fromBase64Url(hashValue)
  const actualHash = await derivePasswordHash(password, salt, iterations)

  return timingSafeEqual(actualHash, expectedHash)
}
