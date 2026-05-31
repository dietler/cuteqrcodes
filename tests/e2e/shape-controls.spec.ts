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
  await expect(page.getByTestId('border-style-selector').locator('[role="radio"]')).toHaveCount(8)
  expect(await page.getByTestId('border-style-selector').locator('[role="radio"]').evaluateAll(buttons =>
    buttons.map(button => button.getAttribute('aria-label'))
  )).toEqual(['None', 'Small', 'Medium', 'Large', 'Double', 'Wavy', 'Fade', 'QR Fade'])
  expect(await page.getByTestId('border-style-selector').locator('[role="radio"]').evaluateAll(buttons =>
    buttons.map(button => button.textContent?.trim())
  )).toEqual(['None', 'Small', 'Medium', 'Large', 'Double', 'Wavy', 'Fade', 'QR Fade'])
  expect(await page.getByTestId('border-style-selector').locator('[role="radio"]').evaluateAll(buttons =>
    buttons.map(button => button.querySelector(':scope > span')?.className ?? '')
  )).toEqual(Array.from({ length: 8 }, () => 'grid size-10 place-items-center'))

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()
  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await expect(page.getByTestId('border-style-selector').locator('[role="radio"]')).toHaveCount(6)
  expect(await page.getByTestId('border-style-selector').locator('[role="radio"]').evaluateAll(buttons =>
    buttons.map(button => button.textContent?.trim())
  )).toEqual(['None', 'Small', 'Medium', 'Large', 'Double', 'Wavy'])

  await page.setViewportSize({ width: 320, height: 720 })

  await page.getByRole('button', { name: 'Colors' }).click()
  await expectMobileScrollingSelector(page, 'qr-color-selector')

  await page.getByRole('button', { name: 'Icon' }).click()
  await expectMobileScrollingSelector(page, 'center-icon-selector')

  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await expectMobileScrollingSelector(page, 'border-style-selector')
})

test('colors the QR code step slider with the selected shade', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/qr-step-slider-color')

  await page.getByRole('button', { name: 'Colors' }).click()
  await page
    .getByTestId('qr-color-selector')
    .getByRole('button', { name: 'Use Emerald for the QR code' })
    .click()

  await expect(page.getByRole('button', { name: 'Steps' })).toHaveCount(0)
  await expect(page.getByTestId('qr-color-step-control')).toContainText('Emerald 500')
  await expectStepSliderColor(page, 'qr-color-step-slider', 'var(--color-emerald-500)')

  await page.getByTestId('qr-color-step-control').getByRole('slider').press('ArrowRight')
  await page.getByTestId('qr-color-step-control').getByRole('slider').press('ArrowRight')

  await expect(page.getByTestId('qr-color-step-control')).toContainText('Emerald 700')
  await expectStepSliderColor(page, 'qr-color-step-slider', 'var(--color-emerald-700)')
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

  await expect(page.getByRole('radio', { name: 'Medium' }).locator('path')).toHaveAttribute('d', /A/)

  await page.getByRole('radio', { name: 'Medium' }).click()
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
  await expect(page.getByRole('radio', { name: 'Wavy' })).toBeVisible()
  await page.getByRole('radio', { name: 'Wavy' }).click()

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

  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
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

test('draws QR-like fade border rows around the full QR composition', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/qr-fade-border')

  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'QR Fade' })).toBeVisible()

  const previewState = await getModuleBorderPreviewState(page)

  expect(previewState.pathCount).toBe(0)
  expect(previewState.rectCount).toBeGreaterThan(20)
  expect(previewState.rectangleCornerOnly).toBe(true)
  expect(previewState.hasInteriorArcCells).toBe(false)
  expect(previewState.bounds.width).toBeCloseTo(previewState.bounds.height, 4)
  expect(previewState.bounds.width).toBeGreaterThanOrEqual(20)
  expect(previewState.opacities).toEqual([0.5, 0.75, 1])

  await page.getByRole('radio', { name: 'QR Fade' }).click()

  const state = await getModuleBorderState(page)

  expect(state.circleBorderCount).toBe(0)
  expect(state.rectangleBorderCount).toBe(0)
  expect(state.rowAttributeMatchesOffset).toBe(true)
  expect(state.squareOutsideQrCount).toBe(state.squareCount)
  expect(state.squareSizes).toEqual([state.moduleSize])
  expect(state.rows.map(row => row.offset)).toEqual([2, 3, 4])
  expect(state.rows.map(row => row.opacity)).toEqual([0.75, 0.5, 0.25])
  expect(state.rows.every(row => row.count > 0)).toBe(true)
  expect(state.maxSameRun).toBeLessThanOrEqual(4)

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()
  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'QR Fade' })).toHaveCount(0)
  await expect(page.getByRole('radio', { exact: true, name: 'Fade' })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('[data-testid="qr-module-border"]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Rectangle/Square' }).click()
  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await page.getByRole('radio', { name: 'QR Fade' }).click()

  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Label' }).fill('Bakery Label')

  const labeledState = await getModuleBorderLabelWrapState(page)

  expect(labeledState.topBorderY).toBeLessThan(labeledState.labelTop)
  expect(labeledState.labelBottom).toBeLessThan(labeledState.qrY)
})

test('draws solid rainbow border rows around the full QR composition', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/rainbow-border')

  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await expect(page.getByRole('radio', { exact: true, name: 'Fade' })).toBeVisible()

  const previewState = await getModuleBorderPreviewState(page, 'Fade')

  expect(previewState.pathCount).toBe(0)
  expect(previewState.rectCount).toBeGreaterThan(100)
  expect(previewState.rectangleCornerOnly).toBe(true)
  expect(previewState.hasInteriorArcCells).toBe(false)
  expect(previewState.bounds.width).toBeCloseTo(previewState.bounds.height, 4)
  expect(previewState.bounds.width).toBeLessThan(24)
  expect(previewState.opacities).toEqual([0.25, 0.5, 0.75, 1])
  expect(previewState.rows.map(row => row.offset)).toEqual([2, 3, 4, 5])

  await page.getByRole('radio', { exact: true, name: 'Fade' }).click()

  const state = await getModuleBorderState(page)

  expect(state.circleBorderCount).toBe(0)
  expect(state.rectangleBorderCount).toBe(0)
  expect(state.rowAttributeMatchesOffset).toBe(true)
  expect(state.squareOutsideQrCount).toBe(state.squareCount)
  expect(state.squareSizes).toEqual([state.moduleSize])
  expect(state.rows.map(row => row.offset)).toEqual([2, 3, 4, 5])
  expect(state.rows.map(row => row.opacity)).toEqual([1, 0.75, 0.5, 0.25])
  expect(state.rows.every(row => row.count === row.expectedCount)).toBe(true)

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()
  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await expect(page.getByRole('radio', { exact: true, name: 'Fade' })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'QR Fade' })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('[data-testid="qr-module-border"]')).toHaveCount(0)
})

test('rounds the preview frame and background in circle mode', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/circle-frame')

  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await page.getByRole('radio', { name: 'Medium' }).click()

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

  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Label' }).fill('Rectangle label')
  await page.locator('#qr-additional-text').fill('Rectangle additional')

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()
  await expect(page.getByRole('button', { name: 'Label', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Label & Logo', exact: true })).toHaveCount(0)
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
  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()

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

  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
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

test('colors rectangle label background and text with border-matched QR spacing', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/rectangle-label-colors')

  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Label' }).fill('WINGEN')
  await page.locator('#qr-additional-text').fill('Bakery & Restaurant')
  await page.getByRole('button', { name: 'Border', exact: true }).click()
  await page.getByRole('radio', { name: 'Medium' }).click()
  await page.getByRole('button', { name: 'Colors' }).click()
  await expect(page.getByTestId('label-background-color-selector')).toHaveCount(0)
  await page.getByRole('button', { name: 'Label color controls' }).click()
  await page
    .getByTestId('label-background-color-selector')
    .getByRole('button', { name: 'Use Yellow as the label background color' })
    .click()

  const textColorButtons = page.getByTestId('label-text-color-selector').locator('button')

  await expect(textColorButtons.first()).toContainText('Default')
  await expect(textColorButtons.nth(1)).toContainText('White')
  await textColorButtons.nth(1).click()

  let colorState = await getRectangleLabelColorState(page)

  expect(colorState.labelClass).toContain('text-white')
  expect(colorState.additionalTextClass).toContain('text-white')

  await page
    .getByTestId('label-text-color-selector')
    .getByRole('button', { name: 'Use Blue as the label text color' })
    .click()

  colorState = await getRectangleLabelColorState(page)

  expect(colorState.backgroundClass).toContain('fill-yellow-500')
  expect(colorState.labelClass).toContain('text-blue-500')
  expect(colorState.additionalTextClass).toContain('text-blue-500')
  expect(colorState.backgroundWidth).toBeCloseTo(colorState.qrWidth, 4)
  expect(colorState.backgroundX).toBeCloseTo(colorState.qrX, 4)
  expect(colorState.topGap).toBeCloseTo(colorState.borderGap, 4)
  expect(colorState.backgroundInnerTopGap).toBeCloseTo(colorState.borderGap, 4)
  expect(colorState.backgroundInnerBottomGap).toBeCloseTo(colorState.borderGap, 4)

  await expect(page.getByTestId('qr-color-step-control')).toHaveCount(0)
  await expect(page.getByTestId('label-background-color-step-control')).toContainText('Yellow 500')
  await expect(page.getByTestId('label-text-color-step-control')).toContainText('Blue 500')
  await expectStepSliderColor(page, 'label-background-color-step-slider', 'var(--color-yellow-500)')
  await expectStepSliderColor(page, 'label-text-color-step-slider', 'var(--color-blue-500)')
  await page.getByTestId('label-background-color-step-control').getByRole('slider').press('ArrowRight')
  await page.getByTestId('label-text-color-step-control').getByRole('slider').press('ArrowLeft')
  await expect(page.getByTestId('label-background-color-step-control')).toContainText('Yellow 600')
  await expect(page.getByTestId('label-text-color-step-control')).toContainText('Blue 400')
  await expectStepSliderColor(page, 'label-background-color-step-slider', 'var(--color-yellow-600)')
  await expectStepSliderColor(page, 'label-text-color-step-slider', 'var(--color-blue-400)')

  colorState = await getRectangleLabelColorState(page)

  expect(colorState.backgroundClass).toContain('fill-yellow-600')
  expect(colorState.labelClass).toContain('text-blue-400')
  expect(colorState.additionalTextClass).toContain('text-blue-400')

  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
  await page.getByTestId('rectangle-label-position-controls').getByRole('radio', { name: 'Left' }).click()

  colorState = await getRectangleLabelColorState(page)

  expect(colorState.backgroundHeight).toBeCloseTo(colorState.qrHeight, 4)
  expect(colorState.backgroundY).toBeCloseTo(colorState.qrY, 4)
  expect(colorState.leftGap).toBeCloseTo(colorState.borderGap, 4)

  await page.getByTestId('rectangle-label-position-controls').getByRole('radio', { name: 'Right' }).click()

  colorState = await getRectangleLabelColorState(page)

  expect(colorState.backgroundHeight).toBeCloseTo(colorState.qrHeight, 4)
  expect(colorState.backgroundY).toBeCloseTo(colorState.qrY, 4)
  expect(colorState.rightGap).toBeCloseTo(colorState.borderGap, 4)
})

test('keeps rectangle label background steps across colors but disconnects black', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/background-step-black')

  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Label' }).fill('WINGEN')
  await page.locator('#qr-additional-text').fill('Bakery & Restaurant')
  await page.getByRole('button', { name: 'Label color controls' }).click()

  const backgroundSelector = page.getByTestId('label-background-color-selector')
  const redBackgroundButton = backgroundSelector.getByRole('button', { name: 'Use Red as the label background color' })
  const pinkBackgroundButton = backgroundSelector.getByRole('button', { name: 'Use Pink as the label background color' })
  const blackBackgroundButton = backgroundSelector.getByRole('button', { name: 'Use Black as the label background color' })

  await redBackgroundButton.click()
  await expect(page.getByTestId('label-background-color-step-control')).toContainText('Red 500')

  const backgroundStepSlider = page.getByTestId('label-background-color-step-control').getByRole('slider')

  await backgroundStepSlider.press('ArrowLeft')
  await backgroundStepSlider.press('ArrowLeft')
  await backgroundStepSlider.press('ArrowLeft')
  await expect(page.getByTestId('label-background-color-step-control')).toContainText('Red 200')

  await pinkBackgroundButton.click()
  await expect(page.getByTestId('label-background-color-step-control')).toContainText('Pink 200')

  await blackBackgroundButton.click()
  await expect(page.getByTestId('label-background-color-step-control')).toHaveCount(0)
  await expect(page.getByTestId('qr-label-background')).toHaveClass(/fill-black/)
  await expect(page.getByRole('button', { name: 'Steps' })).toHaveCount(0)

  await expect(redBackgroundButton.locator('span').first()).toHaveClass(/bg-red-500/)

  await redBackgroundButton.click()
  await expect(page.getByTestId('label-background-color-step-control')).toContainText('Red 500')
  await expect(page.getByTestId('qr-label-background')).toHaveClass(/fill-red-500/)
})

test('uploads a rectangle label logo and positions it around the label text', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/rectangle-label-logo')

  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Label color controls' })).toHaveCount(0)

  await page.getByRole('textbox', { name: 'Label' }).fill('WINGEN')
  await page.locator('#qr-additional-text').fill('Bakery & Restaurant')

  const labelButtonBox = await page.getByRole('button', { name: 'Label & Logo', exact: true }).boundingBox()
  const labelColorsButton = page.getByRole('button', { name: 'Label color controls' })
  const labelColorsButtonBox = await labelColorsButton.boundingBox()

  await expect(page.getByRole('button', { name: 'Logo', exact: true })).toHaveCount(0)
  expect(labelColorsButtonBox?.x ?? 0).toBeGreaterThan(labelButtonBox?.x ?? 0)
  expect((labelColorsButtonBox?.x ?? 0) - ((labelButtonBox?.x ?? 0) + (labelButtonBox?.width ?? 0))).toBeLessThan(8)

  await expect(page.getByTestId('rectangle-label-logo-controls')).toBeVisible()
  const logoControlOrder = await getSectionTopPositions(page, [
    'rectangle-label-desktop-primary-controls',
    'rectangle-label-desktop-additional-controls',
    'rectangle-label-logo-position-controls',
    'rectangle-label-logo-dropzone'
  ])

  expect(logoControlOrder['rectangle-label-desktop-primary-controls']).toBeLessThan(logoControlOrder['rectangle-label-desktop-additional-controls'])
  expect(logoControlOrder['rectangle-label-desktop-additional-controls']).toBeLessThan(logoControlOrder['rectangle-label-logo-position-controls'])
  expect(logoControlOrder['rectangle-label-logo-position-controls']).toBeLessThan(logoControlOrder['rectangle-label-logo-dropzone'])

  await expect(page.getByTestId('rectangle-label-logo-desktop-prompt')).toBeVisible()
  await expect(page.getByTestId('rectangle-label-logo-mobile-prompt')).toBeHidden()

  await page.getByTestId('rectangle-label-logo-file-input').setInputFiles({
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#2563eb"/></svg>'),
    mimeType: 'image/svg+xml',
    name: 'brand-logo.svg'
  })

  await expect(page.getByTestId('rectangle-label-logo-dropzone')).toContainText('brand-logo.svg')
  await expect(page.getByTestId('rectangle-label-logo-size-controls')).toBeVisible()
  await expect(page.getByTestId('qr-label-logo')).toHaveAttribute('href', /^data:image\/svg\+xml/)

  const logoControlsLayout = await getRectangleLabelLogoControlsLayout(page)

  expect(logoControlsLayout.sideControlsLeft).toBeGreaterThan(logoControlsLayout.dropzoneRight)
  expect(logoControlsLayout.sideControlsTop).toBeCloseTo(logoControlsLayout.dropzoneTop, 0)
  expect(logoControlsLayout.dropzoneHeight).toBeCloseTo(logoControlsLayout.sideControlsHeight, 0)
  expect(logoControlsLayout.positionControlsRight).toBeCloseTo(logoControlsLayout.dropzoneRight, 0)
  expect(logoControlsLayout.sideControlsWidth).toBeGreaterThanOrEqual(128)
  expect(logoControlsLayout.removeButtonWhiteSpace).toBe('nowrap')
  expect(logoControlsLayout.removeBottom).toBeLessThan(logoControlsLayout.sizeTop)

  let logoState = await getRectangleLabelLogoState(page)

  expect(logoState.logoWidth).toBeCloseTo(logoState.qrWidth, 4)
  expect(logoState.logoBottom).toBeLessThan(logoState.textTop)
  await expect(page.getByRole('button', { name: 'Increase logo size' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Decrease logo size' })).toBeEnabled()

  await page.getByRole('button', { name: 'Decrease logo size' }).click()

  const smallerLogoState = await getRectangleLabelLogoState(page)

  expect(smallerLogoState.logoWidth).toBeLessThan(logoState.logoWidth)
  expect(smallerLogoState.logoWidth).toBeCloseTo(logoState.qrWidth * 0.9, 4)
  await expect(page.getByRole('button', { name: 'Increase logo size' })).toBeEnabled()

  await page.getByRole('button', { name: 'Increase logo size' }).click()

  logoState = await getRectangleLabelLogoState(page)

  expect(logoState.logoWidth).toBeCloseTo(logoState.qrWidth, 4)
  await expect(page.getByRole('button', { name: 'Increase logo size' })).toBeDisabled()

  await page
    .getByTestId('rectangle-label-logo-position-controls')
    .getByRole('button', { name: 'Below' })
    .click()

  logoState = await getRectangleLabelLogoState(page)

  expect(logoState.textBottom).toBeLessThan(logoState.logoTop)

  await page.getByRole('button', { name: 'Shape' }).click()
  await page.getByRole('radio', { name: 'Circle' }).click()
  await expect(page.getByRole('button', { name: 'Logo', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Label color controls' })).toHaveCount(0)
})

test('maximizes a padded rectangle side label logo inside the label space', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/side-label-logo')

  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()
  await page.getByTestId('rectangle-label-position-controls').getByRole('radio', { name: 'Right' }).click()
  await page.getByTestId('rectangle-label-logo-file-input').setInputFiles({
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect x="170" y="230" width="160" height="40" fill="#ff6600"/></svg>'),
    mimeType: 'image/svg+xml',
    name: 'wide-logo-with-padding.svg'
  })

  await expect(page.getByTestId('qr-label-logo')).toHaveAttribute('href', /^data:image\/png/)

  const logoState = await getRectangleSideLabelLogoState(page)

  expect(logoState.logoX).toBeGreaterThan(logoState.qrRight)
  expect(logoState.logoWidth).toBeCloseTo(logoState.qrWidth, 4)
  expect(logoState.logoHeight).toBeCloseTo(logoState.qrWidth / 4, 4)
  expect(logoState.logoCenterY).toBeCloseTo(logoState.qrCenterY, 4)
})

test('uses sectioned mobile label controls for rectangle and circle labels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="url"]')

    return !!input && '_value' in input
  })
  await page.locator('input[type="url"]').fill('https://example.com/mobile-label-controls')

  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()

  await expect(page.getByTestId('rectangle-label-logo-mobile-prompt')).toBeVisible()
  await expect(page.getByTestId('rectangle-label-logo-desktop-prompt')).toBeHidden()

  const rectangleMobileControls = page.getByTestId('rectangle-label-mobile-controls')

  await expect(rectangleMobileControls).toBeVisible()
  await expect(rectangleMobileControls.getByText('Flip', { exact: true })).toHaveCount(0)

  const mobileRectangleOrder = await getSectionTopPositions(page, [
    'rectangle-label-position-controls',
    'rectangle-label-mobile-section-label',
    'rectangle-label-mobile-section-additional',
    'rectangle-label-logo-controls'
  ])

  expect(mobileRectangleOrder['rectangle-label-position-controls']).toBeLessThan(mobileRectangleOrder['rectangle-label-mobile-section-label'])
  expect(mobileRectangleOrder['rectangle-label-mobile-section-label']).toBeLessThan(mobileRectangleOrder['rectangle-label-mobile-section-additional'])
  expect(mobileRectangleOrder['rectangle-label-mobile-section-additional']).toBeLessThan(mobileRectangleOrder['rectangle-label-logo-controls'])

  const rectangleLayout = await page.evaluate(() => {
    const labelSection = document.querySelector('[data-testid="rectangle-label-mobile-section-label"]') as HTMLElement | null
    const additionalSection = document.querySelector('[data-testid="rectangle-label-mobile-section-additional"]') as HTMLElement | null
    const labelInput = labelSection?.querySelector('input[placeholder="Add a word"]') as HTMLInputElement | null
    const additionalInput = additionalSection?.querySelector('input[placeholder="Add smaller text"]') as HTMLInputElement | null

    if (!labelSection || !additionalSection || !labelInput || !additionalInput) {
      throw new Error('Missing mobile rectangle label inputs.')
    }

    return {
      additionalContainerWidth: additionalSection.getBoundingClientRect().width,
      additionalInputWidth: additionalInput.getBoundingClientRect().width,
      labelContainerWidth: labelSection.getBoundingClientRect().width,
      labelInputWidth: labelInput.getBoundingClientRect().width
    }
  })

  expect(rectangleLayout.labelInputWidth).toBeGreaterThan(rectangleLayout.labelContainerWidth * 0.9)
  expect(rectangleLayout.additionalInputWidth).toBeGreaterThan(rectangleLayout.additionalContainerWidth * 0.9)
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
  await expect(page.getByRole('button', { name: 'Label', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Label & Logo', exact: true })).toHaveCount(0)
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
  await page.getByRole('button', { name: 'Label & Logo', exact: true }).click()

  await expect(page.getByTestId('rectangle-label-mobile-controls')).toBeHidden()

  const desktopRectangleOrder = await getSectionTopPositions(page, [
    'rectangle-label-position-controls',
    'rectangle-label-desktop-primary-controls',
    'rectangle-label-desktop-additional-controls',
    'rectangle-label-logo-controls'
  ])

  expect(desktopRectangleOrder['rectangle-label-position-controls']).toBeLessThan(desktopRectangleOrder['rectangle-label-desktop-primary-controls'])
  expect(desktopRectangleOrder['rectangle-label-desktop-primary-controls']).toBeLessThan(desktopRectangleOrder['rectangle-label-desktop-additional-controls'])
  expect(desktopRectangleOrder['rectangle-label-desktop-additional-controls']).toBeLessThan(desktopRectangleOrder['rectangle-label-logo-controls'])
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
  await page.getByRole('radio', { name: 'Medium' }).click()
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
  return getBorderPreviewState(page, 'Wavy')
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

async function getModuleBorderPreviewState(page: Page, borderLabel = 'QR Fade') {
  return page.evaluate((borderLabel) => {
    const button = Array.from(document.querySelectorAll('[role="radio"]'))
      .find(element => element.getAttribute('aria-label') === borderLabel) as HTMLElement | undefined

    if (!button) {
      throw new Error(`Missing ${borderLabel} preview.`)
    }

    const rects = Array.from(button.querySelectorAll('rect')) as SVGRectElement[]
    const rowGroups = new Map<number, Array<{ x: number, y: number }>>()

    for (const rect of rects) {
      const row = Number(rect.getAttribute('data-preview-row'))
      const group = rowGroups.get(row) ?? []

      group.push({
        x: Number(rect.getAttribute('x')),
        y: Number(rect.getAttribute('y'))
      })
      rowGroups.set(row, group)
    }

    const rectangleCornerOnly = Array.from(rowGroups.values()).every((group) => {
      const minX = Math.min(...group.map(rect => rect.x))
      const minY = Math.min(...group.map(rect => rect.y))

      return group.every(rect => rect.x === minX || rect.y === minY)
    })
    const hasInteriorArcCells = Array.from(rowGroups.values()).some((group) => {
      const minX = Math.min(...group.map(rect => rect.x))
      const minY = Math.min(...group.map(rect => rect.y))

      return group.some(rect => rect.x > minX && rect.y > minY)
    })
    const minX = Math.min(...rects.map(rect => Number(rect.getAttribute('x'))))
    const minY = Math.min(...rects.map(rect => Number(rect.getAttribute('y'))))
    const maxX = Math.max(...rects.map(rect => Number(rect.getAttribute('x')) + Number(rect.getAttribute('width'))))
    const maxY = Math.max(...rects.map(rect => Number(rect.getAttribute('y')) + Number(rect.getAttribute('height'))))

    return {
      bounds: {
        height: maxY - minY,
        width: maxX - minX
      },
      hasInteriorArcCells,
      opacities: Array.from(new Set(rects.map(rect => Number(rect.getAttribute('fill-opacity'))))).sort((first, second) => first - second),
      pathCount: button.querySelectorAll('path').length,
      rectCount: rects.length,
      rectangleCornerOnly,
      rows: Array.from(rowGroups, ([offset, row]) => ({
        count: row.length,
        offset
      })).sort((first, second) => first.offset - second.offset)
    }
  }, borderLabel)
}

async function getModuleBorderState(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
    const qrSvg = svg?.querySelector('g[shape-rendering="crispEdges"] svg') as SVGSVGElement | null
    const border = svg?.querySelector('[data-testid="qr-module-border"]') as SVGGElement | null

    if (!svg || !qrSvg || !border) {
      throw new Error('Missing generated module border.')
    }

    const qrX = Number(qrSvg.getAttribute('x'))
    const qrY = Number(qrSvg.getAttribute('y'))
    const qrWidth = Number(qrSvg.getAttribute('width'))
    const qrHeight = Number(qrSvg.getAttribute('height'))
    const qrViewBoxWidth = Number(qrSvg.getAttribute('viewBox')?.split(' ')[2] ?? 1)
    const qrRight = qrX + qrWidth
    const qrBottom = qrY + qrHeight
    const rects = Array.from(border.querySelectorAll('rect')) as SVGRectElement[]
    const rowMap = new Map<number, { count: number, opacity: number }>()
    const darkCellKeys = new Set(rects.map(rect => `${Math.round(Number(rect.getAttribute('x')))}:${Math.round(Number(rect.getAttribute('y')))}`))

    let rowAttributeMatchesOffset = true
    let squareOutsideQrCount = 0

    for (const rect of rects) {
      const x = Number(rect.getAttribute('x'))
      const y = Number(rect.getAttribute('y'))
      const width = Number(rect.getAttribute('width'))
      const height = Number(rect.getAttribute('height'))
      const opacity = Number(rect.getAttribute('fill-opacity'))
      const dataTestId = rect.getAttribute('data-testid') ?? ''
      const rowAttribute = Number(dataTestId.match(/(\d+)$/)?.[1] ?? 0)
      const offset = Math.max(
        qrX - x,
        qrY - y,
        x + width - qrRight,
        y + height - qrBottom
      )
      const roundedOffset = Math.round(offset)
      const isOutsideQr = x + width <= qrX || x >= qrRight || y + height <= qrY || y >= qrBottom
      const row = rowMap.get(roundedOffset) ?? { count: 0, opacity }

      row.count += 1
      row.opacity = opacity
      rowMap.set(roundedOffset, row)
      rowAttributeMatchesOffset &&= rowAttribute === roundedOffset

      if (isOutsideQr) {
        squareOutsideQrCount += 1
      }
    }

    function getRingCells(offset: number) {
      const left = Math.round(qrX - offset)
      const top = Math.round(qrY - offset)
      const right = Math.round(qrRight + offset - 1)
      const bottom = Math.round(qrBottom + offset - 1)
      const cells: boolean[] = []

      for (let x = left; x <= right; x += 1) {
        cells.push(darkCellKeys.has(`${x}:${top}`))
      }

      for (let y = top + 1; y <= bottom; y += 1) {
        cells.push(darkCellKeys.has(`${right}:${y}`))
      }

      for (let x = right - 1; x >= left; x -= 1) {
        cells.push(darkCellKeys.has(`${x}:${bottom}`))
      }

      for (let y = bottom - 1; y > top; y -= 1) {
        cells.push(darkCellKeys.has(`${left}:${y}`))
      }

      return cells
    }

    function getMaxSameRun(cells: boolean[]) {
      let maxRun = 0
      let currentRun = 0
      let currentValue: boolean | undefined

      for (const cell of cells) {
        if (cell === currentValue) {
          currentRun += 1
        } else {
          currentValue = cell
          currentRun = 1
        }

        maxRun = Math.max(maxRun, currentRun)
      }

      return maxRun
    }

    function getExpectedRectangleRingCellCount(offset: number) {
      return 2 * qrWidth + 2 * qrHeight + 8 * offset - 4
    }

    return {
      circleBorderCount: svg.querySelectorAll('[data-testid^="qr-circle-border-"]').length,
      maxSameRun: Math.max(...[2, 3, 4].map(offset => getMaxSameRun(getRingCells(offset)))),
      moduleSize: qrWidth / qrViewBoxWidth,
      rectangleBorderCount: svg.querySelectorAll('[data-testid^="qr-rectangle-border-"]').length,
      rowAttributeMatchesOffset,
      rows: Array.from(rowMap, ([offset, row]) => ({
        count: row.count,
        expectedCount: getExpectedRectangleRingCellCount(offset),
        offset,
        opacity: row.opacity
      })).sort((first, second) => first.offset - second.offset),
      squareCount: rects.length,
      squareOutsideQrCount,
      squareSizes: Array.from(new Set(rects.map(rect => Number(rect.getAttribute('width'))))).sort()
    }
  })
}

async function getModuleBorderLabelWrapState(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
    const qrSvg = svg?.querySelector('g[shape-rendering="crispEdges"] svg') as SVGSVGElement | null
    const border = svg?.querySelector('[data-testid="qr-module-border"]') as SVGGElement | null
    const renderedTexts = Array.from(svg?.querySelectorAll('text') ?? [])
      .filter(element => element.getAttribute('opacity') !== '0')
    const label = renderedTexts.find(element => element.textContent?.trim() === 'Bakery Label')
    const borderRects = Array.from(border?.querySelectorAll('rect') ?? []) as SVGRectElement[]

    if (!svg || !qrSvg || !border || !label || borderRects.length === 0) {
      throw new Error('Missing labeled QR Fade elements.')
    }

    const labelY = Number(label.getAttribute('y'))
    const labelFontSize = Number(label.getAttribute('font-size'))

    return {
      labelBottom: labelY + labelFontSize / 2,
      labelTop: labelY - labelFontSize / 2,
      qrY: Number(qrSvg.getAttribute('y')),
      topBorderY: Math.min(...borderRects.map(rect => Number(rect.getAttribute('y'))))
    }
  })
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

async function getRectangleLabelLogoControlsLayout(page: Page) {
  return page.evaluate(() => {
    const dropzone = document.querySelector('[data-testid="rectangle-label-logo-dropzone"]') as HTMLElement | null
    const positionControls = document.querySelector('[data-testid="rectangle-label-logo-position-controls"]') as HTMLElement | null
    const sideControls = document.querySelector('[data-testid="rectangle-label-logo-side-controls"]') as HTMLElement | null
    const removeButton = document.querySelector('[data-testid="rectangle-label-logo-remove-button"]') as HTMLElement | null
    const sizeControls = document.querySelector('[data-testid="rectangle-label-logo-size-controls"]') as HTMLElement | null

    if (!dropzone || !positionControls || !sideControls || !removeButton || !sizeControls) {
      throw new Error('Missing rectangle label logo controls.')
    }

    const dropzoneRect = dropzone.getBoundingClientRect()
    const positionControlsRect = positionControls.getBoundingClientRect()
    const sideControlsRect = sideControls.getBoundingClientRect()
    const removeRect = removeButton.getBoundingClientRect()
    const sizeRect = sizeControls.getBoundingClientRect()

    return {
      dropzoneHeight: dropzoneRect.height,
      dropzoneRight: dropzoneRect.right,
      dropzoneTop: dropzoneRect.top,
      positionControlsRight: positionControlsRect.right,
      removeBottom: removeRect.bottom,
      removeButtonWhiteSpace: getComputedStyle(removeButton).whiteSpace,
      sideControlsHeight: sideControlsRect.height,
      sideControlsLeft: sideControlsRect.left,
      sideControlsTop: sideControlsRect.top,
      sideControlsWidth: sideControlsRect.width,
      sizeTop: sizeRect.top
    }
  })
}

async function expectStepSliderColor(page: Page, testId: string, expectedCssValue: string) {
  const sliderColorState = await page.getByTestId(testId).evaluate((slider, expectedValue) => {
    const range = slider.querySelector('[data-slot="range"]') as HTMLElement | null
    const thumb = slider.querySelector('[data-slot="thumb"]') as HTMLElement | null
    const probe = document.createElement('div')

    if (!range || !thumb) {
      throw new Error(`Missing slider color elements for ${testId}.`)
    }

    probe.style.backgroundColor = expectedValue
    document.body.append(probe)

    const expectedColor = getComputedStyle(probe).backgroundColor

    probe.remove()

    return {
      expectedColor,
      rangeColor: getComputedStyle(range).backgroundColor,
      sliderVariable: getComputedStyle(slider).getPropertyValue('--qr-step-slider-color').trim(),
      thumbShadow: getComputedStyle(thumb).boxShadow
    }
  }, expectedCssValue)

  expect(sliderColorState.sliderVariable).not.toBe('')
  expect(sliderColorState.rangeColor).toBe(sliderColorState.expectedColor)
  expect(sliderColorState.thumbShadow).toContain(sliderColorState.expectedColor)
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

async function getRectangleLabelColorState(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
    const qrSvg = svg?.querySelector('g[shape-rendering="crispEdges"] svg') as SVGSVGElement | null
    const border = svg?.querySelector('[data-testid="qr-rectangle-border-0.5"]') as SVGRectElement | null
    const background = svg?.querySelector('[data-testid="qr-label-background"]') as SVGRectElement | null
    const renderedTexts = Array.from(svg?.querySelectorAll('text') ?? [])
      .filter(element => element.getAttribute('opacity') !== '0')
    const label = renderedTexts.find(element => element.textContent?.trim() === 'WINGEN')
    const additional = renderedTexts.find(element => element.textContent?.trim() === 'Bakery & Restaurant')

    if (!svg || !qrSvg || !border || !background || !label || !additional) {
      throw new Error('Missing rectangle label color elements.')
    }

    const qrX = Number(qrSvg.getAttribute('x'))
    const qrY = Number(qrSvg.getAttribute('y'))
    const qrWidth = Number(qrSvg.getAttribute('width'))
    const qrHeight = Number(qrSvg.getAttribute('height'))
    const backgroundX = Number(background.getAttribute('x'))
    const backgroundY = Number(background.getAttribute('y'))
    const backgroundWidth = Number(background.getAttribute('width'))
    const backgroundHeight = Number(background.getAttribute('height'))
    const borderX = Number(border.getAttribute('x'))
    const borderWidth = Number(border.getAttribute('width'))
    const strokeWidth = Number(border.getAttribute('stroke-width'))
    const borderInnerLeft = borderX + strokeWidth / 2
    const borderInnerRight = borderX + borderWidth - strokeWidth / 2
    const qrRight = qrX + qrWidth
    const qrBottom = qrY + qrHeight
    const backgroundRight = backgroundX + backgroundWidth
    const backgroundBottom = backgroundY + backgroundHeight
    const labelY = Number(label.getAttribute('y'))
    const labelFontSize = Number(label.getAttribute('font-size'))
    const additionalY = Number(additional.getAttribute('y'))
    const additionalFontSize = Number(additional.getAttribute('font-size'))
    const contentTop = Math.min(labelY - labelFontSize / 2, additionalY - additionalFontSize / 2)
    const contentBottom = Math.max(labelY + labelFontSize / 2, additionalY + additionalFontSize / 2)

    return {
      additionalTextClass: additional.getAttribute('class') ?? '',
      backgroundClass: background.getAttribute('class') ?? '',
      backgroundHeight,
      backgroundInnerBottomGap: backgroundBottom - contentBottom,
      backgroundInnerTopGap: contentTop - backgroundY,
      backgroundWidth,
      backgroundX,
      backgroundY,
      borderGap: Math.min(qrX - borderInnerLeft, borderInnerRight - qrRight),
      labelClass: label.getAttribute('class') ?? '',
      leftGap: qrX - backgroundRight,
      qrHeight,
      qrWidth,
      qrX,
      qrY,
      rightGap: backgroundX - qrRight,
      topGap: qrY - backgroundBottom,
      bottomGap: backgroundY - qrBottom
    }
  })
}

async function getRectangleLabelLogoState(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
    const logo = svg?.querySelector('[data-testid="qr-label-logo"]') as SVGImageElement | null
    const renderedTexts = Array.from(svg?.querySelectorAll('text') ?? [])
      .filter(element => element.getAttribute('opacity') !== '0')
    const label = renderedTexts.find(element => element.textContent?.trim() === 'WINGEN')
    const additional = renderedTexts.find(element => element.textContent?.trim() === 'Bakery & Restaurant')
    const qrSvg = svg?.querySelector('g[shape-rendering="crispEdges"] svg') as SVGSVGElement | null

    if (!svg || !logo || !label || !additional || !qrSvg) {
      throw new Error('Missing rectangle label logo elements.')
    }

    const logoTop = Number(logo.getAttribute('y'))
    const logoWidth = Number(logo.getAttribute('width'))
    const logoBottom = logoTop + Number(logo.getAttribute('height'))
    const labelY = Number(label.getAttribute('y'))
    const labelFontSize = Number(label.getAttribute('font-size'))
    const additionalY = Number(additional.getAttribute('y'))
    const additionalFontSize = Number(additional.getAttribute('font-size'))
    const labelTop = labelY - labelFontSize / 2
    const labelBottom = labelY + labelFontSize / 2
    const additionalTop = additionalY - additionalFontSize / 2
    const additionalBottom = additionalY + additionalFontSize / 2

    return {
      logoBottom,
      logoWidth,
      logoTop,
      qrWidth: Number(qrSvg.getAttribute('width')),
      textBottom: Math.max(labelBottom, additionalBottom),
      textTop: Math.min(labelTop, additionalTop)
    }
  })
}

async function getRectangleSideLabelLogoState(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="Generated QR code"]') as SVGSVGElement | null
    const logo = svg?.querySelector('[data-testid="qr-label-logo"]') as SVGImageElement | null
    const qrSvg = svg?.querySelector('g[shape-rendering="crispEdges"] svg') as SVGSVGElement | null

    if (!svg || !logo || !qrSvg) {
      throw new Error('Missing rectangle side label logo elements.')
    }

    const logoX = Number(logo.getAttribute('x'))
    const logoY = Number(logo.getAttribute('y'))
    const logoWidth = Number(logo.getAttribute('width'))
    const logoHeight = Number(logo.getAttribute('height'))
    const qrX = Number(qrSvg.getAttribute('x'))
    const qrY = Number(qrSvg.getAttribute('y'))
    const qrWidth = Number(qrSvg.getAttribute('width'))
    const qrHeight = Number(qrSvg.getAttribute('height'))

    return {
      logoCenterY: logoY + logoHeight / 2,
      logoHeight,
      logoWidth,
      logoX,
      qrCenterY: qrY + qrHeight / 2,
      qrRight: qrX + qrWidth,
      qrWidth
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
