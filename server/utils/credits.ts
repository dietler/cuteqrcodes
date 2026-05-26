import type { CreditPack, CreditPackId, CreditTransaction, PurchasedPdf } from '~~/app/utils/credits'
import { creditPacks } from '~~/app/utils/credits'
import type { H3Event } from 'h3'

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
  pdfBytes: Uint8Array
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
    await sql`
      create table if not exists user_credit_balances (
        user_id text primary key references "user"(id) on delete cascade,
        balance integer not null default 0 check (balance >= 0),
        updated_at timestamptz not null default now()
      )
    `
    await sql`
      create table if not exists purchased_pdfs (
        id text primary key,
        user_id text not null references "user"(id) on delete cascade,
        template_id text not null,
        template_label text not null,
        qr_title text not null,
        storage_key text not null unique,
        size_bytes integer not null check (size_bytes > 0),
        created_at timestamptz not null default now()
      )
    `
    await sql`create index if not exists purchased_pdfs_user_id_idx on purchased_pdfs(user_id, created_at desc)`
    await sql`
      create table if not exists credit_transactions (
        id text primary key,
        user_id text not null references "user"(id) on delete cascade,
        type text not null check (type in ('credit_purchase', 'pdf_purchase')),
        credits integer not null check (credits <> 0),
        balance_after integer not null check (balance_after >= 0),
        description text not null,
        lemon_squeezy_order_id text unique,
        lemon_squeezy_variant_id text,
        pdf_purchase_id text references purchased_pdfs(id) on delete set null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    `
    await sql`create index if not exists credit_transactions_user_id_idx on credit_transactions(user_id, created_at desc)`
  })()

  return creditTablesReady
}

export async function getCreditBalance(sql: NeonSql, userId: string) {
  await ensureCreditTables(sql)

  const rows = await sql`
    insert into user_credit_balances (user_id, balance)
    values (${userId}, 0)
    on conflict (user_id) do update set user_id = excluded.user_id
    returning balance
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

export function getCreditPackByVariantId(variantId: unknown) {
  const normalizedVariantId = String(variantId || '')

  if (!normalizedVariantId) {
    return null
  }

  return creditPacks.find(pack => process.env[creditPackVariantEnvNames[pack.id]] === normalizedVariantId) ?? null
}

export function getCreditPackVariantId(pack: CreditPack) {
  const variantId = process.env[creditPackVariantEnvNames[pack.id]]

  if (!variantId) {
    throw createError({
      statusCode: 500,
      statusMessage: `${creditPackVariantEnvNames[pack.id]} is required.`
    })
  }

  return variantId
}

export function getLemonSqueezyConfig() {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY || ''
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID || ''

  if (!apiKey || !storeId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Lemon Squeezy config is incomplete.'
    })
  }

  return {
    apiKey,
    storeId,
    testMode: process.env.LEMON_SQUEEZY_TEST_MODE === 'true'
  }
}

export function getPdfBucket(event: H3Event) {
  const bucket = (event.context as {
    cloudflare?: {
      env?: Record<string, unknown>
    }
  }).cloudflare?.env?.PDF_BUCKET as R2BucketLike | undefined

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
    select id, type, credits, balance_after, description, lemon_squeezy_order_id, lemon_squeezy_variant_id, pdf_purchase_id, created_at
    from credit_transactions
    where user_id = ${userId}
    order by created_at desc
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
  lemonSqueezyOrderId,
  lemonSqueezyVariantId,
  metadata,
  pack,
  userId
}: {
  credits: number
  lemonSqueezyOrderId: string
  lemonSqueezyVariantId: string
  metadata: unknown
  pack: CreditPack
  userId: string
}) {
  const sql = useNeon()

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
  const sql = useNeon()
  const bucket = getPdfBucket(event)
  const balance = await getCreditBalance(sql, input.userId)

  if (balance < 1) {
    throw createError({
      statusCode: 402,
      statusMessage: 'Purchase credits before creating this PDF.'
    })
  }

  const pdfId = crypto.randomUUID()
  const storageKey = `purchased-pdfs/${input.userId}/${pdfId}.pdf`

  await bucket.put(storageKey, input.pdfBytes, {
    httpMetadata: {
      contentType: 'application/pdf'
    }
  })

  const rows = await sql`
    with updated_balance as (
      update user_credit_balances
      set balance = balance - 1,
          updated_at = now()
      where user_id = ${input.userId}
        and balance >= 1
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
      -1,
      updated_balance.balance,
      ${`${input.templateLabel} PDF purchase`},
      inserted_pdf.id,
      ${JSON.stringify({ templateId: input.templateId, qrTitle: input.qrTitle })}::jsonb
    from updated_balance, inserted_pdf
    returning balance_after, pdf_purchase_id
  `

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

  return {
    balance: getNumberField(rows[0]!, 'balance_after'),
    pdf: mapPurchasedPdfRow(pdfRows[0]!)
  }
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
  return {
    balanceAfter: getNumberField(row, 'balance_after'),
    createdAt: getStringField(row, 'created_at'),
    credits: getNumberField(row, 'credits'),
    description: getStringField(row, 'description'),
    id: getStringField(row, 'id'),
    lemonSqueezyOrderId: getNullableStringField(row, 'lemon_squeezy_order_id'),
    lemonSqueezyVariantId: getNullableStringField(row, 'lemon_squeezy_variant_id'),
    pdfPurchaseId: getNullableStringField(row, 'pdf_purchase_id'),
    type: getStringField(row, 'type') as CreditTransaction['type']
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
