import { expect, type Page, test } from '@playwright/test'

test('uses the wide desktop workspace for editing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/wide-workspace')

  const metrics = await page.evaluate(() => {
    const page = document.querySelector('[data-testid="qr-builder-page"]') as HTMLElement | null
    const workspace = document.querySelector('[data-testid="qr-builder-workspace"]') as HTMLElement | null
    const controls = document.querySelector('[data-testid="qr-builder-controls"]') as HTMLElement | null
    const previewColumn = document.querySelector('[data-testid="qr-builder-preview-column"]') as HTMLElement | null
    const toolbar = document.querySelector('[aria-label="QR code tools"]') as HTMLElement | null
    const previewCard = document.querySelector('[data-testid="qr-preview-card"]') as HTMLElement | null

    if (!page || !workspace || !controls || !previewColumn || !toolbar || !previewCard) {
      throw new Error('Missing wide workspace elements.')
    }

    const pageBox = page.getBoundingClientRect()
    const controlsBox = controls.getBoundingClientRect()
    const previewBox = previewColumn.getBoundingClientRect()
    const toolbarBox = toolbar.getBoundingClientRect()
    const previewCardBox = previewCard.getBoundingClientRect()

    return {
      controlsRight: controlsBox.right,
      controlsTop: controlsBox.top,
      controlsWidth: controlsBox.width,
      pageWidth: pageBox.width,
      previewCardWidth: previewCardBox.width,
      previewLeft: previewBox.left,
      previewTop: previewBox.top,
      previewWidth: previewBox.width,
      toolbarWidth: toolbarBox.width,
      viewportWidth: window.innerWidth,
      workspaceDisplay: getComputedStyle(workspace).display
    }
  })

  expect(metrics.pageWidth).toBeGreaterThan(1100)
  expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewportWidth)
  expect(metrics.workspaceDisplay).toBe('grid')
  expect(metrics.controlsWidth).toBeGreaterThan(600)
  expect(metrics.previewWidth).toBeGreaterThan(350)
  expect(metrics.previewLeft).toBeGreaterThan(metrics.controlsRight)
  expect(metrics.previewTop).toBeCloseTo(metrics.controlsTop, 0)
  expect(metrics.toolbarWidth).toBeLessThanOrEqual(metrics.controlsWidth)
  expect(metrics.previewCardWidth).toBeLessThanOrEqual(metrics.previewWidth + 1)
})

test('wraps style selectors on desktop while preserving mobile scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/wrapping-selectors')

  await page.getByRole('button', { name: 'Colors' }).click()
  await expectDesktopWrappingSelector(page, 'qr-color-selector')

  await page.getByRole('button', { name: 'Icon' }).click()
  await expectDesktopWrappingSelector(page, 'center-icon-selector')

  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await expectDesktopWrappingSelector(page, 'border-style-selector')

  await page.setViewportSize({ width: 320, height: 720 })

  await page.getByRole('button', { name: 'Colors' }).click()
  await expectMobileScrollingSelector(page, 'qr-color-selector')

  await page.getByRole('button', { name: 'Icon' }).click()
  await expectMobileScrollingSelector(page, 'center-icon-selector')

  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await expectMobileScrollingSelector(page, 'border-style-selector')
})

test('draws circle borders with a buffered QR overlap', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
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

test('rounds the preview frame and background in circle mode', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/circle-frame')

  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await page.getByRole('radio', { name: 'Thin border' }).click()

  const rectangleFrame = await page.evaluate(getPreviewFrameState)

  expect(rectangleFrame.circleBackgroundCount).toBe(0)
  expect(rectangleFrame.rectangleBackgroundCount).toBe(1)
  expect(rectangleFrame.cardRadius).toBeLessThan(rectangleFrame.cardWidth / 4)

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()

  const circleFrame = await page.evaluate(getPreviewFrameState)

  expect(circleFrame.circleBackgroundCount).toBe(1)
  expect(circleFrame.rectangleBackgroundCount).toBe(0)
  expect(circleFrame.cardWidth).toBeCloseTo(circleFrame.cardHeight, 0)
  expect(circleFrame.cardRadius).toBeGreaterThan(circleFrame.cardWidth / 2)
  expect(circleFrame.surfaceRadius).toBeGreaterThan(circleFrame.surfaceWidth / 2)
  expect(circleFrame.boxShadow).toBe(rectangleFrame.boxShadow)
  expect(circleFrame.svgLeftInset).toBeCloseTo(rectangleFrame.svgLeftInset, 0)
  expect(circleFrame.svgRightInset).toBeCloseTo(rectangleFrame.svgRightInset, 0)
  expect(circleFrame.svgTopInset).toBeCloseTo(rectangleFrame.svgTopInset, 0)
  expect(circleFrame.svgBottomInset).toBeCloseTo(rectangleFrame.svgBottomInset, 0)
  expect(circleFrame.viewBoxWidth).toBeCloseTo(circleFrame.viewBoxHeight, 4)
  expect(circleFrame.circleBackgroundRadius * 2).toBeCloseTo(circleFrame.viewBoxWidth, 4)
  expect(circleFrame.qrCornerDistance).toBeLessThanOrEqual(circleFrame.circleBackgroundRadius + 0.01)
})

test('moves top and bottom label text when switching shapes', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/shape-label-transfer')

  await page.getByRole('button', { name: 'Label', exact: true }).click()
  await page.locator('input[placeholder="Add a word"]').fill('Rectangle label')
  await page.locator('#qr-additional-text').fill('Rectangle additional')

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()
  await page.getByRole('button', { name: 'Label', exact: true }).click()

  await expect(page.locator('input[placeholder="Top text"]')).toHaveValue('Rectangle label')
  await expect(page.locator('input[placeholder="Bottom text"]')).toHaveValue('Rectangle additional')
  await expect(page.locator('input[placeholder="Left text"]')).toHaveValue('')
  await expect(page.locator('input[placeholder="Right text"]')).toHaveValue('')

  await page.locator('input[placeholder="Top text"]').fill('Circle top')
  await page.locator('input[placeholder="Bottom text"]').fill('Circle bottom')
  await page.locator('input[placeholder="Left text"]').fill('Discard left')
  await page.locator('input[placeholder="Right text"]').fill('Discard right')

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Rectangle/Square' }).click()
  await page.getByRole('button', { name: 'Label', exact: true }).click()

  await expect(page.locator('input[placeholder="Add a word"]')).toHaveValue('Circle top')
  await expect(page.locator('#qr-additional-text')).toHaveValue('Circle bottom')

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()
  await page.getByRole('button', { name: 'Label', exact: true }).click()

  await expect(page.locator('input[placeholder="Top text"]')).toHaveValue('Circle top')
  await expect(page.locator('input[placeholder="Bottom text"]')).toHaveValue('Circle bottom')
  await expect(page.locator('input[placeholder="Left text"]')).toHaveValue('')
  await expect(page.locator('input[placeholder="Right text"]')).toHaveValue('')
})

test('renders circle label text on curved paths', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
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

async function expectDesktopWrappingSelector(page: Page, testId: string) {
  const metrics = await getSelectorLayoutMetrics(page, testId)

  expect(metrics.flexWrap).toBe('wrap')
  expect(metrics.overflowX).toBe('visible')
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
}

async function expectMobileScrollingSelector(page: Page, testId: string) {
  const metrics = await getSelectorLayoutMetrics(page, testId)

  expect(metrics.flexWrap).toBe('nowrap')
  expect(metrics.overflowX).toBe('auto')
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
}

async function getSelectorLayoutMetrics(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((element) => {
    const style = getComputedStyle(element)

    return {
      clientWidth: element.clientWidth,
      flexWrap: style.flexWrap,
      overflowX: style.overflowX,
      scrollWidth: element.scrollWidth
    }
  })
}

function getPreviewFrameState() {
  const getPixelValue = (value: string) => Number(value.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i)?.[0] ?? 0)
  const card = document.querySelector('[data-testid="qr-preview-card"]') as HTMLElement | null
  const surface = document.querySelector('[data-testid="qr-preview-surface"]') as HTMLElement | null
  const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
  const qrSvg = svg?.querySelector('g[shape-rendering="crispEdges"] svg') as SVGSVGElement | null
  const circleBackground = svg?.querySelector('[data-testid="qr-circle-background"]') as SVGCircleElement | null

  if (!card || !surface || !svg || !qrSvg) {
    throw new Error('Missing preview frame elements.')
  }

  const cardBox = card.getBoundingClientRect()
  const surfaceBox = surface.getBoundingClientRect()
  const svgBox = svg.getBoundingClientRect()
  const cardStyle = getComputedStyle(card)
  const surfaceStyle = getComputedStyle(surface)
  const viewBox = svg.viewBox.baseVal
  const qrSize = Number(qrSvg.getAttribute('width'))

  return {
    boxShadow: cardStyle.boxShadow,
    cardHeight: cardBox.height,
    cardRadius: getPixelValue(cardStyle.borderTopLeftRadius),
    cardWidth: cardBox.width,
    circleBackgroundCount: svg.querySelectorAll('[data-testid="qr-circle-background"]').length,
    circleBackgroundRadius: Number(circleBackground?.getAttribute('r') ?? 0),
    qrCornerDistance: Math.hypot(qrSize / 2, qrSize / 2),
    rectangleBackgroundCount: svg.querySelectorAll('[data-testid="qr-rectangle-background"]').length,
    surfaceRadius: getPixelValue(surfaceStyle.borderTopLeftRadius),
    surfaceWidth: surfaceBox.width,
    svgBottomInset: cardBox.bottom - svgBox.bottom,
    svgLeftInset: svgBox.left - cardBox.left,
    svgRightInset: cardBox.right - svgBox.right,
    svgTopInset: svgBox.top - cardBox.top,
    viewBoxHeight: viewBox.height,
    viewBoxWidth: viewBox.width
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
