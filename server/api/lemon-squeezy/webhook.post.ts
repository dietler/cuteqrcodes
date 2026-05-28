import { createHmac, timingSafeEqual } from 'node:crypto'
import { getCreditPack, getCreditPackByVariantId, grantCreditsForOrder } from '~~/server/utils/credits'
import { getRuntimeEnv, populateProcessEnvFromRuntime } from '~~/server/utils/runtime-env'

type LemonSqueezyWebhookPayload = {
  meta?: {
    custom_data?: Record<string, unknown>
    event_name?: string
  }
  data?: {
    id?: string
    attributes?: {
      first_order_item?: {
        variant_id?: string | number
      }
      status?: string
      store_id?: string | number
      test_mode?: boolean
      total?: number
      urls?: {
        receipt?: string
      }
      user_email?: string
    }
  }
}

export default defineEventHandler(async (event) => {
  populateProcessEnvFromRuntime(event)

  const rawBody = await readRawBody(event)
  const signature = getHeader(event, 'x-signature') || ''
  const signingSecret = getRuntimeEnv(event, 'LEMON_SQUEEZY_WEBHOOK_SECRET')

  if (!rawBody || !signingSecret) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Webhook payload or signing secret is missing.'
    })
  }

  verifyWebhookSignature(rawBody, signature, signingSecret)

  const payload = JSON.parse(rawBody) as LemonSqueezyWebhookPayload

  if (payload.meta?.event_name !== 'order_created') {
    return {
      ignored: true
    }
  }

  const attributes = payload.data?.attributes

  if (attributes?.status !== 'paid') {
    return {
      ignored: true
    }
  }

  const configuredStoreId = getRuntimeEnv(event, 'LEMON_SQUEEZY_STORE_ID')

  if (configuredStoreId && String(attributes.store_id || '') !== configuredStoreId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Webhook store does not match this app.'
    })
  }

  const customData = payload.meta?.custom_data || {}
  const userId = typeof customData.user_id === 'string' ? customData.user_id : ''
  const variantId = String(attributes.first_order_item?.variant_id || '')
  const pack = typeof customData.credit_pack_id === 'string'
    ? getCreditPack(customData.credit_pack_id)
    : getCreditPackByVariantId(variantId)
  const orderId = payload.data?.id || ''

  if (!userId || !orderId || !pack) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Webhook credit purchase metadata is incomplete.'
    })
  }

  const result = await grantCreditsForOrder({
    credits: pack.credits,
    lemonSqueezyOrderId: orderId,
    lemonSqueezyVariantId: variantId,
    metadata: {
      receiptUrl: attributes.urls?.receipt,
      testMode: attributes.test_mode,
      total: attributes.total,
      userEmail: attributes.user_email
    },
    pack,
    userId
  })

  return {
    balance: result.balance,
    processed: result.processed
  }
})

function verifyWebhookSignature(rawBody: string, signature: string, signingSecret: string) {
  const digest = Buffer.from(createHmac('sha256', signingSecret).update(rawBody).digest('hex'), 'utf8')
  const signatureBuffer = Buffer.from(signature, 'utf8')

  if (digest.byteLength !== signatureBuffer.byteLength || !timingSafeEqual(digest, signatureBuffer)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid Lemon Squeezy webhook signature.'
    })
  }
}
