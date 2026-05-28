export type CreditPackId = 'credits-1' | 'credits-5' | 'credits-10' | 'credits-100' | 'credits-1000'

export type CreditPack = {
  id: CreditPackId
  credits: number
  label: string
  priceCents: number
  priceLabel: string
}

export type CreditTransaction = {
  id: string
  type: 'credit_purchase' | 'pdf_purchase' | 'qr_feature_purchase'
  credits: number
  balanceAfter: number
  description: string
  lemonSqueezyOrderId: string | null
  lemonSqueezyVariantId: string | null
  pdfPurchaseId: string | null
  createdAt: string
}

export type PurchasedPdf = {
  id: string
  templateId: string
  templateLabel: string
  qrTitle: string
  sizeBytes: number
  downloadUrl: string
  createdAt: string
}

export type CreditsSummary = {
  balance: number
  packs: CreditPack[]
  pdfs: PurchasedPdf[]
  transactions: CreditTransaction[]
}

export const creditPacks: CreditPack[] = [{
  id: 'credits-1',
  credits: 1,
  label: '1 credit',
  priceCents: 200,
  priceLabel: '$2'
}, {
  id: 'credits-5',
  credits: 5,
  label: '5 credits',
  priceCents: 500,
  priceLabel: '$5'
}, {
  id: 'credits-10',
  credits: 10,
  label: '10 credits',
  priceCents: 800,
  priceLabel: '$8'
}, {
  id: 'credits-100',
  credits: 100,
  label: '100 credits',
  priceCents: 5000,
  priceLabel: '$50'
}, {
  id: 'credits-1000',
  credits: 1000,
  label: '1,000 credits',
  priceCents: 10000,
  priceLabel: '$100'
}]
