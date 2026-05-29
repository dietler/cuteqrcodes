import { createDynamicQrRedirectUrl, type DynamicQrLinkPayload } from '~~/app/utils/dynamic-qr'
import type { SavedQrCode, SavedQrPayload, SavedQrStatus } from '~~/app/utils/saved-qr'

type NeonSql = ReturnType<typeof useNeon>

type DbRow = Record<string, unknown>

type SavedQrWriteInput = {
  name: string
  payload: SavedQrPayload
  pdfPurchaseId?: string | null
  previewHeight: number
  previewSvg: string
  previewWidth: number
  status: SavedQrStatus
  tags?: string[]
  userId: string
}

let savedQrTablesReady: Promise<void> | null = null

export async function ensureSavedQrTables(sql: NeonSql) {
  savedQrTablesReady ??= (async () => {
    await sql`
      create table if not exists saved_qr_codes (
        id text primary key,
        user_id text not null references "user"(id) on delete cascade,
        name text not null check (length(trim(name)) > 0),
        payload jsonb not null,
        preview_svg text not null,
        preview_width double precision not null,
        preview_height double precision not null,
        status text not null default 'draft',
        tags text[] not null default '{}'::text[],
        pdf_purchase_id text unique,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `
    await sql`alter table saved_qr_codes add column if not exists status text not null default 'draft'`
    await sql`alter table saved_qr_codes add column if not exists tags text[] not null default '{}'::text[]`
    await sql`alter table saved_qr_codes add column if not exists pdf_purchase_id text unique`
    await sql`
      do $$
      begin
        alter table saved_qr_codes drop constraint if exists saved_qr_codes_folder_id_fkey;
        alter table saved_qr_codes drop constraint if exists saved_qr_codes_user_id_name_key;
        alter table saved_qr_codes drop constraint if exists saved_qr_codes_status_check;
        alter table saved_qr_codes
          add constraint saved_qr_codes_status_check
          check (status in ('draft', 'purchased'));

        if exists (
          select 1
          from information_schema.columns
          where table_name = 'saved_qr_codes'
            and column_name = 'folder_id'
        ) then
          alter table saved_qr_codes drop column folder_id;
        end if;

        drop table if exists qr_folders;
      end $$;
    `
    await sql`create index if not exists saved_qr_codes_user_id_idx on saved_qr_codes(user_id, updated_at desc)`
    await sql`create index if not exists saved_qr_codes_status_idx on saved_qr_codes(user_id, status, updated_at desc)`
    await sql`create index if not exists saved_qr_codes_tags_idx on saved_qr_codes using gin(tags)`
    await sql`create unique index if not exists saved_qr_codes_pdf_purchase_id_idx on saved_qr_codes(pdf_purchase_id) where pdf_purchase_id is not null`
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

export function normalizeSavedQrPayload(value: unknown): SavedQrPayload {
  const payload = value as Partial<SavedQrPayload> | undefined

  if (!payload || payload.version !== 1 || typeof payload.url !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'QR code settings are invalid.'
    })
  }

  return payload as SavedQrPayload
}

export function normalizeTags(value: unknown) {
  if (typeof value === 'undefined' || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tags must be a list.'
    })
  }

  const tags = new Map<string, string>()

  for (const item of value) {
    if (typeof item !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tags must be text.'
      })
    }

    const tag = item.trim().replace(/\s+/g, ' ')

    if (!tag) {
      continue
    }

    if (tag.length > 30) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tags must be 30 characters or less.'
      })
    }

    tags.set(tag.toLocaleLowerCase(), tag)
  }

  if (tags.size > 20) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use 20 tags or fewer.'
    })
  }

  return [...tags.values()].sort((first, second) => first.localeCompare(second))
}

export async function createSavedQrCode(sql: NeonSql, input: SavedQrWriteInput) {
  await ensureSavedQrTables(sql)

  const rows = await sql`
    insert into saved_qr_codes (
      id,
      user_id,
      name,
      payload,
      preview_svg,
      preview_width,
      preview_height,
      status,
      tags,
      pdf_purchase_id
    )
    values (
      ${crypto.randomUUID()},
      ${input.userId},
      ${input.name},
      ${JSON.stringify(input.payload)}::jsonb,
      ${input.previewSvg},
      ${input.previewWidth},
      ${input.previewHeight},
      ${input.status},
      ${input.tags || []},
      ${input.pdfPurchaseId || null}
    )
    returning id, name, payload, preview_svg, preview_width, preview_height, status, tags, pdf_purchase_id, created_at, updated_at
  `

  return mapSavedQrRow(rows[0]!)
}

export function mapSavedQrRow(row: DbRow): SavedQrCode {
  const payload = normalizeStoredPayload(row.payload)
  const currentDynamicLink = mapDynamicLinkFields(row)

  if (currentDynamicLink) {
    payload.dynamicLink = currentDynamicLink
  }

  return {
    createdAt: getStringField(row, 'created_at'),
    id: getStringField(row, 'id'),
    name: getStringField(row, 'name'),
    payload,
    pdfPurchaseId: getNullableStringField(row, 'pdf_purchase_id'),
    previewHeight: getNumberField(row, 'preview_height'),
    previewSvg: getStringField(row, 'preview_svg'),
    previewWidth: getNumberField(row, 'preview_width'),
    status: getSavedQrStatus(row),
    tags: getStringArrayField(row, 'tags'),
    updatedAt: getStringField(row, 'updated_at')
  }
}

function normalizeStoredPayload(value: unknown): SavedQrPayload {
  const payload = (typeof value === 'string' ? JSON.parse(value) : value) as SavedQrPayload

  if (payload.dynamicLink && typeof payload.dynamicLink.slug === 'string') {
    payload.dynamicLink.redirectUrl = createDynamicQrRedirectUrl(payload.dynamicLink.slug || 'guid')
  }

  return payload
}

function mapDynamicLinkFields(row: DbRow): DynamicQrLinkPayload | null {
  const id = getNullableStringField(row, 'dynamic_link_id')

  if (!id) {
    return null
  }

  return {
    destinationUrl: getStringField(row, 'dynamic_destination_url'),
    id,
    redirectUrl: getStringField(row, 'dynamic_redirect_url'),
    slug: getStringField(row, 'dynamic_slug'),
    trackStatistics: getBooleanField(row, 'dynamic_tracks_statistics'),
    useDynamicUrl: getBooleanField(row, 'dynamic_is_dynamic')
  }
}

function getSavedQrStatus(row: DbRow): SavedQrStatus {
  return row.status === 'purchased' ? 'purchased' : 'draft'
}

function getStringField(row: DbRow, key: string) {
  const value = row[key]

  if (value instanceof Date) {
    return value.toISOString()
  }

  return typeof value === 'string' ? value : String(value ?? '')
}

function getNullableStringField(row: DbRow, key: string) {
  const value = row[key]

  return value === null || typeof value === 'undefined' ? null : getStringField(row, key)
}

function getNumberField(row: DbRow, key: string) {
  const value = row[key]

  return typeof value === 'number' ? value : Number(value)
}

function getBooleanField(row: DbRow, key: string) {
  return row[key] === true
}

function getStringArrayField(row: DbRow, key: string) {
  const value = row[key]

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }

  return []
}

export function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
