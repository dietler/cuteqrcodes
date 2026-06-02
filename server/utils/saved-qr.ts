import { createDynamicQrRedirectUrl, type DynamicQrLinkPayload } from '~~/app/utils/dynamic-qr'
import type { CircleLabelOrientation, SavedQrCode, SavedQrPayload, SavedQrStatus } from '~~/app/utils/saved-qr'

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

const savedQrPayloadUrlMaxLength = 2048
const savedQrTextMaxLength = 160
const savedQrAdditionalTextMaxLength = 120
const savedQrPreviewSvgMaxLength = 1_000_000
const savedQrDataUrlMaxLength = 500_000
const savedQrPreviewMaxDimension = 4096
const savedQrFontValues = new Set([
  'google-sans',
  'bebas-neue',
  'oswald',
  'roboto',
  'roboto-condensed',
  'figtree',
  'libre-baskerville',
  'changa-one',
  'lexend',
  'rye',
  'sancreek',
  'im-fell-great-primer',
  'creepster',
  'jersey-25'
])
const savedQrColorSteps = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900])
const savedQrGradientStyles = new Set(['none', 'directional', 'radial'])
const savedQrGradientDirections = new Set(['left-to-right', 'top-to-bottom', 'diagonal'])
const savedQrLabelPositions = new Set(['top', 'left', 'right', 'bottom'])
const savedQrAdditionalTextPlacements = new Set(['above', 'below'])
const savedQrShapes = new Set(['rectangle', 'circle'])
const savedQrBorders = new Set(['none', 'hairline', 'thin', 'thick', 'double', 'wavy', 'random-squares', 'rainbow'])
const savedQrCircleLabelOrientations = new Set(['up', 'down'])
const savedQrLabelLogoPositions = new Set(['top', 'bottom'])
const savedQrLabelLogoMimeTypes = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'])

export async function ensureSavedQrTables(sql: NeonSql) {
  savedQrTablesReady ??= (async () => {
    const rows = await sql`
      select to_regclass('public.saved_qr_codes') as saved_qr_codes
    `

    if (!rows[0]?.saved_qr_codes) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Saved QR tables are not ready. Apply database/saved-qr-schema.sql before serving requests.'
      })
    }
  })().catch((error) => {
    savedQrTablesReady = null
    throw error
  })

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
  const payload = getPlainObject(value)

  if (!payload || payload.version !== 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'QR code settings are invalid.'
    })
  }

  const normalized: SavedQrPayload = {
    additionalText: normalizeString(payload.additionalText, 'Additional text', savedQrAdditionalTextMaxLength),
    additionalTextFont: normalizeEnum(payload.additionalTextFont, savedQrFontValues, 'Additional text font'),
    additionalTextPlacement: normalizeEnum(payload.additionalTextPlacement, savedQrAdditionalTextPlacements, 'Additional text placement') as SavedQrPayload['additionalTextPlacement'],
    additionalTextSizeStep: normalizeInteger(payload.additionalTextSizeStep, 'Additional text size', -2, 4),
    border: normalizeEnum(payload.border, savedQrBorders, 'Border'),
    centerIcon: normalizeString(payload.centerIcon, 'Center icon', 160),
    circleLabels: normalizeCircleLabels(payload.circleLabels),
    colorName: normalizeNullableString(payload.colorName, 'QR color', 40),
    colorStep: normalizeColorStep(payload.colorStep, 'QR color step'),
    gradientDirection: normalizeEnum(payload.gradientDirection ?? 'left-to-right', savedQrGradientDirections, 'Gradient direction') as SavedQrPayload['gradientDirection'],
    gradientSecondColorName: normalizeNullableString(payload.gradientSecondColorName, 'Second gradient color', 40),
    gradientSecondColorStep: normalizeColorStep(payload.gradientSecondColorStep ?? 500, 'Second gradient color step'),
    gradientStyle: normalizeEnum(payload.gradientStyle ?? 'none', savedQrGradientStyles, 'Gradient style') as SavedQrPayload['gradientStyle'],
    gradientThirdColorName: normalizeNullableString(payload.gradientThirdColorName, 'Third gradient color', 40),
    gradientThirdColorStep: normalizeColorStep(payload.gradientThirdColorStep ?? 500, 'Third gradient color step'),
    label: normalizeString(payload.label, 'Label', savedQrTextMaxLength),
    labelBackgroundColorName: normalizeNullableString(payload.labelBackgroundColorName, 'Label background color', 40),
    labelBackgroundColorStep: normalizeColorStep(payload.labelBackgroundColorStep ?? 500, 'Label background color step'),
    labelFont: normalizeEnum(payload.labelFont, savedQrFontValues, 'Label font'),
    labelLogo: normalizeLabelLogo(payload.labelLogo),
    labelPosition: normalizeEnum(payload.labelPosition, savedQrLabelPositions, 'Label position') as SavedQrPayload['labelPosition'],
    labelSizeStep: normalizeInteger(payload.labelSizeStep, 'Label size', -2, 8),
    labelTextColorName: normalizeNullableString(payload.labelTextColorName, 'Label text color', 40),
    labelTextColorStep: normalizeColorStep(payload.labelTextColorStep ?? 500, 'Label text color step'),
    rectangleLabelHorizontalPaddingStep: normalizeInteger(payload.rectangleLabelHorizontalPaddingStep ?? 0, 'Horizontal label padding', 0, 8),
    rectangleLabelVerticalPaddingStep: normalizeInteger(payload.rectangleLabelVerticalPaddingStep ?? 0, 'Vertical label padding', 0, 8),
    shape: normalizeEnum(payload.shape ?? 'rectangle', savedQrShapes, 'QR shape') as SavedQrPayload['shape'],
    url: normalizePayloadUrl(payload.url),
    version: 1
  }

  const dynamicLink = normalizeSavedPayloadDynamicLink(payload.dynamicLink)

  if (dynamicLink) {
    normalized.dynamicLink = dynamicLink
  }

  return normalized
}

export function normalizePreviewSvg(value: unknown) {
  const previewSvg = normalizeString(value, 'QR code preview', savedQrPreviewSvgMaxLength)

  if (!/^<svg[\s>]/i.test(previewSvg.trim())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'QR code preview must be an SVG.'
    })
  }

  return previewSvg
}

export function normalizePreviewDimension(value: unknown, fieldName: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > savedQrPreviewMaxDimension) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is invalid.`
    })
  }

  return value
}

function normalizePayloadUrl(value: unknown) {
  const url = normalizeString(value, 'QR code URL', savedQrPayloadUrlMaxLength)

  try {
    const parsedUrl = new URL(url)

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid protocol.')
    }

    return parsedUrl.toString()
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'QR code URL must be a valid http:// or https:// URL.'
    })
  }
}

function normalizeString(value: unknown, fieldName: string, maxLength: number) {
  if (typeof value !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is invalid.`
    })
  }

  if (value.length > maxLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be ${maxLength} characters or less.`
    })
  }

  return value
}

function normalizeNullableString(value: unknown, fieldName: string, maxLength: number) {
  if (value === null || typeof value === 'undefined') {
    return null
  }

  return normalizeString(value, fieldName, maxLength)
}

function normalizeEnum(value: unknown, allowedValues: Set<string>, fieldName: string) {
  if (typeof value !== 'string' || !allowedValues.has(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is invalid.`
    })
  }

  return value
}

function normalizeColorStep(value: unknown, fieldName: string) {
  if (typeof value !== 'number' || !savedQrColorSteps.has(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is invalid.`
    })
  }

  return value
}

function normalizeInteger(value: unknown, fieldName: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is invalid.`
    })
  }

  return value
}

function normalizeCircleLabels(value: unknown): SavedQrPayload['circleLabels'] {
  const labels = getPlainObject(value)
  const normalizedLabels: NonNullable<SavedQrPayload['circleLabels']> = {
    bottom: normalizeCircleLabel(labels?.bottom, 'Bottom circle label'),
    left: normalizeCircleLabel(labels?.left, 'Left circle label'),
    right: normalizeCircleLabel(labels?.right, 'Right circle label'),
    top: normalizeCircleLabel(labels?.top, 'Top circle label')
  }

  return normalizedLabels
}

function normalizeCircleLabel(value: unknown, fieldName: string) {
  const label = getPlainObject(value)

  if (!label) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is invalid.`
    })
  }

  const orientation = typeof label.orientation === 'undefined'
    ? undefined
    : normalizeEnum(label.orientation, savedQrCircleLabelOrientations, `${fieldName} orientation`) as CircleLabelOrientation

  return {
    font: normalizeEnum(label.font, savedQrFontValues, `${fieldName} font`),
    ...(orientation ? { orientation } : {}),
    sizeStep: normalizeInteger(label.sizeStep, `${fieldName} size`, -2, 8),
    text: normalizeString(label.text, fieldName, savedQrTextMaxLength)
  }
}

function normalizeLabelLogo(value: unknown): SavedQrPayload['labelLogo'] {
  if (value === null || typeof value === 'undefined') {
    return null
  }

  const logo = getPlainObject(value)

  if (!logo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Label logo is invalid.'
    })
  }

  const src = normalizeString(logo.src, 'Label logo data URL', savedQrDataUrlMaxLength)
  const mimeType = normalizeEnum(logo.mimeType, savedQrLabelLogoMimeTypes, 'Label logo MIME type')

  if (!src.startsWith(`data:${mimeType};base64,`) && !(mimeType === 'image/svg+xml' && src.startsWith('data:image/svg+xml'))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Label logo data URL is invalid.'
    })
  }

  return {
    mimeType,
    name: normalizeString(logo.name, 'Label logo name', 160),
    naturalHeight: normalizePreviewDimension(logo.naturalHeight, 'Label logo height'),
    naturalWidth: normalizePreviewDimension(logo.naturalWidth, 'Label logo width'),
    position: normalizeEnum(logo.position, savedQrLabelLogoPositions, 'Label logo position') as NonNullable<SavedQrPayload['labelLogo']>['position'],
    sizeStep: typeof logo.sizeStep === 'undefined' ? undefined : normalizeInteger(logo.sizeStep, 'Label logo size', -4, 0),
    src
  }
}

function normalizeSavedPayloadDynamicLink(value: unknown): DynamicQrLinkPayload | undefined {
  if (typeof value === 'undefined' || value === null) {
    return undefined
  }

  const dynamicLink = getPlainObject(value)

  if (!dynamicLink) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dynamic QR link is invalid.'
    })
  }

  const id = normalizeString(dynamicLink.id, 'Dynamic QR link id', 160)

  if (!id) {
    return undefined
  }

  return {
    destinationUrl: normalizePayloadUrl(dynamicLink.destinationUrl),
    id,
    redirectUrl: normalizeString(dynamicLink.redirectUrl, 'Dynamic QR redirect URL', savedQrPayloadUrlMaxLength),
    slug: normalizeString(dynamicLink.slug, 'Dynamic QR slug', 64),
    trackStatistics: normalizeBoolean(dynamicLink.trackStatistics, 'Dynamic QR scan statistics'),
    useDynamicUrl: normalizeBoolean(dynamicLink.useDynamicUrl, 'Dynamic QR editable URL')
  }
}

function normalizeBoolean(value: unknown, fieldName: string) {
  if (typeof value !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is invalid.`
    })
  }

  return value
}

function getPlainObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
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

async function resolveSavedQrPayloadDynamicLink(sql: NeonSql, userId: string, payload: SavedQrPayload): Promise<SavedQrPayload> {
  if (!payload.dynamicLink?.id) {
    const sanitizedPayload = { ...payload }

    delete sanitizedPayload.dynamicLink

    return sanitizedPayload
  }

  const rows = await sql`
    select id, user_id, slug, destination_url, is_dynamic, tracks_statistics, created_at, updated_at
    from dynamic_qr_links
    where id = ${payload.dynamicLink.id}
      and user_id = ${userId}
    limit 1
  `

  if (!rows.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'QR code dynamic link is invalid.'
    })
  }

  return {
    ...payload,
    dynamicLink: mapDynamicQrLinkFields(rows[0]!)
  }
}

export async function createSavedQrCode(sql: NeonSql, input: SavedQrWriteInput) {
  await ensureSavedQrTables(sql)
  const payload = await resolveSavedQrPayloadDynamicLink(sql, input.userId, input.payload)

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
      ${JSON.stringify(payload)}::jsonb,
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

function mapDynamicQrLinkFields(row: DbRow): DynamicQrLinkPayload {
  const slug = getStringField(row, 'slug')

  return {
    destinationUrl: getStringField(row, 'destination_url'),
    id: getStringField(row, 'id'),
    redirectUrl: createDynamicQrRedirectUrl(slug),
    slug,
    trackStatistics: getBooleanField(row, 'tracks_statistics'),
    useDynamicUrl: getBooleanField(row, 'is_dynamic')
  }
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
