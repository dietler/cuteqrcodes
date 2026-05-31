import type { CreditPack, CreditPackId, CreditTransaction, CreditTransactionLabelPurchase, PurchasedPdf } from '~~/app/utils/credits'
import { createDynamicQrRedirectUrl, type DynamicQrLinkPayload } from '~~/app/utils/dynamic-qr'
import type { SavedQrPayload } from '~~/app/utils/saved-qr'
import { creditPacks } from '~~/app/utils/credits'
import { ensureDynamicQrTables, getDynamicQrFeatureCost, mapDynamicQrLinkRow, type DynamicQrLinkInput } from '~~/server/utils/dynamic-qr'
import { ensureSavedQrTables, mapSavedQrRow } from '~~/server/utils/saved-qr'
import type { H3Event } from 'h3'
import { getCloudflareEnv, getRuntimeEnv } from '~~/server/utils/runtime-env'

type NeonSql = ReturnType<typeof useNeon>

type DbRow = Record<string, unknown>

type R2BucketLike = {
  delete: (key: string | string[]) => Promise<void>
  get: (key: string) => Promise<{
    body?: ReadableStream
    httpMetadata?: {
      contentType?: string
    }
  } | null>
  put: (key: string, value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string | null, options?: {
    httpMetadata?: {
      contentType?: string
    }
  }) => Promise<unknown>
}

type PdfPurchaseInput = {
  dynamicLink?: DynamicQrLinkInput
  pdfBytes: Uint8Array
  previewHeight: number
  previewSvg: string
  previewWidth: number
  qrPayload: SavedQrPayload
  qrTitle: string
  templateId: string
  templateLabel: string
  userId: string
}

const creditPackVariantEnvNames: Record<CreditPackId, string> = {
  'credits-1': 'LEMON_SQUEEZY_CREDITS_1_VARIANT_ID',
  'credits-5': 'LEMON_SQUEEZY_CREDITS_5_VARIANT_ID',
  'credits-10': 'LEMON_SQUEEZY_CREDITS_10_VARIANT_ID',
  'credits-100': 'LEMON_SQUEEZY_CREDITS_100_VARIANT_ID',
  'credits-1000': 'LEMON_SQUEEZY_CREDITS_1000_VARIANT_ID'
}

let creditTablesReady: Promise<void> | null = null

export async function ensureCreditTables(sql: NeonSql) {
  creditTablesReady ??= (async () => {
    const rows = await sql`
      select
        to_regclass('public.user_credit_balances') as user_credit_balances,
        to_regclass('public.purchased_pdfs') as purchased_pdfs,
        to_regclass('public.credit_transactions') as credit_transactions
    `
    const readiness = rows[0] ?? {}

    if (!readiness.user_credit_balances || !readiness.purchased_pdfs || !readiness.credit_transactions) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Credit tables are not ready. Apply database/credits-schema.sql before serving requests.'
      })
    }
  })().catch((error) => {
    creditTablesReady = null
    throw error
  })

  return creditTablesReady
}

export async function getCreditBalance(sql: NeonSql, userId: string) {
  await ensureCreditTables(sql)

  const rows = await sql`
    with inserted_balance as (
      insert into user_credit_balances (user_id, balance)
      values (${userId}, 0)
      on conflict (user_id) do nothing
      returning balance
    )
    select balance from inserted_balance
    union all
    select balance
    from user_credit_balances
    where user_id = ${userId}
    limit 1
  `

  return getNumberField(rows[0]!, 'balance')
}

export function getCreditPack(packId: unknown): CreditPack {
  const pack = typeof packId === 'string' ? creditPacks.find(item => item.id === packId) : null

  if (!pack) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Credit pack is required.'
    })
  }

  return pack
}

export function getCreditPackByVariantId(event: H3Event, variantId: unknown) {
  const normalizedVariantId = String(variantId || '')

  if (!normalizedVariantId) {
    return null
  }

  return creditPacks.find(pack => getRuntimeEnv(event, creditPackVariantEnvNames[pack.id]) === normalizedVariantId) ?? null
}

export function getCreditPackVariantId(event: H3Event, pack: CreditPack) {
  const variantId = getRuntimeEnv(event, creditPackVariantEnvNames[pack.id])

  if (!variantId) {
    throw createError({
      statusCode: 500,
      statusMessage: `${creditPackVariantEnvNames[pack.id]} is required.`
    })
  }

  return variantId
}

export function getLemonSqueezyConfig(event: H3Event) {
  const apiKey = getRuntimeEnv(event, 'LEMON_SQUEEZY_API_KEY')
  const storeId = getRuntimeEnv(event, 'LEMON_SQUEEZY_STORE_ID')

  if (!apiKey || !storeId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Lemon Squeezy config is incomplete.'
    })
  }

  return {
    apiKey,
    storeId,
    testMode: getRuntimeEnv(event, 'LEMON_SQUEEZY_TEST_MODE') === 'true'
  }
}

export function getPdfBucket(event: H3Event) {
  const bucket = getCloudflareEnv(event)?.PDF_BUCKET as R2BucketLike | undefined

  if (!bucket) {
    throw createError({
      statusCode: 500,
      statusMessage: 'PDF_BUCKET R2 binding is required.'
    })
  }

  return bucket
}

export async function listCreditTransactions(sql: NeonSql, userId: string): Promise<CreditTransaction[]> {
  await ensureCreditTables(sql)

  const rows = await sql`
    select
      credit_transactions.id,
      credit_transactions.type,
      credit_transactions.credits,
      credit_transactions.balance_after,
      credit_transactions.description,
      credit_transactions.lemon_squeezy_order_id,
      credit_transactions.lemon_squeezy_variant_id,
      credit_transactions.pdf_purchase_id,
      credit_transactions.metadata,
      credit_transactions.created_at,
      saved_qr_codes.payload as saved_qr_payload
    from credit_transactions
    left join saved_qr_codes
      on saved_qr_codes.pdf_purchase_id = credit_transactions.pdf_purchase_id
      and saved_qr_codes.user_id = credit_transactions.user_id
    where credit_transactions.user_id = ${userId}
    order by credit_transactions.created_at desc
    limit 50
  `

  return rows.map(mapCreditTransactionRow)
}

export async function listPurchasedPdfs(sql: NeonSql, userId: string): Promise<PurchasedPdf[]> {
  await ensureCreditTables(sql)

  const rows = await sql`
    select id, template_id, template_label, qr_title, size_bytes, created_at
    from purchased_pdfs
    where user_id = ${userId}
    order by created_at desc
    limit 50
  `

  return rows.map(mapPurchasedPdfRow)
}

export async function grantCreditsForOrder({
  credits,
  event,
  lemonSqueezyOrderId,
  lemonSqueezyVariantId,
  metadata,
  pack,
  userId
}: {
  credits: number
  event: H3Event
  lemonSqueezyOrderId: string
  lemonSqueezyVariantId: string
  metadata: unknown
  pack: CreditPack
  userId: string
}) {
  const sql = useNeon(event)

  await ensureCreditTables(sql)

  const rows = await sql`
    with updated_balance as (
      insert into user_credit_balances (user_id, balance)
      values (${userId}, ${credits})
      on conflict (user_id) do update
        set balance = user_credit_balances.balance + excluded.balance,
            updated_at = now()
      where not exists (
        select 1
        from credit_transactions
        where lemon_squeezy_order_id = ${lemonSqueezyOrderId}
      )
      returning balance
    )
    insert into credit_transactions (
      id,
      user_id,
      type,
      credits,
      balance_after,
      description,
      lemon_squeezy_order_id,
      lemon_squeezy_variant_id,
      metadata
    )
    select
      ${crypto.randomUUID()},
      ${userId},
      'credit_purchase',
      ${credits},
      updated_balance.balance,
      ${`${pack.label} purchase`},
      ${lemonSqueezyOrderId},
      ${lemonSqueezyVariantId},
      ${JSON.stringify(metadata)}::jsonb
    from updated_balance
    returning balance_after
  `

  return {
    balance: rows.length ? getNumberField(rows[0]!, 'balance_after') : await getCreditBalance(sql, userId),
    processed: rows.length > 0
  }
}

export async function savePurchasedPdf(event: H3Event, input: PdfPurchaseInput) {
  const sql = useNeon(event)
  const bucket = getPdfBucket(event)
  await Promise.all([
    ensureCreditTables(sql),
    ensureSavedQrTables(sql)
  ])

  if (input.dynamicLink) {
    await ensureDynamicQrTables(sql)
  }

  const existingDynamicLink = input.dynamicLink?.existingLinkId
    ? await getPdfPurchaseDynamicQrLink(sql, input.userId, input.dynamicLink.existingLinkId)
    : null

  if (input.dynamicLink?.existingLinkId && !existingDynamicLink) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Dynamic QR link not found.'
    })
  }

  const dynamicCreditsToCharge = input.dynamicLink
    ? getDynamicQrFeatureCost(input.dynamicLink, existingDynamicLink)
    : 0
  const creditsToCharge = 1 + dynamicCreditsToCharge
  const balance = await getCreditBalance(sql, input.userId)

  if (balance < creditsToCharge) {
    throw createError({
      statusCode: 402,
      statusMessage: 'Purchase credits before creating this PDF.'
    })
  }

  const pdfId = crypto.randomUUID()
  const dynamicLinkId = input.dynamicLink?.existingLinkId || crypto.randomUUID()
  const purchasedQrId = crypto.randomUUID()
  const storageKey = `purchased-pdfs/${input.userId}/${pdfId}.pdf`
  const sanitizedQrPayload = { ...input.qrPayload }

  delete sanitizedQrPayload.dynamicLink

  const purchasedQrPayload: SavedQrPayload = {
    ...sanitizedQrPayload,
    ...(input.dynamicLink
      ? {
          dynamicLink: {
            destinationUrl: input.dynamicLink.destinationUrl,
            id: dynamicLinkId,
            redirectUrl: createDynamicQrRedirectUrl(input.dynamicLink.slug),
            slug: input.dynamicLink.slug,
            trackStatistics: input.dynamicLink.trackStatistics,
            useDynamicUrl: input.dynamicLink.useDynamicUrl
          }
        }
      : {})
  }
  const transactionMetadata = {
    destinationUrl: input.dynamicLink?.destinationUrl || input.qrPayload.url,
    dynamicLink: input.dynamicLink
      ? {
          destinationUrl: input.dynamicLink.destinationUrl,
          linkId: dynamicLinkId,
          slug: input.dynamicLink.slug,
          trackStatistics: input.dynamicLink.trackStatistics,
          useDynamicUrl: input.dynamicLink.useDynamicUrl
        }
      : undefined,
    dynamicLinkCredits: dynamicCreditsToCharge,
    pdfCredits: 1,
    qrTitle: input.qrTitle,
    templateId: input.templateId
  }

  await bucket.put(storageKey, input.pdfBytes, {
    httpMetadata: {
      contentType: 'application/pdf'
    }
  })

  let rows: DbRow[]

  try {
    rows = input.dynamicLink?.existingLinkId
      ? await sql`
    with editable_link as (
      select id
      from dynamic_qr_links
      where id = ${input.dynamicLink.existingLinkId}
        and user_id = ${input.userId}
      limit 1
    ),
    updated_balance as (
      update user_credit_balances
      set balance = balance - ${creditsToCharge},
          updated_at = now()
      where user_id = ${input.userId}
        and balance >= ${creditsToCharge}
        and exists (select 1 from editable_link)
      returning balance
    ),
    updated_link as (
      update dynamic_qr_links
      set slug = ${input.dynamicLink.slug},
          destination_url = ${input.dynamicLink.destinationUrl},
          is_dynamic = ${input.dynamicLink.useDynamicUrl},
          tracks_statistics = ${input.dynamicLink.trackStatistics},
          updated_at = now()
      where id = ${input.dynamicLink.existingLinkId}
        and user_id = ${input.userId}
        and exists (select 1 from updated_balance)
      returning id, user_id, slug, destination_url, is_dynamic, tracks_statistics, created_at, updated_at
    ),
    inserted_pdf as (
      insert into purchased_pdfs (
        id,
        user_id,
        template_id,
        template_label,
        qr_title,
        storage_key,
        size_bytes
      )
      select
        ${pdfId},
        ${input.userId},
        ${input.templateId},
        ${input.templateLabel},
        ${input.qrTitle},
        ${storageKey},
        ${input.pdfBytes.byteLength}
      from updated_balance
      returning id
    ),
    inserted_qr_code as (
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
      select
        ${purchasedQrId},
        ${input.userId},
        ${input.qrTitle},
        ${JSON.stringify(purchasedQrPayload)}::jsonb,
        ${input.previewSvg},
        ${input.previewWidth},
        ${input.previewHeight},
        'purchased',
        '{}'::text[],
        inserted_pdf.id
      from inserted_pdf
      returning id
    ),
    inserted_transaction as (
      insert into credit_transactions (
        id,
        user_id,
        type,
        credits,
        balance_after,
        description,
        pdf_purchase_id,
        metadata
      )
      select
        ${crypto.randomUUID()},
        ${input.userId},
        'pdf_purchase',
        ${-creditsToCharge},
        updated_balance.balance,
        ${`${input.templateLabel} PDF purchase`},
        inserted_pdf.id,
        ${JSON.stringify(transactionMetadata)}::jsonb
      from updated_balance, inserted_pdf, inserted_qr_code
      returning id
    )
    select updated_balance.balance as balance_after, updated_link.*
    from updated_balance, updated_link
  `
      : input.dynamicLink
        ? await sql`
    with updated_balance as (
      update user_credit_balances
      set balance = balance - ${creditsToCharge},
          updated_at = now()
      where user_id = ${input.userId}
        and balance >= ${creditsToCharge}
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
        ${dynamicLinkId},
        ${input.userId},
        ${input.dynamicLink.slug},
        ${input.dynamicLink.destinationUrl},
        ${input.dynamicLink.useDynamicUrl},
        ${input.dynamicLink.trackStatistics}
      from updated_balance
      returning id, user_id, slug, destination_url, is_dynamic, tracks_statistics, created_at, updated_at
    ),
    inserted_pdf as (
      insert into purchased_pdfs (
        id,
        user_id,
        template_id,
        template_label,
        qr_title,
        storage_key,
        size_bytes
      )
      select
        ${pdfId},
        ${input.userId},
        ${input.templateId},
        ${input.templateLabel},
        ${input.qrTitle},
        ${storageKey},
        ${input.pdfBytes.byteLength}
      from updated_balance
      returning id
    ),
    inserted_qr_code as (
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
      select
        ${purchasedQrId},
        ${input.userId},
        ${input.qrTitle},
        ${JSON.stringify(purchasedQrPayload)}::jsonb,
        ${input.previewSvg},
        ${input.previewWidth},
        ${input.previewHeight},
        'purchased',
        '{}'::text[],
        inserted_pdf.id
      from inserted_pdf
      returning id
    ),
    inserted_transaction as (
      insert into credit_transactions (
        id,
        user_id,
        type,
        credits,
        balance_after,
        description,
        pdf_purchase_id,
        metadata
      )
      select
        ${crypto.randomUUID()},
        ${input.userId},
        'pdf_purchase',
        ${-creditsToCharge},
        updated_balance.balance,
        ${`${input.templateLabel} PDF purchase`},
        inserted_pdf.id,
        ${JSON.stringify(transactionMetadata)}::jsonb
      from updated_balance, inserted_pdf, inserted_qr_code
      returning id
    )
    select updated_balance.balance as balance_after, inserted_link.*
    from updated_balance, inserted_link
  `
        : await sql`
    with updated_balance as (
      update user_credit_balances
      set balance = balance - ${creditsToCharge},
          updated_at = now()
      where user_id = ${input.userId}
        and balance >= ${creditsToCharge}
      returning balance
    ),
    inserted_pdf as (
      insert into purchased_pdfs (
        id,
        user_id,
        template_id,
        template_label,
        qr_title,
        storage_key,
        size_bytes
      )
      select
        ${pdfId},
        ${input.userId},
        ${input.templateId},
        ${input.templateLabel},
        ${input.qrTitle},
        ${storageKey},
        ${input.pdfBytes.byteLength}
      from updated_balance
      returning id, template_id, template_label, qr_title, size_bytes, created_at
    ),
    inserted_qr_code as (
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
      select
        ${purchasedQrId},
        ${input.userId},
        ${input.qrTitle},
        ${JSON.stringify(purchasedQrPayload)}::jsonb,
        ${input.previewSvg},
        ${input.previewWidth},
        ${input.previewHeight},
        'purchased',
        '{}'::text[],
        inserted_pdf.id
      from inserted_pdf
      returning id
    )
    insert into credit_transactions (
      id,
      user_id,
      type,
      credits,
      balance_after,
      description,
      pdf_purchase_id,
      metadata
    )
      select
        ${crypto.randomUUID()},
        ${input.userId},
        'pdf_purchase',
        ${-creditsToCharge},
        updated_balance.balance,
        ${`${input.templateLabel} PDF purchase`},
        inserted_pdf.id,
        ${JSON.stringify(transactionMetadata)}::jsonb
    from updated_balance, inserted_pdf, inserted_qr_code
    returning balance_after, pdf_purchase_id
  `
  } catch (error) {
    await bucket.delete(storageKey)

    if (isUniqueViolation(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'That custom link is already taken.'
      })
    }

    throw error
  }

  if (!rows.length) {
    await bucket.delete(storageKey)
    throw createError({
      statusCode: 402,
      statusMessage: 'Purchase credits before creating this PDF.'
    })
  }

  const pdfRows = await sql`
    select id, template_id, template_label, qr_title, size_bytes, created_at
    from purchased_pdfs
    where id = ${pdfId}
      and user_id = ${input.userId}
    limit 1
  `
  const qrRows = await sql`
    select id, name, payload, preview_svg, preview_width, preview_height, status, tags, pdf_purchase_id, created_at, updated_at
    from saved_qr_codes
    where id = ${purchasedQrId}
      and user_id = ${input.userId}
    limit 1
  `

  return {
    balance: getNumberField(rows[0]!, 'balance_after'),
    ...(input.dynamicLink ? { dynamicLink: mapDynamicQrLinkRow(rows[0]!) } : {}),
    pdf: mapPurchasedPdfRow(pdfRows[0]!),
    qrCode: mapSavedQrRow(qrRows[0]!)
  }
}

async function getPdfPurchaseDynamicQrLink(sql: NeonSql, userId: string, linkId: string): Promise<DynamicQrLinkPayload | null> {
  const rows = await sql`
    select id, user_id, slug, destination_url, is_dynamic, tracks_statistics, created_at, updated_at
    from dynamic_qr_links
    where id = ${linkId}
      and user_id = ${userId}
    limit 1
  `

  return rows.length ? mapDynamicQrLinkRow(rows[0]!) : null
}

export async function getPurchasedPdfStorageKey(sql: NeonSql, userId: string, pdfId: string) {
  await ensureCreditTables(sql)

  const rows = await sql`
    select storage_key
    from purchased_pdfs
    where id = ${pdfId}
      and user_id = ${userId}
    limit 1
  `

  return rows.length ? getStringField(rows[0]!, 'storage_key') : ''
}

function mapCreditTransactionRow(row: DbRow): CreditTransaction {
  const metadata = getJsonObject(row.metadata)

  return {
    balanceAfter: getNumberField(row, 'balance_after'),
    createdAt: getStringField(row, 'created_at'),
    credits: getNumberField(row, 'credits'),
    description: getStringField(row, 'description'),
    id: getStringField(row, 'id'),
    labelPurchase: mapLabelPurchaseDetails(row, metadata),
    lemonSqueezyOrderId: getNullableStringField(row, 'lemon_squeezy_order_id'),
    lemonSqueezyVariantId: getNullableStringField(row, 'lemon_squeezy_variant_id'),
    pdfPurchaseId: getNullableStringField(row, 'pdf_purchase_id'),
    receiptUrl: getOptionalString(metadata.receiptUrl),
    type: getStringField(row, 'type') as CreditTransaction['type']
  }
}

function mapLabelPurchaseDetails(row: DbRow, metadata: Record<string, unknown>): CreditTransactionLabelPurchase | null {
  if (getStringField(row, 'type') !== 'pdf_purchase') {
    return null
  }

  const savedQrPayload = getJsonObject(row.saved_qr_payload)
  const dynamicLink = getJsonObjectOrNull(savedQrPayload.dynamicLink) ?? getJsonObjectOrNull(metadata.dynamicLink) ?? {}

  return {
    destinationUrl: getOptionalString(dynamicLink.destinationUrl) || getOptionalString(savedQrPayload.url) || getOptionalString(metadata.destinationUrl),
    editable: dynamicLink.useDynamicUrl === true,
    trackStats: dynamicLink.trackStatistics === true
  }
}

function mapPurchasedPdfRow(row: DbRow): PurchasedPdf {
  const id = getStringField(row, 'id')

  return {
    createdAt: getStringField(row, 'created_at'),
    downloadUrl: `/api/credits/pdfs/${id}`,
    id,
    qrTitle: getStringField(row, 'qr_title'),
    sizeBytes: getNumberField(row, 'size_bytes'),
    templateId: getStringField(row, 'template_id'),
    templateLabel: getStringField(row, 'template_label')
  }
}

function getJsonObject(value: unknown): Record<string, unknown> {
  return getJsonObjectOrNull(value) ?? {}
}

function getJsonObjectOrNull(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown

      return getJsonObjectOrNull(parsed)
    } catch {
      return null
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return null
}

function getOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
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

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
