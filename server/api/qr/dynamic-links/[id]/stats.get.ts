import type { DynamicQrStats } from '~~/app/utils/dynamic-qr'
import { ensureDynamicQrTables } from '~~/server/utils/dynamic-qr'

type DbRow = Record<string, unknown>

export default defineEventHandler(async (event): Promise<DynamicQrStats> => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id') || ''

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dynamic QR link is required.'
    })
  }

  const sql = useNeon(event)

  await ensureDynamicQrTables(sql)

  const linkRows = await sql`
    select id, tracks_statistics
    from dynamic_qr_links
    where id = ${id}
      and user_id = ${session.user.id}
    limit 1
  `

  if (!linkRows.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Dynamic QR link not found.'
    })
  }

  if (linkRows[0]?.tracks_statistics !== true) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Stats are not enabled for this QR code.'
    })
  }

  const [totalRows, dayRows, countryRows, recentRows] = await Promise.all([
    sql`
      select count(*)::int as total_scans, max(scanned_at) as last_scanned_at
      from dynamic_qr_scans
      where link_id = ${id}
    `,
    sql`
      select to_char(date_trunc('day', scanned_at), 'YYYY-MM-DD') as label, count(*)::int as count
      from dynamic_qr_scans
      where link_id = ${id}
      group by date_trunc('day', scanned_at)
      order by date_trunc('day', scanned_at) desc
      limit 14
    `,
    sql`
      select coalesce(nullif(country, ''), 'Unknown') as label, count(*)::int as count
      from dynamic_qr_scans
      where link_id = ${id}
      group by coalesce(nullif(country, ''), 'Unknown')
      order by count(*) desc, label
      limit 10
    `,
    sql`
      select id, city, region, country, scanned_at
      from dynamic_qr_scans
      where link_id = ${id}
      order by scanned_at desc
      limit 10
    `
  ])
  const totals = totalRows[0] || {}

  return {
    lastScannedAt: getNullableStringField(totals, 'last_scanned_at'),
    recentScans: recentRows.map(row => ({
      city: getNullableStringField(row, 'city'),
      country: getNullableStringField(row, 'country'),
      id: getStringField(row, 'id'),
      region: getNullableStringField(row, 'region'),
      scannedAt: getStringField(row, 'scanned_at')
    })),
    scansByCountry: countryRows.map(mapSummaryRow),
    scansByDay: dayRows.map(mapSummaryRow).reverse(),
    totalScans: getNumberField(totals, 'total_scans')
  }
})

function mapSummaryRow(row: DbRow) {
  return {
    count: getNumberField(row, 'count'),
    label: getStringField(row, 'label')
  }
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

  return typeof value === 'number' ? value : Number(value || 0)
}
