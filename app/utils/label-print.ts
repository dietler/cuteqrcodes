export type LabelPrintPayload = {
  createdAt: number
  height: number
  name?: string
  svg: string
  title: string
  url?: string
  width: number
}

export type LabelTemplateType = 'rectangle' | 'square'

export type LabelTemplateLayout = {
  columns: number
  rows: number
  pageWidth: number
  pageHeight: number
  labelWidth: number
  labelHeight: number
  marginLeft: number
  marginTop: number
  columnGap: number
  rowGap: number
  labelPadding: number
}

export type LabelTemplate = {
  id: string
  label: string
  description: string
  templateNumber: string
  type: LabelTemplateType
  rotateArtwork: boolean
  layout: LabelTemplateLayout
}

export const labelPrintPayloadStorageKey = 'cuteqrcodes.labelPrintPayload'

export const pdfPointsPerInch = 72

export const labelPdfRenderLongEdgePixels = 1200

const letterPageWidth = 8.5
const letterPageHeight = 11

function createLayout({
  columns,
  rows,
  labelWidth,
  labelHeight,
  marginLeft,
  marginTop,
  labelPadding = 0.125
}: {
  columns: number
  rows: number
  labelWidth: number
  labelHeight: number
  marginLeft: number
  marginTop: number
  labelPadding?: number
}): LabelTemplateLayout {
  return {
    columns,
    rows,
    pageWidth: letterPageWidth * pdfPointsPerInch,
    pageHeight: letterPageHeight * pdfPointsPerInch,
    labelWidth: labelWidth * pdfPointsPerInch,
    labelHeight: labelHeight * pdfPointsPerInch,
    marginLeft: marginLeft * pdfPointsPerInch,
    marginTop: marginTop * pdfPointsPerInch,
    columnGap: columns > 1 ? (letterPageWidth - marginLeft * 2 - labelWidth * columns) / (columns - 1) * pdfPointsPerInch : 0,
    rowGap: rows > 1 ? (letterPageHeight - marginTop * 2 - labelHeight * rows) / (rows - 1) * pdfPointsPerInch : 0,
    labelPadding: labelPadding * pdfPointsPerInch
  }
}

export const labelTemplates: LabelTemplate[] = [{
  id: 'avery-presta-94256',
  label: '3.5" x 5"',
  description: 'Avery Presta® Template 94256',
  templateNumber: '94256',
  type: 'rectangle',
  rotateArtwork: false,
  layout: createLayout({
    columns: 2,
    rows: 2,
    labelWidth: 3.5,
    labelHeight: 5,
    marginLeft: 0.5,
    marginTop: 0.425
  })
}, {
  id: 'avery-presta-94207',
  label: '2" x 4"',
  description: 'Avery Presta® Template 94207',
  templateNumber: '94207',
  type: 'rectangle',
  rotateArtwork: true,
  layout: createLayout({
    columns: 2,
    rows: 5,
    labelWidth: 4,
    labelHeight: 2,
    marginLeft: 0.156,
    marginTop: 0.5
  })
}, {
  id: 'avery-presta-94237',
  label: '2" x 3"',
  description: 'Avery Presta® Template 94237',
  templateNumber: '94237',
  type: 'rectangle',
  rotateArtwork: true,
  layout: createLayout({
    columns: 2,
    rows: 4,
    labelWidth: 3,
    labelHeight: 2,
    marginLeft: 0.85,
    marginTop: 1
  })
}, {
  id: 'avery-presta-94100',
  label: '4" x 4"',
  description: 'Avery Presta® Template 94100',
  templateNumber: '94100',
  type: 'square',
  rotateArtwork: false,
  layout: createLayout({
    columns: 2,
    rows: 2,
    labelWidth: 3.937,
    labelHeight: 3.937,
    marginLeft: 0.2505,
    marginTop: 1
  })
}, {
  id: 'avery-presta-94101',
  label: '3" x 3"',
  description: 'Avery Presta® Template 94101',
  templateNumber: '94101',
  type: 'square',
  rotateArtwork: false,
  layout: createLayout({
    columns: 2,
    rows: 3,
    labelWidth: 3,
    labelHeight: 3,
    marginLeft: 0.625,
    marginTop: 0.625
  })
}]
