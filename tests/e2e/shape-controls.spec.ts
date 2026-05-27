import { expect, test } from '@playwright/test'

test('draws circle borders with a buffered QR overlap', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com/circle-shape')

  const toolbar = page.getByRole('toolbar', { name: 'QR code tools' })

  await expect(toolbar.locator('button').first()).toHaveText('Shape')

  await page.getByRole('button', { name: 'Shape' }).click()
  await expect(page.getByRole('radio', { name: 'Rectangle/Square' })).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('radio', { name: 'Circle' }).click()
  await page.getByRole('button', { name: 'Border', exact: true }).click()

  await expect(page.getByRole('radio', { name: 'Thin border' }).locator('path')).toHaveAttribute('d', /A/)

  await page.getByRole('radio', { name: 'Thin border' }).click()
  await expect(page.getByTestId('qr-circle-border-0.5')).toBeVisible()
  await expect(page.getByTestId('qr-circle-border-buffer')).toBeVisible()

  const metrics = await page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
    const qrSvg = svg?.querySelector('g[shape-rendering="crispEdges"] svg') as SVGSVGElement | null
    const circle = svg?.querySelector('[data-testid="qr-circle-border-0.5"]') as SVGCircleElement | null
    const buffer = svg?.querySelector('[data-testid="qr-circle-border-buffer"]') as SVGRectElement | null

    if (!svg || !qrSvg || !circle || !buffer) {
      throw new Error('Missing generated circle border elements.')
    }

    const qrX = Number(qrSvg.getAttribute('x'))
    const qrY = Number(qrSvg.getAttribute('y'))
    const qrSize = Number(qrSvg.getAttribute('width'))

    return {
      bufferAmount: qrX - Number(buffer.getAttribute('x')),
      bufferHeight: Number(buffer.getAttribute('height')),
      bufferWidth: Number(buffer.getAttribute('width')),
      bufferX: Number(buffer.getAttribute('x')),
      bufferY: Number(buffer.getAttribute('y')),
      cornerDistance: Math.hypot(qrSize / 2, qrSize / 2),
      expectedBufferAmount: Math.max(0.33, qrSize * 0.012),
      qrSize,
      qrX,
      qrY,
      radius: Number(circle.getAttribute('r')),
      rectangleBorderCount: svg.querySelectorAll('[data-testid^="qr-rectangle-border-"]').length,
      strokeWidth: Number(circle.getAttribute('stroke-width'))
    }
  })

  expect(metrics.rectangleBorderCount).toBe(0)
  expect(metrics.radius).toBeGreaterThan(metrics.qrSize / 2)
  expect(metrics.radius + metrics.strokeWidth / 2).toBeCloseTo(metrics.cornerDistance, 4)
  expect(metrics.bufferAmount).toBeCloseTo(metrics.expectedBufferAmount, 4)
  expect(metrics.bufferX).toBeLessThan(metrics.qrX)
  expect(metrics.bufferY).toBeLessThan(metrics.qrY)
  expect(metrics.bufferWidth).toBeGreaterThan(metrics.qrSize)
  expect(metrics.bufferHeight).toBeGreaterThan(metrics.qrSize)
})

test('renders circle label text on curved paths', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '_value' in document.querySelector('input[type="url"]'))
  await page.locator('input[type="url"]').fill('https://example.com/circle-labels')

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()
  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await page.getByRole('radio', { name: 'Thin border' }).click()
  await page.getByRole('button', { name: 'Label', exact: true }).click()

  await expect(page.getByRole('radiogroup', { name: 'Label position' })).toHaveCount(0)

  await page.locator('input[placeholder="Top text"]').fill('Sample top text')
  await page.locator('input[placeholder="Bottom text"]').fill('Sample bottom text')
  await page.locator('input[placeholder="Left text"]').fill('Sample left text')
  await page.locator('input[placeholder="Right text"]').fill('Sample right text')

  const defaultDirections = [
    { direction: 'up', label: 'Top', placement: 'top' },
    { direction: 'down', label: 'Bottom', placement: 'bottom' },
    { direction: 'up', label: 'Left', placement: 'left' },
    { direction: 'down', label: 'Right', placement: 'right' }
  ]

  for (const control of defaultDirections) {
    await expect(page.getByRole('button', { exact: true, name: `Flip ${control.label} circle label text. Current direction ${control.direction}` })).toBeVisible()
  }

  await expect(page.getByRole('button', { name: 'Increase top circle label size' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Decrease top circle label size' })).toBeEnabled()
  await page.getByRole('button', { name: 'Increase top circle label size' }).click()

  const metrics = await page.evaluate(getCircleLabelRenderState)

  expect(metrics.bufferAmount).toBeLessThan(0)
  expect(metrics.labelCount).toBe(4)

  for (const label of metrics.labels) {
    expect(label.d).toContain('A')
    expect(label.href).toBe(`#circle-label-${label.placement}-path`)
    expect(label.fontSize).toBeGreaterThan(0)
    expect(label.width).toBeGreaterThan(0)
  }

  for (const control of defaultDirections) {
    await page.getByRole('button', { exact: true, name: `Flip ${control.label} circle label text. Current direction ${control.direction}` }).click()
    await expect(page.getByRole('button', { exact: true, name: `Flip ${control.label} circle label text. Current direction ${control.direction === 'up' ? 'down' : 'up'}` })).toBeVisible()
  }

  const flippedMetrics = await page.evaluate(getCircleLabelRenderState)

  for (const control of defaultDirections) {
    const before = metrics.labels.find(label => label.placement === control.placement)
    const after = flippedMetrics.labels.find(label => label.placement === control.placement)

    expect(before).toBeDefined()
    expect(after).toBeDefined()
    expect(after!.d).not.toBe(before!.d)
    expect(after!.side).not.toBe(before!.side)
    expect(after!.text).toBe(before!.text)

    const beforeArc = parseCircleLabelPath(before!.d)
    const afterArc = parseCircleLabelPath(after!.d)

    expect(afterArc.startX).toBeCloseTo(beforeArc.endX, 4)
    expect(afterArc.startY).toBeCloseTo(beforeArc.endY, 4)
    expect(afterArc.endX).toBeCloseTo(beforeArc.startX, 4)
    expect(afterArc.endY).toBeCloseTo(beforeArc.startY, 4)
    expect(afterArc.radiusX).toBeCloseTo(beforeArc.radiusX, 4)
    expect(afterArc.radiusY).toBeCloseTo(beforeArc.radiusY, 4)
    expect(afterArc.sweep).toBe(beforeArc.sweep === 1 ? 0 : 1)
  }
})

function parseCircleLabelPath(d: string) {
  const match = d.match(/^M([-+\d.eE]+) ([-+\d.eE]+)A([-+\d.eE]+) ([-+\d.eE]+) 0 0 ([01]) ([-+\d.eE]+) ([-+\d.eE]+)$/)

  if (!match) {
    throw new Error(`Unexpected circle label path: ${d}`)
  }

  return {
    endX: Number(match[6]),
    endY: Number(match[7]),
    radiusX: Number(match[3]),
    radiusY: Number(match[4]),
    startX: Number(match[1]),
    startY: Number(match[2]),
    sweep: Number(match[5])
  }
}

function getCircleLabelRenderState() {
  const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
  const qrSvg = svg?.querySelector('g[shape-rendering="crispEdges"] svg') as SVGSVGElement | null
  const circle = svg?.querySelector('[data-testid="qr-circle-border-0.5"]') as SVGCircleElement | null
  const buffer = svg?.querySelector('[data-testid="qr-circle-border-buffer"]') as SVGRectElement | null

  if (!svg || !qrSvg || !circle || !buffer) {
    throw new Error('Missing generated circle label elements.')
  }

  const labels = ['top', 'bottom', 'left', 'right'].map((placement) => {
    const text = svg.querySelector(`[data-testid="qr-circle-label-${placement}"]`) as SVGTextElement | null
    const textPath = text?.querySelector('textPath')
    const href = textPath?.getAttribute('href') ?? ''
    const path = href ? svg.querySelector(href) as SVGPathElement | null : null
    const radius = Number(path?.getAttribute('d')?.match(/A([0-9.]+) /)?.[1])

    if (!text || !textPath || !path || !Number.isFinite(radius)) {
      throw new Error(`Missing curved ${placement} label.`)
    }

    return {
      d: path.getAttribute('d') ?? '',
      fontSize: Number(text.getAttribute('font-size')),
      href,
      placement,
      side: textPath.getAttribute('side') ?? '',
      text: text.textContent?.trim() ?? '',
      width: text.getComputedTextLength()
    }
  })

  return {
    bufferAmount: Number(buffer.getAttribute('x')) - Number(qrSvg.getAttribute('x')),
    labelCount: labels.length,
    labels,
    qrHalfSize: Number(qrSvg.getAttribute('width')) / 2,
    radius: Number(circle.getAttribute('r')),
    strokeWidth: Number(circle.getAttribute('stroke-width'))
  }
}
