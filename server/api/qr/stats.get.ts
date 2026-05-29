import { dynamicQrStatsRanges, type DynamicQrAggregateStats, type DynamicQrStatsRange } from '~~/app/utils/dynamic-qr'
import { ensureDynamicQrTables } from '~~/server/utils/dynamic-qr'
import { ensureSavedQrTables } from '~~/server/utils/saved-qr'

type DbRow = Record<string, unknown>

type NeonSql = ReturnType<typeof useNeon>

const statsRangeHours: Record<DynamicQrStatsRange, number> = {
  '24h': 24,
  '7d': 7 * 24,
  '30d': 30 * 24,
  '365d': 365 * 24
}

export default defineEventHandler(async (event): Promise<DynamicQrAggregateStats> => {
  const session = await requireUserSession(event)
  const range = normalizeStatsRange(getQuery(event).range)
  const rangeHours = statsRangeHours[range]
  const sql = useNeon()

  await Promise.all([
    ensureDynamicQrTables(sql),
    ensureSavedQrTables(sql)
  ])

  const [trackedLinkRows, totalRows, periodRows, countryRows, topLinkRows, recentRows] = await Promise.all([
    getTrackedLinkRows(sql, session.user.id),
    getTotalRows(sql, session.user.id, rangeHours),
    getPeriodRows(sql, session.user.id, range, rangeHours),
    getCountryRows(sql, session.user.id, rangeHours),
    getTopLinkRows(sql, session.user.id, rangeHours),
    getRecentRows(sql, session.user.id, rangeHours)
  ])
  const totals = totalRows[0] || {}

  return {
    activeTrackedLinks: getNumberField(totals, 'active_tracked_links'),
    lastScannedAt: getNullableStringField(totals, 'last_scanned_at'),
    range,
    recentScans: recentRows.map(row => ({
      city: getNullableStringField(row, 'city'),
      country: getNullableStringField(row, 'country'),
      id: getStringField(row, 'id'),
      linkId: getStringField(row, 'link_id'),
      linkName: getStringField(row, 'link_name'),
      region: getNullableStringField(row, 'region'),
      scannedAt: getStringField(row, 'scanned_at'),
      slug: getStringField(row, 'slug')
    })),
    scansByCountry: countryRows.map(mapSummaryRow),
    scansByPeriod: periodRows.map(mapSummaryRow),
    topLinks: topLinkRows.map(row => ({
      count: getNumberField(row, 'count'),
      id: getStringField(row, 'id'),
      label: getStringField(row, 'label'),
      lastScannedAt: getNullableStringField(row, 'last_scanned_at'),
      slug: getStringField(row, 'slug')
    })),
    totalScans: getNumberField(totals, 'total_scans'),
    totalTrackedLinks: getNumberField(trackedLinkRows[0] || {}, 'total_tracked_links')
  }
})

function getTrackedLinkRows(sql: NeonSql, userId: string) {
  return sql`
    with user_links as (
      select dynamic_qr_links.id
      from dynamic_qr_links
      where dynamic_qr_links.user_id = ${userId}
        and dynamic_qr_links.tracks_statistics = true
    )
    select count(*)::int as total_tracked_links
    from user_links
  `
}

function getTotalRows(sql: NeonSql, userId: string, rangeHours: number) {
  return sql`
    with user_links as (
      select dynamic_qr_links.id
      from dynamic_qr_links
      where dynamic_qr_links.user_id = ${userId}
        and dynamic_qr_links.tracks_statistics = true
    )
    select
      count(dynamic_qr_scans.id)::int as total_scans,
      count(distinct dynamic_qr_scans.link_id)::int as active_tracked_links,
      max(dynamic_qr_scans.scanned_at) as last_scanned_at
    from user_links
    left join dynamic_qr_scans
      on dynamic_qr_scans.link_id = user_links.id
      and dynamic_qr_scans.scanned_at >= now() - (${rangeHours} * interval '1 hour')
  `
}

function getPeriodRows(sql: NeonSql, userId: string, range: DynamicQrStatsRange, rangeHours: number) {
  if (range === '24h') {
    return sql`
      with user_links as (
        select dynamic_qr_links.id
        from dynamic_qr_links
        where dynamic_qr_links.user_id = ${userId}
          and dynamic_qr_links.tracks_statistics = true
      )
      select to_char(date_trunc('hour', dynamic_qr_scans.scanned_at), 'YYYY-MM-DD HH24:00') as label, count(*)::int as count
      from dynamic_qr_scans
      inner join user_links
        on user_links.id = dynamic_qr_scans.link_id
      where dynamic_qr_scans.scanned_at >= now() - (${rangeHours} * interval '1 hour')
      group by date_trunc('hour', dynamic_qr_scans.scanned_at)
      order by date_trunc('hour', dynamic_qr_scans.scanned_at)
    `
  }

  if (range === '365d') {
    return sql`
      with user_links as (
        select dynamic_qr_links.id
        from dynamic_qr_links
        where dynamic_qr_links.user_id = ${userId}
          and dynamic_qr_links.tracks_statistics = true
      )
      select to_char(date_trunc('month', dynamic_qr_scans.scanned_at), 'YYYY-MM') as label, count(*)::int as count
      from dynamic_qr_scans
      inner join user_links
        on user_links.id = dynamic_qr_scans.link_id
      where dynamic_qr_scans.scanned_at >= now() - (${rangeHours} * interval '1 hour')
      group by date_trunc('month', dynamic_qr_scans.scanned_at)
      order by date_trunc('month', dynamic_qr_scans.scanned_at)
    `
  }

  return sql`
    with user_links as (
      select dynamic_qr_links.id
      from dynamic_qr_links
      where dynamic_qr_links.user_id = ${userId}
        and dynamic_qr_links.tracks_statistics = true
    )
    select to_char(date_trunc('day', dynamic_qr_scans.scanned_at), 'YYYY-MM-DD') as label, count(*)::int as count
    from dynamic_qr_scans
    inner join user_links
      on user_links.id = dynamic_qr_scans.link_id
    where dynamic_qr_scans.scanned_at >= now() - (${rangeHours} * interval '1 hour')
    group by date_trunc('day', dynamic_qr_scans.scanned_at)
    order by date_trunc('day', dynamic_qr_scans.scanned_at)
  `
}

function getCountryRows(sql: NeonSql, userId: string, rangeHours: number) {
  return sql`
    with user_links as (
      select dynamic_qr_links.id
      from dynamic_qr_links
      where dynamic_qr_links.user_id = ${userId}
        and dynamic_qr_links.tracks_statistics = true
    )
    select coalesce(nullif(dynamic_qr_scans.country, ''), 'Unknown') as label, count(*)::int as count
    from dynamic_qr_scans
    inner join user_links
      on user_links.id = dynamic_qr_scans.link_id
    where dynamic_qr_scans.scanned_at >= now() - (${rangeHours} * interval '1 hour')
    group by coalesce(nullif(dynamic_qr_scans.country, ''), 'Unknown')
    order by count(*) desc, label
    limit 10
  `
}

function getTopLinkRows(sql: NeonSql, userId: string, rangeHours: number) {
  return sql`
    with user_links as (
      select
        dynamic_qr_links.id,
        dynamic_qr_links.slug,
        coalesce(saved_link.name, dynamic_qr_links.slug) as label
      from dynamic_qr_links
      left join lateral (
        select saved_qr_codes.name
        from saved_qr_codes
        where saved_qr_codes.user_id = dynamic_qr_links.user_id
          and saved_qr_codes.payload #>> '{dynamicLink,id}' = dynamic_qr_links.id
        order by saved_qr_codes.updated_at desc
        limit 1
      ) saved_link on true
      where dynamic_qr_links.user_id = ${userId}
        and dynamic_qr_links.tracks_statistics = true
    )
    select user_links.id, user_links.label, user_links.slug, count(*)::int as count, max(dynamic_qr_scans.scanned_at) as last_scanned_at
    from dynamic_qr_scans
    inner join user_links
      on user_links.id = dynamic_qr_scans.link_id
    where dynamic_qr_scans.scanned_at >= now() - (${rangeHours} * interval '1 hour')
    group by user_links.id, user_links.label, user_links.slug
    order by count(*) desc, max(dynamic_qr_scans.scanned_at) desc, user_links.label
    limit 10
  `
}

function getRecentRows(sql: NeonSql, userId: string, rangeHours: number) {
  return sql`
    with user_links as (
      select
        dynamic_qr_links.id,
        dynamic_qr_links.slug,
        coalesce(saved_link.name, dynamic_qr_links.slug) as label
      from dynamic_qr_links
      left join lateral (
        select saved_qr_codes.name
        from saved_qr_codes
        where saved_qr_codes.user_id = dynamic_qr_links.user_id
          and saved_qr_codes.payload #>> '{dynamicLink,id}' = dynamic_qr_links.id
        order by saved_qr_codes.updated_at desc
        limit 1
      ) saved_link on true
      where dynamic_qr_links.user_id = ${userId}
        and dynamic_qr_links.tracks_statistics = true
    )
    select
      dynamic_qr_scans.id,
      dynamic_qr_scans.city,
      dynamic_qr_scans.region,
      dynamic_qr_scans.country,
      dynamic_qr_scans.scanned_at,
      user_links.id as link_id,
      user_links.label as link_name,
      user_links.slug
    from dynamic_qr_scans
    inner join user_links
      on user_links.id = dynamic_qr_scans.link_id
    where dynamic_qr_scans.scanned_at >= now() - (${rangeHours} * interval '1 hour')
    order by dynamic_qr_scans.scanned_at desc
    limit 12
  `
}

function normalizeStatsRange(value: unknown): DynamicQrStatsRange {
  return typeof value === 'string' && dynamicQrStatsRanges.includes(value as DynamicQrStatsRange)
    ? value as DynamicQrStatsRange
    : '7d'
}

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
