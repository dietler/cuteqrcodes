import type { SavedQrCode, SavedQrFolder } from '~~/app/utils/saved-qr'

type NeonSql = ReturnType<typeof useNeon>

type DbRow = Record<string, unknown>

let savedQrTablesReady: Promise<void> | null = null

export async function ensureSavedQrTables(sql: NeonSql) {
  savedQrTablesReady ??= (async () => {
    await sql`
      create table if not exists qr_folders (
        id text primary key,
        user_id text not null references "user"(id) on delete cascade,
        name text not null check (length(trim(name)) > 0),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (user_id, name)
      )
    `
    await sql`create index if not exists qr_folders_user_id_idx on qr_folders(user_id)`
    await sql`
      create table if not exists saved_qr_codes (
        id text primary key,
        user_id text not null references "user"(id) on delete cascade,
        folder_id text not null references qr_folders(id) on delete restrict,
        name text not null check (length(trim(name)) > 0),
        payload jsonb not null,
        preview_svg text not null,
        preview_width double precision not null,
        preview_height double precision not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (user_id, name)
      )
    `
    await sql`create index if not exists saved_qr_codes_user_id_idx on saved_qr_codes(user_id)`
    await sql`create index if not exists saved_qr_codes_folder_id_idx on saved_qr_codes(folder_id)`
  })()

  return savedQrTablesReady
}

export function normalizeName(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is required.`
    })
  }

  const name = value.trim()

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is required.`
    })
  }

  if (name.length > 120) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be 120 characters or less.`
    })
  }

  return name
}

export function mapFolderRow(row: DbRow): SavedQrFolder {
  return {
    createdAt: getStringField(row, 'created_at'),
    id: getStringField(row, 'id'),
    name: getStringField(row, 'name'),
    updatedAt: getStringField(row, 'updated_at')
  }
}

export function mapSavedQrRow(row: DbRow): SavedQrCode {
  const payload = row.payload

  return {
    createdAt: getStringField(row, 'created_at'),
    folderId: getStringField(row, 'folder_id'),
    id: getStringField(row, 'id'),
    name: getStringField(row, 'name'),
    payload: typeof payload === 'string' ? JSON.parse(payload) : payload,
    previewHeight: getNumberField(row, 'preview_height'),
    previewSvg: getStringField(row, 'preview_svg'),
    previewWidth: getNumberField(row, 'preview_width'),
    updatedAt: getStringField(row, 'updated_at')
  } as SavedQrCode
}

function getStringField(row: DbRow, key: string) {
  const value = row[key]

  if (value instanceof Date) {
    return value.toISOString()
  }

  return typeof value === 'string' ? value : String(value ?? '')
}

function getNumberField(row: DbRow, key: string) {
  const value = row[key]

  return typeof value === 'number' ? value : Number(value)
}

export function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
