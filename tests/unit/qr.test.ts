import { describe, expect, test } from 'bun:test'
import { createQrCode, getMaxQrByteLength } from '../../app/utils/qr'

describe('QR encoder', () => {
  test('keeps generated matrices square and stable across correction levels', () => {
    const medium = createQrCode('https://example.com/qr-medium', { errorCorrectionLevel: 'medium' })
    const high = createQrCode('https://example.com/qr-high', { errorCorrectionLevel: 'high' })

    expect(medium.modules.length).toBe(medium.size)
    expect(medium.modules.every(row => row.length === medium.size)).toBe(true)
    expect(high.modules.length).toBe(high.size)
    expect(high.modules.every(row => row.length === high.size)).toBe(true)
    expect(high.errorCorrectionLevel).toBe('high')
  })

  test('enforces byte-length boundaries for configured versions', () => {
    const maxMediumLength = getMaxQrByteLength('medium')
    const maxHighLength = getMaxQrByteLength('high')

    expect(() => createQrCode('x'.repeat(maxMediumLength), { errorCorrectionLevel: 'medium' })).not.toThrow()
    expect(() => createQrCode('x'.repeat(maxMediumLength + 1), { errorCorrectionLevel: 'medium' })).toThrow('This QR generator supports URLs up to')
    expect(() => createQrCode('x'.repeat(maxHighLength), { errorCorrectionLevel: 'high' })).not.toThrow()
    expect(() => createQrCode('x'.repeat(maxHighLength + 1), { errorCorrectionLevel: 'high' })).toThrow('This QR generator supports URLs up to')
  })

  test('accounts for unicode byte length rather than string length', () => {
    const qr = createQrCode('https://example.com/cafe-\u2615', { errorCorrectionLevel: 'medium' })

    expect(qr.size).toBeGreaterThan(0)
  })
})
