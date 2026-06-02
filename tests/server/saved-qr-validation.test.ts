import { beforeAll, describe, expect, test } from 'bun:test'
import { createError } from 'h3'
import { normalizePreviewDimension, normalizePreviewSvg, normalizeSavedQrPayload } from '../../server/utils/saved-qr'

beforeAll(() => {
  Object.assign(globalThis, { createError })
})

describe('saved QR validation', () => {
  test('accepts a complete saved QR payload and strips empty dynamic links', () => {
    const payload = normalizeSavedQrPayload(createSavedQrPayload({
      dynamicLink: {
        destinationUrl: 'https://example.com',
        id: '',
        redirectUrl: 'https://qrcodesonlabels.com/r/example',
        slug: 'example',
        trackStatistics: true,
        useDynamicUrl: true
      }
    }))

    expect(payload.url).toBe('https://example.com/')
    expect(payload.dynamicLink).toBeUndefined()
  })

  test('rejects oversized labels and invalid logo data URLs', () => {
    expect(() => normalizeSavedQrPayload(createSavedQrPayload({
      label: 'x'.repeat(161)
    }))).toThrow('Label must be 160 characters or less.')

    expect(() => normalizeSavedQrPayload(createSavedQrPayload({
      labelLogo: {
        mimeType: 'image/png',
        name: 'Logo',
        naturalHeight: 100,
        naturalWidth: 100,
        position: 'top',
        src: 'data:text/plain;base64,Zm9v'
      }
    }))).toThrow('Label logo data URL is invalid.')

    expect(() => normalizeSavedQrPayload(createSavedQrPayload({
      rectangleLabelHorizontalPaddingStep: 9
    }))).toThrow('Horizontal label padding is invalid.')
  })

  test('validates preview SVG text and dimensions', () => {
    expect(normalizePreviewSvg('<svg viewBox="0 0 1 1"></svg>')).toContain('<svg')
    expect(normalizePreviewDimension(512, 'QR code preview width')).toBe(512)
    expect(() => normalizePreviewSvg('<script></script>')).toThrow('QR code preview must be an SVG.')
    expect(() => normalizePreviewDimension(Number.POSITIVE_INFINITY, 'QR code preview width')).toThrow('QR code preview width is invalid.')
  })
})

function createSavedQrPayload(overrides: Record<string, unknown> = {}) {
  return {
    additionalText: '',
    additionalTextFont: 'google-sans',
    additionalTextPlacement: 'below',
    additionalTextSizeStep: 0,
    border: 'none',
    centerIcon: 'none',
    circleLabels: {
      bottom: { font: 'google-sans', orientation: 'up', sizeStep: 0, text: '' },
      left: { font: 'google-sans', orientation: 'up', sizeStep: 0, text: '' },
      right: { font: 'google-sans', orientation: 'up', sizeStep: 0, text: '' },
      top: { font: 'google-sans', orientation: 'up', sizeStep: 0, text: '' }
    },
    colorName: null,
    colorStep: 500,
    gradientDirection: 'left-to-right',
    gradientSecondColorName: null,
    gradientSecondColorStep: 500,
    gradientStyle: 'none',
    gradientThirdColorName: null,
    gradientThirdColorStep: 500,
    label: '',
    labelBackgroundColorName: null,
    labelBackgroundColorStep: 500,
    labelFont: 'google-sans',
    labelLogo: null,
    labelPosition: 'top',
    labelSizeStep: 0,
    labelTextColorName: null,
    labelTextColorStep: 500,
    rectangleLabelHorizontalPaddingStep: 0,
    rectangleLabelVerticalPaddingStep: 0,
    shape: 'rectangle',
    url: 'https://example.com',
    version: 1,
    ...overrides
  }
}
