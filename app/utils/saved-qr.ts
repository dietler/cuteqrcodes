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
}

export type SavedQrFolder = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type SavedQrCode = {
  id: string
  folderId: string
  name: string
  payload: SavedQrPayload
  previewSvg: string
  previewWidth: number
  previewHeight: number
  createdAt: string
  updatedAt: string
}

export type SavedQrFolderWithCodes = SavedQrFolder & {
  qrCodes: SavedQrCode[]
}

export const editQrPayloadStorageKey = 'cuteqrcodes.editQrPayload'
