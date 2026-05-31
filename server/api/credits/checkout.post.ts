import type { CreditPackId } from '~~/app/utils/credits'
import { getCreditPack, getCreditPackVariantId, getLemonSqueezyConfig } from '~~/server/utils/credits'

type CheckoutBody = {
  packId?: CreditPackId
  returnTo?: string
}

type LemonSqueezyCheckoutResponse = {
  data?: {
    attributes?: {
      url?: string
    }
  }
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody<CheckoutBody>(event)
  const pack = getCreditPack(body?.packId)
  const variantId = getCreditPackVariantId(event, pack)
  const variantNumber = Number(variantId)
  const config = getLemonSqueezyConfig(event)
  const origin = getRequestURL(event).origin
  const returnPath = typeof body?.returnTo === 'string' && body.returnTo.startsWith('/') ? body.returnTo : '/credits'
  const redirectUrl = `${origin}/credits?checkout=success&returnTo=${encodeURIComponent(returnPath)}`

  if (!Number.isFinite(variantNumber)) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Lemon Squeezy variant IDs must be numeric.'
    })
  }

  const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          custom_price: pack.priceCents,
          product_options: {
            enabled_variants: [variantNumber],
            name: `${pack.label} for QR Codes On Labels`,
            redirect_url: redirectUrl
          },
          checkout_options: {
            discount: false
          },
          checkout_data: {
            email: session.user.email,
            custom: {
              credit_pack_id: pack.id,
              credits: String(pack.credits),
              user_id: session.user.id
            }
          },
          test_mode: config.testMode
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: config.storeId
            }
          },
          variant: {
            data: {
              type: 'variants',
              id: variantId
            }
          }
        }
      }
    }),
    headers: {
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/vnd.api+json'
    },
    method: 'POST'
  })

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Unable to create a Lemon Squeezy checkout.'
    })
  }

  const checkout = await response.json() as LemonSqueezyCheckoutResponse
  const checkoutUrl = checkout.data?.attributes?.url

  if (!checkoutUrl) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Lemon Squeezy did not return a checkout URL.'
    })
  }

  return {
    checkoutUrl
  }
})
