<script setup lang="ts">
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { computed, onMounted, ref } from 'vue'
import {
  labelPdfRenderLongEdgePixels,
  labelPrintPayloadStorageKey,
  labelTemplates,
  type LabelTemplate,
  type LabelPrintPayload
} from '~/utils/label-print'

type LabelType = 'rectangle' | 'square'

const selectedLabelType = ref<LabelType>('rectangle')
const printPayload = ref<LabelPrintPayload | null>(null)
const isCreatingPdf = ref(false)
const pdfError = ref('')

const labelTypeOptions: { label: string, value: LabelType }[] = [
  { label: 'Rectangle', value: 'rectangle' },
  { label: 'Square', value: 'square' }
]

const hasPrintPayload = computed(() => Boolean(printPayload.value))
const activeLabelTemplates = computed(() => labelTemplates.filter(template => template.type === selectedLabelType.value))

onMounted(() => {
  printPayload.value = readPrintPayload()
})

function selectLabelType(value: LabelType) {
  selectedLabelType.value = value
  pdfError.value = ''
}

function getAveryTemplateUrl(template: LabelTemplate) {
  return `https://www.avery.com/blank/labels/${template.templateNumber}`
}

function getAmazonTemplateUrl(template: LabelTemplate) {
  return `https://www.amazon.com/s?k=avery+${template.templateNumber}`
}

function readPrintPayload() {
  const rawPayload = sessionStorage.getItem(labelPrintPayloadStorageKey)

  if (!rawPayload) {
    return null
  }

  try {
    const payload = JSON.parse(rawPayload) as Partial<LabelPrintPayload>

    if (
      typeof payload.svg !== 'string'
      || typeof payload.title !== 'string'
      || typeof payload.width !== 'number'
      || typeof payload.height !== 'number'
      || typeof payload.createdAt !== 'number'
    ) {
      return null
    }

    if (typeof payload.name !== 'string') {
      delete payload.name
    }

    if (typeof payload.url !== 'string') {
      delete payload.url
    }

    return payload as LabelPrintPayload
  } catch {
    return null
  }
}

async function createLabelPdf(template: LabelTemplate) {
  const payload = printPayload.value

  if (!payload || isCreatingPdf.value) {
    return
  }

  const pdfWindow = window.open('', '_blank')

  isCreatingPdf.value = true
  pdfError.value = ''

  try {
    await document.fonts?.ready

    const qrPngDataUrl = await renderPayloadToPng(payload, template.rotateArtwork)
    const pdfDocument = await PDFDocument.create()
    const { layout } = template
    const page = pdfDocument.addPage([layout.pageWidth, layout.pageHeight])
    const qrImage = await pdfDocument.embedPng(qrPngDataUrl)
    const headerLogoImage = await pdfDocument.embedPng(await renderSvgAssetToPng('/icons/rabbit.svg', 96, 96))
    const headerFont = await pdfDocument.embedFont(StandardFonts.Helvetica)
    const headerBoldFont = await pdfDocument.embedFont(StandardFonts.HelveticaBold)
    const labelsPerSheet = layout.columns * layout.rows
    const availableWidth = layout.labelWidth - layout.labelPadding * 2
    const availableHeight = layout.labelHeight - layout.labelPadding * 2
    const imageScale = Math.min(availableWidth / qrImage.width, availableHeight / qrImage.height)
    const imageWidth = qrImage.width * imageScale
    const imageHeight = qrImage.height * imageScale

    drawPdfHeader(page, {
      font: headerFont,
      logoImage: headerLogoImage,
      name: payload.name || payload.title,
      pageHeight: layout.pageHeight,
      pageWidth: layout.pageWidth,
      topMargin: layout.marginTop,
      url: payload.url || payload.title,
      boldFont: headerBoldFont
    })

    for (let index = 0; index < labelsPerSheet; index++) {
      const column = index % layout.columns
      const row = Math.floor(index / layout.columns)
      const labelX = layout.marginLeft + column * (layout.labelWidth + layout.columnGap)
      const labelTopY = layout.marginTop + row * (layout.labelHeight + layout.rowGap)
      const labelY = layout.pageHeight - labelTopY - layout.labelHeight

      page.drawImage(qrImage, {
        x: labelX + (layout.labelWidth - imageWidth) / 2,
        y: labelY + (layout.labelHeight - imageHeight) / 2,
        width: imageWidth,
        height: imageHeight
      })
    }

    const pdfBytes = await pdfDocument.save()
    const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength)

    new Uint8Array(pdfBuffer).set(pdfBytes)

    const pdfUrl = URL.createObjectURL(new Blob([pdfBuffer], { type: 'application/pdf' }))

    if (pdfWindow) {
      pdfWindow.location.href = pdfUrl
    } else {
      const link = document.createElement('a')
      link.href = pdfUrl
      link.target = '_blank'
      link.rel = 'noopener'
      link.click()
    }

    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
  } catch (error) {
    pdfWindow?.close()
    pdfError.value = error instanceof Error ? error.message : 'Unable to create the label PDF.'
  } finally {
    isCreatingPdf.value = false
  }
}

function drawPdfHeader(page: PDFPage, {
  boldFont,
  font,
  logoImage,
  name,
  pageHeight,
  pageWidth,
  topMargin,
  url
}: {
  boldFont: PDFFont
  font: PDFFont
  logoImage: PDFImage
  name: string
  pageHeight: number
  pageWidth: number
  topMargin: number
  url: string
}) {
  if (topMargin < 24) {
    return
  }

  const headerBottom = pageHeight - topMargin
  const horizontalPadding = 24
  const logoSize = Math.min(24, Math.max(16, topMargin - 8))
  const logoY = headerBottom + (topMargin - logoSize) / 2
  const titleFontSize = Math.min(10, Math.max(8, topMargin * 0.28))
  const detailFontSize = Math.min(7, Math.max(5.5, topMargin * 0.18))
  const lineGap = 1.5
  const textBlockHeight = titleFontSize + detailFontSize * 2 + lineGap * 2
  const textX = horizontalPadding + logoSize + 8
  const maxTextWidth = pageWidth - textX - horizontalPadding
  const titleY = headerBottom + (topMargin + textBlockHeight) / 2 - titleFontSize
  const nameY = titleY - detailFontSize - lineGap
  const urlY = nameY - detailFontSize - lineGap

  page.drawImage(logoImage, {
    height: logoSize,
    width: logoSize,
    x: horizontalPadding,
    y: logoY
  })
  page.drawText('Cute QR Codes', {
    color: rgb(0.07, 0.08, 0.1),
    font: boldFont,
    size: titleFontSize,
    x: textX,
    y: titleY
  })
  page.drawText(truncatePdfText(font, name, detailFontSize, maxTextWidth), {
    color: rgb(0.25, 0.28, 0.33),
    font,
    size: detailFontSize,
    x: textX,
    y: nameY
  })
  page.drawText(truncatePdfText(font, url, detailFontSize, maxTextWidth), {
    color: rgb(0.36, 0.39, 0.45),
    font,
    size: detailFontSize,
    x: textX,
    y: urlY
  })
}

function truncatePdfText(font: PDFFont, value: string, fontSize: number, maxWidth: number) {
  const text = value.trim()

  if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) {
    return text
  }

  const ellipsis = '...'
  let low = 0
  let high = text.length

  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    const candidate = `${text.slice(0, middle)}${ellipsis}`

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      low = middle
    } else {
      high = middle - 1
    }
  }

  return `${text.slice(0, low)}${ellipsis}`
}

async function renderSvgAssetToPng(src: string, width: number, height: number) {
  const response = await fetch(src)

  if (!response.ok) {
    throw new Error('Unable to load the PDF header logo.')
  }

  const svg = await response.text()
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  const canvas = document.createElement('canvas')
  const scale = 3

  canvas.width = width * scale
  canvas.height = height * scale

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas rendering is not available.')
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/png')
}

async function renderPayloadToPng(payload: LabelPrintPayload, rotateArtwork: boolean) {
  const svgImage = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(payload.svg)}`)
  const renderScale = labelPdfRenderLongEdgePixels / Math.max(payload.width, payload.height)
  const renderedWidth = Math.ceil(payload.width * renderScale)
  const renderedHeight = Math.ceil(payload.height * renderScale)
  const canvas = document.createElement('canvas')

  canvas.width = rotateArtwork ? renderedHeight : renderedWidth
  canvas.height = rotateArtwork ? renderedWidth : renderedHeight

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas rendering is not available.')
  }

  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  if (rotateArtwork) {
    context.translate(canvas.width, 0)
    context.rotate(Math.PI / 2)
  }

  context.drawImage(svgImage, 0, 0, renderedWidth, renderedHeight)

  return canvas.toDataURL('image/png')
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('Unable to render QR artwork for PDF.')))
    image.src = src
  })
}
</script>

<template>
  <UContainer class="flex min-h-[calc(100svh-4rem)] max-w-3xl flex-col gap-4 py-4 sm:gap-6 sm:py-6">
    <div class="flex items-center justify-between gap-3">
      <UButton
        color="neutral"
        icon="i-lucide-arrow-left"
        variant="subtle"
        @click="navigateTo('/')"
      >
        QR Code
      </UButton>
    </div>

    <UCard>
      <div class="space-y-5">
        <div>
          <h1 class="text-lg font-semibold text-highlighted">
            Print to Labels
          </h1>
          <p
            v-if="printPayload"
            class="mt-1 truncate text-sm text-muted"
          >
            {{ printPayload.title }}
          </p>
        </div>

        <UAlert
          v-if="!hasPrintPayload"
          color="warning"
          icon="i-lucide-triangle-alert"
          title="No QR code is ready for labels."
          variant="subtle"
        />
        <UAlert
          v-if="pdfError"
          color="warning"
          icon="i-lucide-triangle-alert"
          :title="pdfError"
          variant="subtle"
        />

        <template v-if="hasPrintPayload">
          <UFormField label="Label Type">
            <div
              aria-label="Label Type"
              class="flex flex-wrap gap-2"
              role="radiogroup"
            >
              <button
                v-for="option in labelTypeOptions"
                :key="option.value"
                :aria-checked="selectedLabelType === option.value"
                class="rounded-lg border px-3 py-2 text-sm font-medium transition"
                :class="selectedLabelType === option.value ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
                role="radio"
                type="button"
                @click="selectLabelType(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </UFormField>

          <div class="space-y-2">
            <div
              v-for="template in activeLabelTemplates"
              :key="template.id"
              class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
            >
              <button
                class="flex w-full items-center gap-3 rounded-md px-1 py-1 text-left transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-75 dark:hover:bg-slate-900"
                :disabled="isCreatingPdf"
                type="button"
                @click="createLabelPdf(template)"
              >
                <UIcon
                  name="i-lucide-file-text"
                  class="size-5 shrink-0 text-muted"
                />
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-highlighted">{{ template.label }}</span>
                  <span class="block text-sm text-muted">{{ template.description }}</span>
                </span>
                <UIcon
                  :name="isCreatingPdf ? 'i-lucide-loader-circle' : 'i-lucide-arrow-right'"
                  class="size-5 shrink-0 text-muted"
                  :class="isCreatingPdf ? 'animate-spin' : ''"
                />
              </button>

              <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <span class="text-sm font-medium text-muted">Buy From:</span>
                <a
                  :aria-label="`Buy ${template.description} from Avery`"
                  class="inline-flex h-7 items-center rounded border border-slate-200 bg-white px-3 py-1.5 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                  :href="getAveryTemplateUrl(template)"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <svg
                    aria-label="Avery"
                    xmlns="http://www.w3.org/2000/svg"
                    role="img"
                    viewBox="0 0 97.75 46.23"
                    class="h-[17px] w-[35.5px]"
                  >
                    <title>Avery</title>
                    <polygon
                      points="92.19 14.47 87.89 21.91 83.58 14.47 78.19 14.47 85.18 26.58 82.29 31.58 87.68 31.58 97.58 14.47 92.19 14.47"
                      class="fill-[#005da8]"
                    />
                    <path
                      d="M70.46,22.64h-5v-4.1h5c1.59,0,2.56.678,2.56,2C73.02,21.753,72.129,22.64,70.46,22.64Zm7.3-2.29h0a5.328,5.328,0,0,0-1.51-4c-1.15-1.17-3-1.86-5.56-1.86H60.75V31.58h4.73v-5.2h3.94l3.47,5.2h5.46l-4.1-6A5.387,5.387,0,0,0,77.76,20.35Z"
                      class="fill-[#005da8]"
                    />
                    <polygon
                      points="8.16 30.57 10.5 46.23 50.72 40.22 49.71 33.47 47.38 33.47 48.09 38.27 12.45 43.6 10.5 30.57 8.16 30.57"
                      class="fill-[#de1d37]"
                    />
                    <polygon
                      points="46.55 24.81 54.72 24.81 54.72 21.08 46.55 21.08 46.55 18.49 57.15 18.49 57.15 14.47 41.86 14.47 41.86 31.58 57.27 31.58 57.27 27.55 46.55 27.55 46.55 24.81"
                      class="fill-[#005da8]"
                    />
                    <polygon
                      points="29.77 25.18 24.32 14.47 18.85 14.47 27.55 31.58 31.99 31.58 40.69 14.47 35.22 14.47 29.77 25.18"
                      class="fill-[#005da8]"
                    />
                    <path
                      d="M11.54,19.88L14.22,25H8.87ZM9,14.47L0,31.58H5.38l1.55-2.94h9.23l1.55,2.94h5.38l-9-17.11H9Z"
                      class="fill-[#005da8]"
                    />
                    <polygon
                      points="44.71 0 4.49 6.01 6 16.07 7.31 13.57 7.82 12.62 7.12 7.95 42.77 2.63 44.25 12.54 46.58 12.54 44.71 0"
                      class="fill-[#de1d37]"
                    />
                  </svg>
                </a>
                <a
                  :aria-label="`Buy ${template.description} from Amazon`"
                  class="inline-flex h-7 items-center rounded border border-slate-200 bg-white px-3 py-1.5 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                  :href="getAmazonTemplateUrl(template)"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <img
                    src="/logos/amazon.svg"
                    alt="Amazon"
                    class="h-[17px] w-[56px] object-contain"
                  >
                </a>
              </div>
            </div>
          </div>
        </template>
      </div>
    </UCard>
  </UContainer>
</template>
