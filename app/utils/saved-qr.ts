import type { DynamicQrLinkPayload } from './dynamic-qr'

export type CircleLabelPlacement = 'top' | 'bottom' | 'left' | 'right'
export type CircleLabelOrientation = 'up' | 'down'
export type SavedQrStatus = 'draft' | 'purchased'

export type CircleLabelPayload = {
  text: string
  font: string
  sizeStep: number
  orientation?: CircleLabelOrientation
}

export type SavedQrPayload = {
  version: 1
  url: string
  colorName: string | null
  colorStep: number
  label: string
  additionalText: string
  additionalTextPlacement: 'above' | 'below'
  labelPosition: 'top' | 'left' | 'right' | 'bottom'
  labelFont: string
  additionalTextFont: string
  labelSizeStep: number
  additionalTextSizeStep: number
  centerIcon: string
  border: string
  shape?: 'rectangle' | 'circle'
  circleLabels?: Record<CircleLabelPlacement, CircleLabelPayload>
  gradientStyle?: 'none' | 'directional' | 'radial'
  gradientDirection?: 'left-to-right' | 'top-to-bottom' | 'diagonal'
  gradientSecondColorName?: string | null
  gradientThirdColorName?: string | null
  dynamicLink?: DynamicQrLinkPayload
}

export type SavedQrCode = {
  id: string
  name: string
  payload: SavedQrPayload
  pdfPurchaseId: string | null
  previewSvg: string
  previewWidth: number
  previewHeight: number
  status: SavedQrStatus
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type SavedQrSummary = {
  qrCodes: SavedQrCode[]
  tags: string[]
}

export const currentQrDraftStorageKey = 'cuteqrcodes.currentQrDraft'
export const editQrPayloadStorageKey = 'cuteqrcodes.editQrPayload'
