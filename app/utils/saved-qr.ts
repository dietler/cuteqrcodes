import type { DynamicQrLinkPayload } from './dynamic-qr'

export type CircleLabelPlacement = 'top' | 'bottom' | 'left' | 'right'
export type CircleLabelOrientation = 'up' | 'down'
export type LabelLogoPosition = 'top' | 'bottom'
export type SavedQrStatus = 'draft' | 'purchased'

export type CircleLabelPayload = {
  text: string
  font: string
  sizeStep: number
  orientation?: CircleLabelOrientation
}

export type LabelLogoPayload = {
  src: string
  name: string
  mimeType: string
  naturalWidth: number
  naturalHeight: number
  position: LabelLogoPosition
  sizeStep?: number
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
  gradientSecondColorStep?: number
  gradientThirdColorName?: string | null
  gradientThirdColorStep?: number
  labelBackgroundColorName?: string | null
  labelBackgroundColorStep?: number
  labelLogo?: LabelLogoPayload | null
  labelTextColorName?: string | null
  labelTextColorStep?: number
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
