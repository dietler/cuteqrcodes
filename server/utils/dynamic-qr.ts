import { dynamicQrRedirectBaseUrl, dynamicQrSlugMaxLength, dynamicQrSlugPattern, type DynamicQrLinkPayload } from '~~/app/utils/dynamic-qr'
import { ensureCreditTables } from '~~/server/utils/credits'
import type { H3Event } from 'h3'

type NeonSql = ReturnType<typeof useNeon>

type DbRow = Record<string, unknown>

type DynamicQrScanSource = {
  city: string | null
  country: string | null
  ipAddress: string | null
  latitude: string | null
  longitude: string | null
  region: string | null
  referrer: string | null
  timezone: string | null
  userAgent: string | null
}

type DynamicQrLinkInput = {
  destinationUrl: string
  existingLinkId?: string
  slug: string
  trackStatistics: boolean
  useDynamicUrl: boolean
  userId: string
}

let dynamicQrTablesReady: Promise<void> | null = null

export async function ensureDynamicQrTables(sql: NeonSql) {
  dynamicQrTablesReady ??= (async () => {
    await sql`
      create table if not exists dynamic_qr_links (
        id text primary key,
        user_id text not null references "user"(id) on delete cascade,
        slug text not null unique,
        destination_url text not null,
        is_dynamic boolean not null default false,
        tracks_statistics boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `
    await sql`create index if not exists dynamic_qr_links_user_id_idx on dynamic_qr_links(user_id, created_at desc)`
    await sql`
      create table if not exists dynamic_qr_scans (
        id text primary key,
        link_id text not null references dynamic_qr_links(id) on delete cascade,
        ip_address text,
        country text,
        region text,
        city text,
        latitude text,
        longitude text,
        timezone text,
        user_agent text,
        referrer text,
        scanned_at timestamptz not null default now()
      )
    `
    await sql`create index if not exists dynamic_qr_scans_link_id_idx on dynamic_qr_scans(link_id, scanned_at desc)`
  })()

  return dynamicQrTablesReady
}

export function normalizeDestinationUrl(value: unknown) {
  const rawUrl = typeof value === 'string' ? value.trim() : ''

  if (!rawUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Destination URL is required.'
    })
  }

  let url: URL

  try {
    url = new URL(rawUrl)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Destination URL must be a valid URL.'
    })
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Destination URL must start with http:// or https://.'
    })
  }

  return url.toString()
}

export function normalizeDynamicQrSlugForServer(value: unknown) {
  const slug = typeof value === 'string' ? value.trim().toLowerCase() : ''

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dynamic link slug is required.'
    })
  }

  if (slug.length > dynamicQrSlugMaxLength || !dynamicQrSlugPattern.test(slug)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dynamic link slug can use lowercase letters, numbers, and hyphens.'
    })
  }

  return slug
}

export async function createOrUpdateDynamicQrLink(sql: NeonSql, input: DynamicQrLinkInput) {
  await Promise.all([
    ensureCreditTables(sql),
    ensureDynamicQrTables(sql)
  ])

  if (!input.useDynamicUrl && !input.trackStatistics) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose a dynamic URL or scan statistics.'
    })
  }

  const existingLink = input.existingLinkId
    ? await getEditableDynamicQrLink(sql, input.userId, input.existingLinkId)
    : null
  const creditsToCharge = getDynamicQrFeatureCost(input, existingLink)

  if (existingLink) {
    return updateDynamicQrLink(sql, input, creditsToCharge)
  }

  return createDynamicQrLink(sql, input, creditsToCharge)
}

export async function getDynamicQrLinkBySlug(sql: NeonSql, slug: string) {
  await ensureDynamicQrTables(sql)

  const rows = await sql`
    select id, user_id, slug, destination_url, is_dynamic, tracks_statistics, created_at, updated_at
    from dynamic_qr_links
    where slug = ${slug}
    limit 1
  `

  return rows.length ? mapDynamicQrLinkRow(rows[0]!) : null
}

export async function recordDynamicQrScan(sql: NeonSql, linkId: string, source: DynamicQrScanSource) {
  await ensureDynamicQrTables(sql)

  await sql`
    insert into dynamic_qr_scans (
      id,
      link_id,
      ip_address,
      country,
      region,
      city,
      latitude,
      longitude,
      timezone,
      user_agent,
      referrer
    )
    values (
      ${crypto.randomUUID()},
      ${linkId},
      ${source.ipAddress},
      ${source.country},
      ${source.region},
      ${source.city},
      ${source.latitude},
      ${source.longitude},
      ${source.timezone},
      ${source.userAgent},
      ${source.referrer}
    )
  `
}

export function getDynamicQrScanSource(event: H3Event): DynamicQrScanSource {
  const cf = getCloudflareRequestCf(event)

  return {
    city: getNullableRequestField(cf?.city),
    country: getNullableRequestField(getRequestHeader(event, 'cf-ipcountry') || cf?.country),
    ipAddress: getClientIpAddress(event),
    latitude: getNullableRequestField(cf?.latitude),
    longitude: getNullableRequestField(cf?.longitude),
    region: getNullableRequestField(cf?.region),
    referrer: getNullableRequestField(getRequestHeader(event, 'referer')),
    timezone: getNullableRequestField(cf?.timezone),
    userAgent: getNullableRequestField(getRequestHeader(event, 'user-agent'))
  }
}

function createDynamicQrLink(sql: NeonSql, input: DynamicQrLinkInput, creditsToCharge: number) {
  return runDynamicQrLinkWrite(sql, {
    ...input,
    creditsToCharge,
    existingLinkId: ''
  })
}

function updateDynamicQrLink(sql: NeonSql, input: DynamicQrLinkInput, creditsToCharge: number) {
  return runDynamicQrLinkWrite(sql, {
    ...input,
    creditsToCharge,
    existingLinkId: input.existingLinkId || ''
  })
}

async function runDynamicQrLinkWrite(sql: NeonSql, input: DynamicQrLinkInput & { creditsToCharge: number, existingLinkId: string }) {
  const description = getDynamicQrFeatureDescription(input)
  const metadata = {
    destinationUrl: input.destinationUrl,
    slug: input.slug,
    trackStatistics: input.trackStatistics,
    useDynamicUrl: input.useDynamicUrl
  }
  const linkId = input.existingLinkId || crypto.randomUUID()

  let rows: DbRow[]

  try {
    rows = input.existingLinkId
      ? await sql`
      with updated_balance as (
        update user_credit_balances
        set balance = balance - ${input.creditsToCharge},
            updated_at = now()
        where user_id = ${input.userId}
          and balance >= ${input.creditsToCharge}
        returning balance
      ),
      updated_link as (
        update dynamic_qr_links
        set slug = ${input.slug},
            destination_url = ${input.destinationUrl},
            is_dynamic = ${input.useDynamicUrl},
            tracks_statistics = ${input.trackStatistics},
            updated_at = now()
        where id = ${input.existingLinkId}
          and user_id = ${input.userId}
          and exists (select 1 from updated_balance)
        returning id, user_id, slug, destination_url, is_dynamic, tracks_statistics, created_at, updated_at
      ),
      inserted_transaction as (
        insert into credit_transactions (
          id,
          user_id,
          type,
          credits,
          balance_after,
          description,
          metadata
        )
        select
          ${crypto.randomUUID()},
          ${input.userId},
          'qr_feature_purchase',
          ${-input.creditsToCharge},
          updated_balance.balance,
          ${description},
          ${JSON.stringify({ ...metadata, linkId })}::jsonb
        from updated_balance
        where ${input.creditsToCharge} > 0
        returning id
      )
      select updated_link.*, updated_balance.balance
      from updated_link, updated_balance
    `
      : await sql`
      with updated_balance as (
        update user_credit_balances
        set balance = balance - ${input.creditsToCharge},
            updated_at = now()
        where user_id = ${input.userId}
          and balance >= ${input.creditsToCharge}
        returning balance
      ),
      inserted_link as (
        insert into dynamic_qr_links (
          id,
          user_id,
          slug,
          destination_url,
          is_dynamic,
          tracks_statistics
        )
        select
          ${linkId},
          ${input.userId},
          ${input.slug},
          ${input.destinationUrl},
          ${input.useDynamicUrl},
          ${input.trackStatistics}
        from updated_balance
        returning id, user_id, slug, destination_url, is_dynamic, tracks_statistics, created_at, updated_at
      ),
      inserted_transaction as (
        insert into credit_transactions (
          id,
          user_id,
          type,
          credits,
          balance_after,
          description,
          metadata
        )
        select
          ${crypto.randomUUID()},
          ${input.userId},
          'qr_feature_purchase',
          ${-input.creditsToCharge},
          updated_balance.balance,
          ${description},
          ${JSON.stringify({ ...metadata, linkId })}::jsonb
        from updated_balance
        returning id
      )
      select inserted_link.*, updated_balance.balance
      from inserted_link, updated_balance
    `
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'That custom link is already taken.'
      })
    }

    throw error
  }

  if (!rows.length) {
    throw createError({
      statusCode: 402,
      statusMessage: 'Purchase credits before creating this dynamic QR link.'
    })
  }

  return {
    balance: getNumberField(rows[0]!, 'balance'),
    link: mapDynamicQrLinkRow(rows[0]!)
  }
}

async function getEditableDynamicQrLink(sql: NeonSql, userId: string, linkId: string) {
  await ensureDynamicQrTables(sql)

  const rows = await sql`
    select id, user_id, slug, destination_url, is_dynamic, tracks_statistics, created_at, updated_at
    from dynamic_qr_links
    where id = ${linkId}
      and user_id = ${userId}
    limit 1
  `

  return rows.length ? mapDynamicQrLinkRow(rows[0]!) : null
}

function getDynamicQrFeatureCost(input: DynamicQrLinkInput, existingLink: DynamicQrLinkPayload | null) {
  if (!existingLink) {
    return Number(input.useDynamicUrl) + Number(input.trackStatistics)
  }

  return Number(input.useDynamicUrl && !existingLink.useDynamicUrl)
    + Number(input.trackStatistics && !existingLink.trackStatistics)
}

function getDynamicQrFeatureDescription(input: Pick<DynamicQrLinkInput, 'trackStatistics' | 'useDynamicUrl'>) {
  if (input.useDynamicUrl && input.trackStatistics) {
    return 'Dynamic URL and scan statistics'
  }

  return input.useDynamicUrl ? 'Dynamic URL' : 'Scan statistics'
}

function mapDynamicQrLinkRow(row: DbRow): DynamicQrLinkPayload {
  const slug = getStringField(row, 'slug')

  return {
    destinationUrl: getStringField(row, 'destination_url'),
    id: getStringField(row, 'id'),
    redirectUrl: `${dynamicQrRedirectBaseUrl}/${encodeURIComponent(slug)}`,
    slug,
    trackStatistics: getBooleanField(row, 'tracks_statistics'),
    useDynamicUrl: getBooleanField(row, 'is_dynamic')
  }
}

function getClientIpAddress(event: H3Event) {
  const forwardedFor = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()

  return getNullableRequestField(
    getRequestHeader(event, 'cf-connecting-ip')
    || forwardedFor
    || getRequestHeader(event, 'x-real-ip')
  )
}

function getCloudflareRequestCf(event: H3Event) {
  const context = event.context as {
    cloudflare?: {
      request?: {
        cf?: Record<string, unknown>
      }
    }
    _platform?: {
      cloudflare?: {
        request?: {
          cf?: Record<string, unknown>
        }
      }
    }
  }

  return context.cloudflare?.request?.cf || context._platform?.cloudflare?.request?.cf
}

function getNullableRequestField(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
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

function getBooleanField(row: DbRow, key: string) {
  const value = row[key]

  return typeof value === 'boolean' ? value : value === 'true'
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
