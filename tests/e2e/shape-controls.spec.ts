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

test('draws wavy borders in rectangle and circle mode', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/wavy-border')

  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Wavy border' })).toBeVisible()
  await page.getByRole('radio', { name: 'Wavy border' }).click()

  const rectanglePreviewState = await getWavyBorderPreviewState(page)

  expect(rectanglePreviewState).toEqual(expect.objectContaining({
    arcCommandCount: 0,
    isClosed: false
  }))
  expect(rectanglePreviewState.firstPoint.x).toBeLessThan(8)
  expect(rectanglePreviewState.firstPoint.y).toBeGreaterThan(20)
  expect(rectanglePreviewState.lastPoint.x).toBeGreaterThan(20)
  expect(rectanglePreviewState.lastPoint.y).toBeLessThan(8)
  expect(rectanglePreviewState.pathCommands).toBeGreaterThan(20)
  expect(rectanglePreviewState.pathCommands).toBeLessThan(90)

  const rectangleState = await getWavyRectangleBorderState(page)

  expect(rectangleState).toEqual(expect.objectContaining({
    arcCommandCount: 0,
    circleBorderCount: 0,
    rectBorderCount: 0,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    strokeWidth: 0.5,
    tagName: 'path'
  }))
  expect(rectangleState.cornerPointCounts.every(count => count > 8)).toBe(true)
  expect(rectangleState.pathCommands).toBeGreaterThan(80)

  await page.getByRole('button', { name: 'Label', exact: true }).click()
  await page.getByRole('textbox', { name: 'Label' }).fill('Welcome to')

  const labeledRectangleState = await getWavyRectangleBorderState(page)

  expect(labeledRectangleState.arcCommandCount).toBe(0)
  expect(labeledRectangleState.cornerPointCounts.every(count => count > 8)).toBe(true)
  expect(labeledRectangleState.viewBoxHeight).toBeGreaterThan(rectangleState.viewBoxHeight)

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()

  const circleState = await page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
    const border = svg?.querySelector('[data-testid="qr-circle-border-0.75"]') as SVGPathElement | null
    const buffer = svg?.querySelector('[data-testid="qr-circle-border-buffer"]') as SVGRectElement | null

    if (!svg || !border || !buffer) {
      throw new Error('Missing generated circle wavy border.')
    }

    return {
      circleElementBorderCount: svg.querySelectorAll('circle[data-testid^="qr-circle-border-"]').length,
      pathCommands: border.getAttribute('d')?.match(/L/g)?.length ?? 0,
      rectangleBorderCount: svg.querySelectorAll('[data-testid^="qr-rectangle-border-"]').length,
      strokeLineCap: border.getAttribute('stroke-linecap'),
      strokeLineJoin: border.getAttribute('stroke-linejoin'),
      strokeWidth: Number(border.getAttribute('stroke-width')),
      tagName: border.tagName.toLowerCase()
    }
  })

  expect(circleState).toEqual(expect.objectContaining({
    circleElementBorderCount: 0,
    rectangleBorderCount: 0,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    strokeWidth: 0.5,
    tagName: 'path'
  }))
  expect(circleState.pathCommands).toBeGreaterThan(40)

  await page.getByRole('button', { name: 'Border', exact: true }).click()

  const circlePreviewState = await getWavyBorderPreviewState(page)

  expect(circlePreviewState).toEqual(expect.objectContaining({
    arcCommandCount: 0,
    isClosed: false
  }))
  expect(circlePreviewState.firstPoint.x).toBeLessThan(8)
  expect(circlePreviewState.firstPoint.y).toBeGreaterThan(20)
  expect(circlePreviewState.lastPoint.x).toBeGreaterThan(20)
  expect(circlePreviewState.lastPoint.y).toBeLessThan(8)
  expect(circlePreviewState.pathCommands).toBeGreaterThan(20)
  expect(circlePreviewState.pathCommands).toBeLessThan(90)
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
  await page.getByRole('textbox', { name: 'Label' }).fill('Rectangle label')
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

  await expect(page.getByRole('textbox', { name: 'Label' })).toHaveValue('Circle top')
  await expect(page.locator('#qr-additional-text')).toHaveValue('Circle bottom')

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()
  await page.getByRole('button', { name: 'Label', exact: true }).click()

  await expect(page.locator('input[placeholder="Top text"]')).toHaveValue('Circle top')
  await expect(page.locator('input[placeholder="Bottom text"]')).toHaveValue('Circle bottom')
  await expect(page.locator('input[placeholder="Left text"]')).toHaveValue('')
  await expect(page.locator('input[placeholder="Right text"]')).toHaveValue('')
})

test('evens stacked rectangle label spacing above and below the QR code', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/even-label-spacing')

  await page.getByRole('button', { name: 'Label', exact: true }).click()
  await page.getByRole('textbox', { name: 'Label' }).fill('WINGEN')
  await page.locator('#qr-additional-text').fill('Bakery & Restaurant')
  await expect(page.getByRole('img', { name: 'Generated QR code' })).toBeVisible()

  let spacing = await getStackedRectangleLabelSpacing(page)

  expect(spacing.above).toBeCloseTo(spacing.between, 4)
  expect(spacing.between).toBeCloseTo(spacing.below, 4)

  await page.getByRole('radio', { name: 'Bottom' }).click()
  spacing = await getStackedRectangleLabelSpacing(page)

  expect(spacing.above).toBeCloseTo(spacing.between, 4)
  expect(spacing.between).toBeCloseTo(spacing.below, 4)
})

test('uses sectioned mobile label controls for rectangle and circle labels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/mobile-label-controls')

  await page.getByRole('button', { name: 'Label', exact: true }).click()

  const rectangleMobileControls = page.getByTestId('rectangle-label-mobile-controls')

  await expect(rectangleMobileControls).toBeVisible()
  await expect(rectangleMobileControls.getByText('Flip', { exact: true })).toHaveCount(0)

  const mobileRectangleOrder = await getSectionTopPositions(page, [
    'rectangle-label-position-controls',
    'rectangle-label-mobile-section-label',
    'rectangle-label-mobile-section-additional'
  ])

  expect(mobileRectangleOrder['rectangle-label-position-controls']).toBeLessThan(mobileRectangleOrder['rectangle-label-mobile-section-label'])
  expect(mobileRectangleOrder['rectangle-label-mobile-section-label']).toBeLessThan(mobileRectangleOrder['rectangle-label-mobile-section-additional'])

  const rectangleLayout = await rectangleMobileControls.evaluate((element) => {
    const containerBox = element.getBoundingClientRect()
    const labelInput = element.querySelector('input[placeholder="Add a word"]') as HTMLInputElement | null
    const additionalInput = element.querySelector('input[placeholder="Add smaller text"]') as HTMLInputElement | null

    if (!labelInput || !additionalInput) {
      throw new Error('Missing mobile rectangle label inputs.')
    }

    return {
      additionalInputWidth: additionalInput.getBoundingClientRect().width,
      containerWidth: containerBox.width,
      labelInputWidth: labelInput.getBoundingClientRect().width
    }
  })

  expect(rectangleLayout.labelInputWidth).toBeGreaterThan(rectangleLayout.containerWidth * 0.9)
  expect(rectangleLayout.additionalInputWidth).toBeGreaterThan(rectangleLayout.containerWidth * 0.9)
  const rectangleSectionStates = await getSectionBoxStates(page, [
    'rectangle-label-mobile-section-label',
    'rectangle-label-mobile-section-additional'
  ])

  for (const state of Object.values(rectangleSectionStates)) {
    expect(state.borderTopWidth).toBeGreaterThanOrEqual(1)
    expect(state.fontSize).toBeGreaterThan(14)
    expect(state.fontWeight).toBe(700)
    expect(state.paddingTop).toBeGreaterThanOrEqual(12)
    expect(state.textDecorationLine).toBe('none')
  }

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()
  await page.getByRole('button', { name: 'Label', exact: true }).click()

  await expect(page.getByTestId('circle-label-controls')).toBeVisible()
  const circleSectionStates = await getSectionBoxStates(page, [
    'circle-label-mobile-section-top',
    'circle-label-mobile-section-bottom',
    'circle-label-mobile-section-left',
    'circle-label-mobile-section-right'
  ])

  for (const state of Object.values(circleSectionStates)) {
    expect(state.borderTopWidth).toBeGreaterThanOrEqual(1)
    expect(state.fontSize).toBeGreaterThan(14)
    expect(state.fontWeight).toBe(700)
    expect(state.paddingTop).toBeGreaterThanOrEqual(12)
    expect(state.textDecorationLine).toBe('none')
  }

  await page.setViewportSize({ width: 900, height: 844 })

  const desktopCircleSectionState = await getSectionBoxStates(page, ['circle-label-mobile-section-top'])

  expect(desktopCircleSectionState['circle-label-mobile-section-top'].borderTopWidth).toBe(0)
  expect(desktopCircleSectionState['circle-label-mobile-section-top'].fontSize).toBeLessThanOrEqual(14)
  expect(desktopCircleSectionState['circle-label-mobile-section-top'].paddingTop).toBe(0)

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Rectangle/Square' }).click()
  await page.getByRole('button', { name: 'Label', exact: true }).click()

  await expect(page.getByTestId('rectangle-label-mobile-controls')).toBeHidden()

  const desktopRectangleOrder = await getSectionTopPositions(page, [
    'rectangle-label-position-controls',
    'rectangle-label-desktop-primary-controls',
    'rectangle-label-desktop-additional-controls'
  ])

  expect(desktopRectangleOrder['rectangle-label-position-controls']).toBeLessThan(desktopRectangleOrder['rectangle-label-desktop-primary-controls'])
  expect(desktopRectangleOrder['rectangle-label-desktop-primary-controls']).toBeLessThan(desktopRectangleOrder['rectangle-label-desktop-additional-controls'])
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

async function getSectionBoxStates(page: Page, testIds: string[]) {
  return page.evaluate((ids) => {
    return Object.fromEntries(ids.map((testId) => {
      const element = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null
      const label = element?.querySelector('label') as HTMLLabelElement | null

      if (!element || !label) {
        throw new Error(`Missing label section: ${testId}`)
      }

      const elementStyle = getComputedStyle(element)
      const labelStyle = getComputedStyle(label)

      return [
        testId,
        {
          borderTopWidth: Number.parseFloat(elementStyle.borderTopWidth),
          fontSize: Number.parseFloat(labelStyle.fontSize),
          fontWeight: Number(labelStyle.fontWeight),
          paddingTop: Number.parseFloat(elementStyle.paddingTop),
          textDecorationLine: labelStyle.textDecorationLine
        }
      ]
    }))
  }, testIds)
}

async function getWavyBorderPreviewState(page: Page) {
  return getBorderPreviewState(page, 'Wavy border')
}

async function getBorderPreviewState(page: Page, label: string) {
  return page.evaluate((borderLabel) => {
    const button = Array.from(document.querySelectorAll('[role="radio"]'))
      .find(element => element.getAttribute('aria-label') === borderLabel) as HTMLElement | undefined
    const paths = Array.from(button?.querySelectorAll('path') ?? []) as SVGPathElement[]
    const path = paths[0]

    if (!button || !path) {
      throw new Error(`Missing ${borderLabel} preview path.`)
    }

    const d = path.getAttribute('d') ?? ''
    const points = Array.from(d.matchAll(/[ML]([-+]?\d*\.?\d+) ([-+]?\d*\.?\d+)/g))
      .map(match => ({ x: Number(match[1]), y: Number(match[2]) }))

    if (!points.length) {
      throw new Error(`Missing wavy border preview points: ${d}`)
    }

    return {
      arcCommandCount: d.match(/A/g)?.length ?? 0,
      firstPoint: points[0],
      isClosed: d.endsWith('Z'),
      lastPoint: points[points.length - 1],
      pathCommands: d.match(/[LCQ]/g)?.length ?? 0,
      pathCount: paths.length
    }
  }, label)
}

async function getWavyRectangleBorderState(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
    const border = svg?.querySelector('[data-testid="qr-rectangle-border-0.75"]') as SVGPathElement | null

    if (!svg || !border) {
      throw new Error('Missing generated rectangle wavy border.')
    }

    const d = border.getAttribute('d') ?? ''
    const points = Array.from(d.matchAll(/[ML]([-+]?\d*\.?\d+) ([-+]?\d*\.?\d+)/g))
      .map(match => ({ x: Number(match[1]), y: Number(match[2]) }))
    const minX = Math.min(...points.map(point => point.x))
    const maxX = Math.max(...points.map(point => point.x))
    const minY = Math.min(...points.map(point => point.y))
    const maxY = Math.max(...points.map(point => point.y))
    const cornerWindow = 4
    const cornerPointCounts = [
      points.filter(point => point.x <= minX + cornerWindow && point.y <= minY + cornerWindow).length,
      points.filter(point => point.x >= maxX - cornerWindow && point.y <= minY + cornerWindow).length,
      points.filter(point => point.x >= maxX - cornerWindow && point.y >= maxY - cornerWindow).length,
      points.filter(point => point.x <= minX + cornerWindow && point.y >= maxY - cornerWindow).length
    ]

    return {
      arcCommandCount: d.match(/A/g)?.length ?? 0,
      circleBorderCount: svg.querySelectorAll('[data-testid^="qr-circle-border-"]').length,
      cornerPointCounts,
      pathCommands: d.match(/L/g)?.length ?? 0,
      rectBorderCount: svg.querySelectorAll('rect[data-testid^="qr-rectangle-border-"]').length,
      strokeLineCap: border.getAttribute('stroke-linecap'),
      strokeLineJoin: border.getAttribute('stroke-linejoin'),
      strokeWidth: Number(border.getAttribute('stroke-width')),
      tagName: border.tagName.toLowerCase(),
      viewBoxHeight: svg.viewBox.baseVal.height,
      viewBoxWidth: svg.viewBox.baseVal.width
    }
  })
}

async function getSectionTopPositions(page: Page, testIds: string[]) {
  return page.evaluate((ids) => {
    return Object.fromEntries(ids.map((testId) => {
      const element = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null

      if (!element) {
        throw new Error(`Missing section: ${testId}`)
      }

      return [testId, element.getBoundingClientRect().top]
    }))
  }, testIds)
}

async function getStackedRectangleLabelSpacing(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
    const qrSvg = svg?.querySelector('g[shape-rendering="crispEdges"] svg') as SVGSVGElement | null
    const renderedTexts = Array.from(svg?.querySelectorAll('text') ?? [])
      .filter(element => element.getAttribute('opacity') !== '0')
    const label = renderedTexts.find(element => element.textContent?.trim() === 'WINGEN')
    const additional = renderedTexts.find(element => element.textContent?.trim() === 'Bakery & Restaurant')

    if (!svg || !qrSvg || !label || !additional) {
      throw new Error('Missing stacked rectangle label elements.')
    }

    const labelY = Number(label.getAttribute('y'))
    const labelFontSize = Number(label.getAttribute('font-size'))
    const additionalY = Number(additional.getAttribute('y'))
    const additionalFontSize = Number(additional.getAttribute('font-size'))
    const qrY = Number(qrSvg.getAttribute('y'))
    const qrHeight = Number(qrSvg.getAttribute('height'))
    const labelTop = labelY - labelFontSize / 2
    const labelBottom = labelY + labelFontSize / 2
    const additionalTop = additionalY - additionalFontSize / 2
    const additionalBottom = additionalY + additionalFontSize / 2
    const qrBottom = qrY + qrHeight

    if (qrY > additionalBottom) {
      return {
        above: labelTop,
        below: qrY - additionalBottom,
        between: additionalTop - labelBottom
      }
    }

    return {
      above: labelTop - qrBottom,
      below: svg.viewBox.baseVal.height - additionalBottom,
      between: additionalTop - labelBottom
    }
  })
}

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
