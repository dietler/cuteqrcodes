<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { createQrCode, createQrSvgPath } from '~/utils/qr'

type QrTool = 'colors' | 'step' | 'label' | 'icon' | 'border'
type BorderValue = 'none' | 'hairline' | 'thin' | 'thick' | 'double'
type CenterIconValue = string
type LabelPosition = 'top' | 'left' | 'right' | 'bottom'
type TailwindColorUtility = 'bg' | 'fill' | 'stroke' | 'text'

type TailwindColor = {
  name: string
  bgClass: string
  fillClass: string
  strokeClass: string
  textClass: string
}

type LabelFont = {
  label: string
  value: string
  class: string
}

type LabelPositionOption = {
  label: string
  value: LabelPosition
  disabled: boolean
}

type CenterIconOption = {
  label: string
  value: CenterIconValue
  src: string
  categoryLabel: string
}

type CenterIconCategory = {
  label: string
  value: string
  src: string
  icons: CenterIconOption[]
}

type BorderLine = {
  inset: number
  strokeWidth: number
}

type BorderStyle = {
  label: string
  value: BorderValue
  lines: BorderLine[]
  contentGap: number
}

const qrStore = useQrStore()

const activeTool = ref<QrTool>('colors')
const selectedQrColor = ref<TailwindColor | null>(null)
const colorScroller = ref<HTMLElement | null>(null)
const labelMeasureElement = ref<SVGTextElement | null>(null)
const hasColorsBefore = ref(false)
const hasColorsAfter = ref(false)
const selectedColorStep = ref(500)
const labelFontScale = ref(1)
const qrLabel = ref('')
const selectedLabelPosition = ref<LabelPosition>('bottom')
const selectedCenterIcon = ref<CenterIconValue>('none')
const activeCenterIconCategory = ref<string | null>(null)
const centerIconSearch = ref('')

const tailwindColorSteps = [100, 200, 300, 400, 500, 600, 700, 800, 900]

const labelFonts: LabelFont[] = [
  { label: 'Google Sans', value: 'google-sans', class: 'font-google-sans' },
  { label: 'Bebas Neue', value: 'bebas-neue', class: 'font-bebas-neue' }
]
const fallbackLabelFont = labelFonts[0]!
const selectedLabelFont = ref(fallbackLabelFont.value)
const labelFontItems = labelFonts.map(font => ({ label: font.label, value: font.value, class: font.class }))
const labelPositionOptions: LabelPositionOption[] = [
  { label: 'Top', value: 'top', disabled: false },
  { label: 'Left', value: 'left', disabled: true },
  { label: 'Right', value: 'right', disabled: true },
  { label: 'Bottom', value: 'bottom', disabled: false }
]
const noCenterIconOption: CenterIconOption = { label: 'None', value: 'none', src: '', categoryLabel: '' }
const centerIconCategories: CenterIconCategory[] = [
  {
    label: 'Website',
    value: 'website',
    src: '/icons/center/website/index.svg',
    icons: [
      createCenterIconOption('website', 'Website', 'Link', 'link')
    ]
  },
  {
    label: 'Restaurant',
    value: 'restaurant',
    src: '/icons/center/restaurant/index.svg',
    icons: [
      createCenterIconOption('restaurant', 'Restaurant', 'Menu', 'menu'),
      createCenterIconOption('restaurant', 'Restaurant', 'Silverware', 'silverware'),
      createCenterIconOption('restaurant', 'Restaurant', 'Dinerware', 'dinerware'),
      createCenterIconOption('restaurant', 'Restaurant', 'Wine', 'wine'),
      createCenterIconOption('restaurant', 'Restaurant', 'Cocktail', 'cocktail'),
      createCenterIconOption('restaurant', 'Restaurant', 'Beer', 'beer')
    ]
  },
  {
    label: 'Event',
    value: 'event',
    src: '/icons/center/event/index.svg',
    icons: [
      createCenterIconOption('event', 'Event', 'Tickets', 'tickets')
    ]
  },
  {
    label: 'Payment',
    value: 'payment',
    src: '/icons/center/payment/index.svg',
    icons: [
      createCenterIconOption('payment', 'Payment', 'Google Pay', 'google-pay'),
      createCenterIconOption('payment', 'Payment', 'Apple Pay', 'apple-pay'),
      createCenterIconOption('payment', 'Payment', 'Tap to Pay', 'tap-to-pay'),
      createCenterIconOption('payment', 'Payment', 'Credit Card', 'credit-card'),
      createCenterIconOption('payment', 'Payment', 'Euro', 'euro'),
      createCenterIconOption('payment', 'Payment', 'Dollar', 'dollar')
    ]
  }
]
const centerIconOptions = [noCenterIconOption, ...centerIconCategories.flatMap(category => category.icons)]

const noBorderStyle: BorderStyle = {
  label: 'No border',
  value: 'none',
  lines: [],
  contentGap: 0
}
const borderStyles: BorderStyle[] = [
  noBorderStyle,
  {
    label: 'Hairline border',
    value: 'hairline',
    lines: [{ inset: 0.25, strokeWidth: 0.5 }],
    contentGap: 1
  },
  {
    label: 'Thin border',
    value: 'thin',
    lines: [{ inset: 0.5, strokeWidth: 1 }],
    contentGap: 1
  },
  {
    label: 'Thick border',
    value: 'thick',
    lines: [{ inset: 1, strokeWidth: 2 }],
    contentGap: 1
  },
  {
    label: 'Double border',
    value: 'double',
    lines: [
      { inset: 0.5, strokeWidth: 1 },
      { inset: 2.5, strokeWidth: 1 }
    ],
    contentGap: 1
  }
]
const selectedBorder = ref<BorderValue>('none')

const tailwindColors: TailwindColor[] = [
  { name: 'Red', bgClass: 'bg-red-400', fillClass: 'fill-red-400', strokeClass: 'stroke-red-400', textClass: 'text-red-400' },
  { name: 'Orange', bgClass: 'bg-orange-400', fillClass: 'fill-orange-400', strokeClass: 'stroke-orange-400', textClass: 'text-orange-400' },
  { name: 'Amber', bgClass: 'bg-amber-400', fillClass: 'fill-amber-400', strokeClass: 'stroke-amber-400', textClass: 'text-amber-400' },
  { name: 'Yellow', bgClass: 'bg-yellow-400', fillClass: 'fill-yellow-400', strokeClass: 'stroke-yellow-400', textClass: 'text-yellow-400' },
  { name: 'Lime', bgClass: 'bg-lime-400', fillClass: 'fill-lime-400', strokeClass: 'stroke-lime-400', textClass: 'text-lime-400' },
  { name: 'Green', bgClass: 'bg-green-400', fillClass: 'fill-green-400', strokeClass: 'stroke-green-400', textClass: 'text-green-400' },
  { name: 'Emerald', bgClass: 'bg-emerald-400', fillClass: 'fill-emerald-400', strokeClass: 'stroke-emerald-400', textClass: 'text-emerald-400' },
  { name: 'Teal', bgClass: 'bg-teal-400', fillClass: 'fill-teal-400', strokeClass: 'stroke-teal-400', textClass: 'text-teal-400' },
  { name: 'Cyan', bgClass: 'bg-cyan-400', fillClass: 'fill-cyan-400', strokeClass: 'stroke-cyan-400', textClass: 'text-cyan-400' },
  { name: 'Sky', bgClass: 'bg-sky-400', fillClass: 'fill-sky-400', strokeClass: 'stroke-sky-400', textClass: 'text-sky-400' },
  { name: 'Blue', bgClass: 'bg-blue-400', fillClass: 'fill-blue-400', strokeClass: 'stroke-blue-400', textClass: 'text-blue-400' },
  { name: 'Indigo', bgClass: 'bg-indigo-400', fillClass: 'fill-indigo-400', strokeClass: 'stroke-indigo-400', textClass: 'text-indigo-400' },
  { name: 'Violet', bgClass: 'bg-violet-400', fillClass: 'fill-violet-400', strokeClass: 'stroke-violet-400', textClass: 'text-violet-400' },
  { name: 'Purple', bgClass: 'bg-purple-400', fillClass: 'fill-purple-400', strokeClass: 'stroke-purple-400', textClass: 'text-purple-400' },
  { name: 'Fuchsia', bgClass: 'bg-fuchsia-400', fillClass: 'fill-fuchsia-400', strokeClass: 'stroke-fuchsia-400', textClass: 'text-fuchsia-400' },
  { name: 'Pink', bgClass: 'bg-pink-400', fillClass: 'fill-pink-400', strokeClass: 'stroke-pink-400', textClass: 'text-pink-400' },
  { name: 'Rose', bgClass: 'bg-rose-400', fillClass: 'fill-rose-400', strokeClass: 'stroke-rose-400', textClass: 'text-rose-400' },
  { name: 'Slate', bgClass: 'bg-slate-400', fillClass: 'fill-slate-400', strokeClass: 'stroke-slate-400', textClass: 'text-slate-400' },
  { name: 'Gray', bgClass: 'bg-gray-400', fillClass: 'fill-gray-400', strokeClass: 'stroke-gray-400', textClass: 'text-gray-400' },
  { name: 'Zinc', bgClass: 'bg-zinc-400', fillClass: 'fill-zinc-400', strokeClass: 'stroke-zinc-400', textClass: 'text-zinc-400' },
  { name: 'Neutral', bgClass: 'bg-neutral-400', fillClass: 'fill-neutral-400', strokeClass: 'stroke-neutral-400', textClass: 'text-neutral-400' },
  { name: 'Stone', bgClass: 'bg-stone-400', fillClass: 'fill-stone-400', strokeClass: 'stroke-stone-400', textClass: 'text-stone-400' }
]
const generatedQr = computed(() => {
  if (!qrStore.content) {
    return {
      code: undefined,
      error: 'Enter a URL to generate a QR code.'
    }
  }

  try {
    const code = createQrCode(qrStore.content)

    return {
      code,
      error: ''
    }
  } catch (error) {
    return {
      code: undefined,
      error: error instanceof Error ? error.message : 'Unable to generate this QR code.'
    }
  }
})

const qrPath = computed(() => generatedQr.value.code ? createQrSvgPath(generatedQr.value.code, 0) : '')
const qrSvgSize = computed(() => generatedQr.value.code ? generatedQr.value.code.size : 1)
const qrFillClass = computed(() => selectedQrColor.value ? getTailwindColorClass(selectedQrColor.value, 'fill') : 'fill-black')
const qrStrokeClass = computed(() => selectedQrColor.value ? getTailwindColorClass(selectedQrColor.value, 'stroke') : 'stroke-black')
const qrTextClass = computed(() => selectedQrColor.value ? getTailwindColorClass(selectedQrColor.value, 'text') : 'text-black')
const selectedCenterIconOption = computed(() => centerIconOptions.find(icon => icon.value === selectedCenterIcon.value) ?? noCenterIconOption)
const hasCenterIcon = computed(() => selectedCenterIconOption.value.src.length > 0)
const centerIconSearchTerm = computed(() => centerIconSearch.value.trim().toLowerCase())
const hasCenterIconSearch = computed(() => centerIconSearchTerm.value.length > 0)
const filteredCenterIconOptions = computed(() => {
  if (!hasCenterIconSearch.value) {
    return []
  }

  return centerIconOptions
    .filter(icon => icon.value !== 'none')
    .filter(icon => getCenterIconSearchText(icon).includes(centerIconSearchTerm.value))
})
const activeCenterIconCategoryDetails = computed(() => centerIconCategories.find(category => category.value === activeCenterIconCategory.value))
const activeCenterIconCategoryIcons = computed(() => activeCenterIconCategoryDetails.value?.icons ?? [])
const labelText = computed(() => qrLabel.value.trim())
const selectedLabelFontClass = computed(() => labelFonts.find(font => font.value === selectedLabelFont.value)?.class ?? fallbackLabelFont.class)
const selectedBorderStyle = computed(() => borderStyles.find(border => border.value === selectedBorder.value) ?? noBorderStyle)
const hasBorder = computed(() => selectedBorderStyle.value.lines.length > 0)
const labelHasDescender = computed(() => /[gjpqy]/.test(labelText.value))
const labelIsTop = computed(() => labelText.value.length > 0 && selectedLabelPosition.value === 'top')
const labelIsBottom = computed(() => labelText.value.length > 0 && selectedLabelPosition.value === 'bottom')
const borderContentInset = computed(() => {
  if (!hasBorder.value) {
    return 0
  }

  const innerBorderEdge = Math.max(...selectedBorderStyle.value.lines.map(line => line.inset + line.strokeWidth / 2))

  return innerBorderEdge + selectedBorderStyle.value.contentGap
})
const qrOutputSize = computed(() => qrSvgSize.value)
const baseLabelFontSize = computed(() => qrOutputSize.value * 0.2)
const labelFontSize = computed(() => baseLabelFontSize.value * labelFontScale.value)
const labelGap = computed(() => labelText.value ? hasBorder.value ? selectedBorderStyle.value.contentGap : 1 : 0)
const labelBlockHeight = computed(() => labelText.value ? labelFontSize.value : 0)
const topLabelHeight = computed(() => labelIsTop.value ? labelBlockHeight.value : 0)
const bottomLabelHeight = computed(() => labelIsBottom.value ? labelBlockHeight.value : 0)
const topLabelGap = computed(() => labelIsTop.value ? labelGap.value : 0)
const bottomLabelGap = computed(() => labelIsBottom.value ? labelGap.value : 0)
const labelBottomTrim = computed(() => labelIsBottom.value && hasBorder.value && !labelHasDescender.value ? labelFontSize.value * 0.18 : 0)
const qrOutputX = computed(() => borderContentInset.value)
const qrOutputY = computed(() => borderContentInset.value + topLabelHeight.value + topLabelGap.value)
const centerIconCircleDiameter = computed(() => 7)
const centerIconCircleRadius = computed(() => centerIconCircleDiameter.value / 2)
const centerIconSize = computed(() => centerIconCircleDiameter.value * 0.68)
const centerIconX = computed(() => qrOutputX.value + qrOutputSize.value / 2 - centerIconSize.value / 2)
const centerIconY = computed(() => qrOutputY.value + qrOutputSize.value / 2 - centerIconSize.value / 2)
const outputSvgWidth = computed(() => qrSvgSize.value + borderContentInset.value * 2)
const outputBottomInset = computed(() => hasBorder.value ? borderContentInset.value : bottomLabelGap.value)
const outputSvgHeight = computed(() => borderContentInset.value + topLabelHeight.value + topLabelGap.value + qrOutputSize.value + bottomLabelGap.value + bottomLabelHeight.value + outputBottomInset.value - labelBottomTrim.value)
const outputViewBox = computed(() => generatedQr.value.code ? `0 0 ${outputSvgWidth.value} ${outputSvgHeight.value}` : '0 0 1 1')
const labelY = computed(() => labelIsTop.value ? borderContentInset.value + labelBlockHeight.value / 2 : qrOutputY.value + qrOutputSize.value + bottomLabelGap.value + labelBlockHeight.value / 2)
const selectedBorderLines = computed(() => selectedBorderStyle.value.lines.map(line => ({
  ...line,
  height: outputSvgHeight.value - line.inset * 2,
  width: outputSvgWidth.value - line.inset * 2
})))

async function selectTool(tool: QrTool) {
  if (tool === 'step' && !selectedQrColor.value) {
    return
  }

  activeTool.value = tool

  if (tool !== 'colors') {
    hasColorsBefore.value = false
    hasColorsAfter.value = false
    return
  }

  await nextTick()
  updateColorScrollState()
}

function selectBlackColor() {
  selectedQrColor.value = null
  selectedColorStep.value = 500

  if (activeTool.value === 'step') {
    activeTool.value = 'colors'
  }
}

function selectQrColor(color: TailwindColor) {
  if (!selectedQrColor.value) {
    selectedColorStep.value = 500
  }

  selectedQrColor.value = color
}

function getTailwindColorClass(color: TailwindColor, utility: TailwindColorUtility) {
  return `${utility}-${color.name.toLowerCase()}-${selectedColorStep.value}`
}

function selectBorder(border: BorderStyle) {
  selectedBorder.value = border.value
}

function selectLabelPosition(option: LabelPositionOption) {
  if (option.disabled) {
    return
  }

  selectedLabelPosition.value = option.value
}

function selectCenterIcon(icon: CenterIconOption) {
  selectedCenterIcon.value = icon.value
}

function selectCenterIconCategory(category: CenterIconCategory) {
  activeCenterIconCategory.value = category.value
}

function showCenterIconCategories() {
  activeCenterIconCategory.value = null
}

function createCenterIconOption(categoryValue: string, categoryLabel: string, label: string, fileName: string): CenterIconOption {
  return {
    label,
    value: `${categoryValue}/${fileName}`,
    src: `/icons/center/${categoryValue}/${fileName}.svg`,
    categoryLabel
  }
}

function getCenterIconSearchText(icon: CenterIconOption) {
  return `${icon.categoryLabel} ${icon.label} ${icon.value}`.toLowerCase()
}

async function updateLabelFontScale() {
  await nextTick()

  const element = labelMeasureElement.value

  if (!element || !labelText.value) {
    labelFontScale.value = 1
    return
  }

  const labelWidth = element.getComputedTextLength()

  labelFontScale.value = labelWidth > 0 ? Math.min(1, qrOutputSize.value / labelWidth) : 1
}

function getLabelFont(value: unknown) {
  return labelFonts.find(font => font.value === value) ?? fallbackLabelFont
}

function getLabelFontFromItem(item: unknown) {
  if (typeof item === 'object' && item && 'value' in item) {
    return getLabelFont(item.value)
  }

  return getLabelFont(item)
}

function getPreviewPath(line: BorderLine) {
  const start = 4 + line.inset * 2

  return `M${start} 24V${start}H24`
}

function getPreviewStrokeWidth(line: BorderLine) {
  return line.strokeWidth * 2
}

function updateColorScrollState() {
  const scroller = colorScroller.value

  if (!scroller) {
    hasColorsBefore.value = false
    hasColorsAfter.value = false
    return
  }

  const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth

  hasColorsBefore.value = scroller.scrollLeft > 1
  hasColorsAfter.value = scroller.scrollLeft < maxScrollLeft - 1
}

onMounted(async () => {
  await nextTick()
  updateColorScrollState()
  window.addEventListener('resize', updateColorScrollState)

  await updateLabelFontScale()
  void document.fonts?.ready.then(updateLabelFontScale)
})

watch([labelText, selectedLabelFont, qrOutputSize], updateLabelFontScale, { flush: 'post' })

onUnmounted(() => {
  window.removeEventListener('resize', updateColorScrollState)
})
</script>

<template>
  <UContainer class="flex min-h-[calc(100svh-4rem)] max-w-3xl flex-col gap-4 py-4 sm:gap-6 sm:py-6">
    <UCard>
      <UFormField label="URL">
        <UInput
          v-model="qrStore.url"
          autofocus
          class="w-full"
          icon="i-lucide-link"
          size="xl"
          type="url"
        />
      </UFormField>
    </UCard>

    <div class="space-y-3">
      <div
        aria-label="QR code tools"
        class="flex flex-wrap items-center gap-2"
        role="toolbar"
      >
        <UFieldGroup>
          <UButton
            :aria-pressed="activeTool === 'colors'"
            :color="activeTool === 'colors' ? 'primary' : 'neutral'"
            icon="i-lucide-palette"
            :variant="activeTool === 'colors' ? 'solid' : 'subtle'"
            @click="selectTool('colors')"
          >
            Colors
          </UButton>
          <UButton
            v-if="selectedQrColor"
            :aria-pressed="activeTool === 'step'"
            :color="activeTool === 'step' ? 'primary' : 'neutral'"
            icon="i-lucide-lab-stairs"
            :variant="activeTool === 'step' ? 'solid' : 'subtle'"
            @click="selectTool('step')"
          >
            Steps
          </UButton>
        </UFieldGroup>
        <UButton
          :aria-pressed="activeTool === 'label'"
          :color="activeTool === 'label' ? 'primary' : 'neutral'"
          icon="i-lucide-type"
          :variant="activeTool === 'label' ? 'solid' : 'subtle'"
          @click="selectTool('label')"
        >
          Label
        </UButton>
        <UButton
          :aria-pressed="activeTool === 'icon'"
          :color="activeTool === 'icon' ? 'primary' : 'neutral'"
          icon="i-lucide-image"
          :variant="activeTool === 'icon' ? 'solid' : 'subtle'"
          @click="selectTool('icon')"
        >
          Icon
        </UButton>
        <UButton
          :aria-pressed="activeTool === 'border'"
          :color="activeTool === 'border' ? 'primary' : 'neutral'"
          icon="i-lucide-square"
          :variant="activeTool === 'border' ? 'solid' : 'subtle'"
          @click="selectTool('border')"
        >
          Border
        </UButton>
      </div>

      <div
        v-if="activeTool === 'colors'"
        class="relative"
      >
        <div
          ref="colorScroller"
          class="flex gap-2 overflow-x-auto overscroll-x-contain pb-2"
          @scroll="updateColorScrollState"
        >
          <button
            aria-label="Use Black for the QR code"
            :aria-pressed="!selectedQrColor"
            class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition"
            :class="!selectedQrColor ? 'border-primary bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
            type="button"
            @click="selectBlackColor"
          >
            <span
              aria-hidden="true"
              class="size-4 rounded-full bg-black ring-1 ring-black/10"
            />
            <span>Black</span>
          </button>

          <button
            v-for="color in tailwindColors"
            :key="color.name"
            :aria-label="`Use ${color.name} for the QR code`"
            :aria-pressed="selectedQrColor?.name === color.name"
            class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition"
            :class="selectedQrColor?.name === color.name ? 'border-primary bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
            type="button"
            @click="selectQrColor(color)"
          >
            <span
              aria-hidden="true"
              class="size-4 rounded-full ring-1 ring-black/10"
              :class="getTailwindColorClass(color, 'bg')"
            />
            <span>{{ color.name }}</span>
          </button>
        </div>

        <div
          v-if="hasColorsBefore"
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--ui-bg)] to-transparent"
        />
        <div
          v-if="hasColorsAfter"
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--ui-bg)] to-transparent"
        />
      </div>

      <div
        v-else-if="activeTool === 'step'"
        class="rounded-lg border border-default bg-default p-4"
      >
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="font-medium text-highlighted">Color step</span>
          <span class="text-muted">{{ selectedQrColor?.name }} {{ selectedColorStep }}</span>
        </div>

        <USlider
          v-model="selectedColorStep"
          class="mt-4"
          :max="900"
          :min="100"
          :step="100"
          :tooltip="true"
        />

        <div class="mt-2 flex justify-between text-xs text-muted">
          <span
            v-for="step in tailwindColorSteps"
            :key="step"
          >
            {{ step }}
          </span>
        </div>
      </div>

      <div
        v-else-if="activeTool === 'label'"
        class="space-y-3"
      >
        <div class="grid grid-cols-[minmax(0,1fr)_10rem] gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <UFormField label="Label">
            <UInput
              v-model="qrLabel"
              class="w-full"
              icon="i-lucide-type"
              placeholder="Add a word"
              size="lg"
            />
          </UFormField>

          <UFormField label="Font">
            <USelect
              v-model="selectedLabelFont"
              class="w-full"
              :items="labelFontItems"
              size="lg"
            >
              <template #default="{ modelValue }">
                <span :class="getLabelFont(modelValue).class">
                  {{ getLabelFont(modelValue).label }}
                </span>
              </template>

              <template #item-label="{ item }">
                <span :class="getLabelFontFromItem(item).class">
                  {{ getLabelFontFromItem(item).label }}
                </span>
              </template>
            </USelect>
          </UFormField>
        </div>

        <UFormField label="Position">
          <div
            aria-label="Label position"
            class="flex flex-wrap gap-2"
            role="radiogroup"
          >
            <button
              v-for="option in labelPositionOptions"
              :key="option.value"
              :aria-checked="selectedLabelPosition === option.value"
              :aria-disabled="option.disabled"
              class="rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45"
              :class="selectedLabelPosition === option.value ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
              :disabled="option.disabled"
              role="radio"
              type="button"
              @click="selectLabelPosition(option)"
            >
              {{ option.label }}
            </button>
          </div>
        </UFormField>
      </div>

      <div
        v-else-if="activeTool === 'icon'"
        aria-label="Center icon"
        class="space-y-3"
      >
        <UInput
          v-model="centerIconSearch"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Search icons"
          size="lg"
        />

        <div
          v-if="hasCenterIconSearch"
          aria-label="Matching center icons"
          class="flex gap-2 overflow-x-auto overscroll-x-contain pb-2"
          role="radiogroup"
        >
          <button
            v-for="icon in filteredCenterIconOptions"
            :key="icon.value"
            :aria-label="`Use ${icon.label} as the center icon`"
            :aria-checked="selectedCenterIcon === icon.value"
            class="flex min-w-24 shrink-0 flex-col items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition"
            :class="selectedCenterIcon === icon.value ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
            role="radio"
            type="button"
            @click="selectCenterIcon(icon)"
          >
            <span class="grid size-10 place-items-center rounded-full bg-white p-1.5 ring-1 ring-black/10">
              <img
                :src="icon.src"
                alt=""
                aria-hidden="true"
                class="size-full object-contain"
              >
            </span>
            <span>{{ icon.label }}</span>
          </button>

          <p
            v-if="filteredCenterIconOptions.length === 0"
            class="py-2 text-sm text-muted"
          >
            No icons match your search.
          </p>
        </div>

        <div
          v-else-if="!activeCenterIconCategory"
          aria-label="Center icon folders"
          class="flex gap-2 overflow-x-auto overscroll-x-contain pb-2"
        >
          <button
            :aria-checked="selectedCenterIcon === 'none'"
            aria-label="Use no center icon"
            class="flex min-w-24 shrink-0 flex-col items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition"
            :class="selectedCenterIcon === 'none' ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
            role="radio"
            type="button"
            @click="selectCenterIcon(noCenterIconOption)"
          >
            <span
              aria-hidden="true"
              class="grid size-10 place-items-center rounded-full bg-white text-slate-400 ring-1 ring-black/10"
            >
              <UIcon
                name="i-lucide-ban"
                class="size-5"
              />
            </span>
            <span>None</span>
          </button>

          <button
            v-for="category in centerIconCategories"
            :key="category.value"
            :aria-label="`Open ${category.label} icons`"
            class="flex min-w-24 shrink-0 flex-col items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition"
            :class="selectedCenterIconOption.categoryLabel === category.label ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
            type="button"
            @click="selectCenterIconCategory(category)"
          >
            <span class="grid size-10 place-items-center rounded-full bg-white p-1.5 ring-1 ring-black/10">
              <img
                :src="category.src"
                alt=""
                aria-hidden="true"
                class="size-full object-contain"
              >
            </span>
            <span>{{ category.label }}</span>
          </button>
        </div>

        <div
          v-else
          class="space-y-3"
        >
          <div class="flex items-center gap-3">
            <UButton
              color="neutral"
              icon="i-lucide-arrow-left"
              size="sm"
              variant="subtle"
              @click="showCenterIconCategories"
            >
              Folders
            </UButton>
            <span class="text-sm font-medium text-highlighted">{{ activeCenterIconCategoryDetails?.label }}</span>
          </div>

          <div
            aria-label="Center icons in folder"
            class="flex gap-2 overflow-x-auto overscroll-x-contain pb-2"
            role="radiogroup"
          >
            <button
              v-for="icon in activeCenterIconCategoryIcons"
              :key="icon.value"
              :aria-label="`Use ${icon.label} as the center icon`"
              :aria-checked="selectedCenterIcon === icon.value"
              class="flex min-w-24 shrink-0 flex-col items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition"
              :class="selectedCenterIcon === icon.value ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
              role="radio"
              type="button"
              @click="selectCenterIcon(icon)"
            >
              <span class="grid size-10 place-items-center rounded-full bg-white p-1.5 ring-1 ring-black/10">
                <img
                  :src="icon.src"
                  alt=""
                  aria-hidden="true"
                  class="size-full object-contain"
                >
              </span>
              <span>{{ icon.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <div
        v-else-if="activeTool === 'border'"
        aria-label="Border style"
        class="flex gap-2 overflow-x-auto overscroll-x-contain pb-2"
        role="radiogroup"
      >
        <button
          v-for="border in borderStyles"
          :key="border.value"
          :aria-label="border.label"
          :aria-checked="selectedBorder === border.value"
          class="grid size-14 shrink-0 place-items-center rounded-xl border transition"
          :class="selectedBorder === border.value ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
          role="radio"
          type="button"
          @click="selectBorder(border)"
        >
          <svg
            aria-hidden="true"
            class="size-9"
            fill="none"
            viewBox="0 0 28 28"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              v-for="line in border.lines"
              :key="`${border.value}-${line.inset}`"
              :d="getPreviewPath(line)"
              stroke="currentColor"
              stroke-linecap="square"
              stroke-linejoin="miter"
              :stroke-width="getPreviewStrokeWidth(line)"
            />
          </svg>
        </button>
      </div>
    </div>

    <UAlert
      v-if="generatedQr.error"
      color="warning"
      icon="i-lucide-triangle-alert"
      :title="generatedQr.error"
      variant="subtle"
    />

    <section class="flex min-h-0 flex-1 items-center justify-center">
      <UCard class="w-full max-w-[min(86svw,68svh)]">
        <div class="w-full rounded-lg bg-white">
          <svg
            v-if="generatedQr.code"
            aria-label="Generated QR code"
            class="h-auto w-full"
            role="img"
            :viewBox="outputViewBox"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              class="fill-white"
              :height="outputSvgHeight"
              :width="outputSvgWidth"
            />
            <g shape-rendering="crispEdges">
              <svg
                :height="qrOutputSize"
                :viewBox="`0 0 ${qrSvgSize} ${qrSvgSize}`"
                :width="qrOutputSize"
                :x="qrOutputX"
                :y="qrOutputY"
              >
                <path
                  :class="qrFillClass"
                  :d="qrPath"
                />
              </svg>
            </g>
            <template v-if="hasCenterIcon">
              <circle
                class="fill-white"
                :cx="qrOutputX + qrOutputSize / 2"
                :cy="qrOutputY + qrOutputSize / 2"
                :r="centerIconCircleRadius"
              />
              <image
                :href="selectedCenterIconOption.src"
                :height="centerIconSize"
                preserveAspectRatio="xMidYMid meet"
                :width="centerIconSize"
                :x="centerIconX"
                :y="centerIconY"
              />
            </template>
            <text
              v-if="labelText"
              ref="labelMeasureElement"
              aria-hidden="true"
              fill="currentColor"
              :font-size="baseLabelFontSize"
              opacity="0"
              :class="[qrTextClass, selectedLabelFontClass]"
            >
              {{ labelText }}
            </text>
            <text
              v-if="labelText"
              fill="currentColor"
              :font-size="labelFontSize"
              :x="outputSvgWidth / 2"
              :y="labelY"
              dominant-baseline="central"
              text-anchor="middle"
              :class="[qrTextClass, selectedLabelFontClass]"
            >
              {{ labelText }}
            </text>
            <rect
              v-for="line in selectedBorderLines"
              :key="`${selectedBorder}-${line.inset}`"
              fill="none"
              :height="line.height"
              :width="line.width"
              :x="line.inset"
              :y="line.inset"
              :class="qrStrokeClass"
              :stroke-width="line.strokeWidth"
            />
          </svg>

          <div
            v-else
            class="grid aspect-square w-full place-items-center rounded-lg border border-dashed border-default text-center text-sm text-muted"
          >
            Enter a URL to preview the QR code.
          </div>
        </div>
      </UCard>
    </section>

    <div
      v-if="generatedQr.code"
      class="flex items-center justify-center gap-2 text-sm text-muted"
    >
      <UIcon name="i-lucide-scan-line" />
      <span>Version {{ generatedQr.code.version }} · {{ generatedQr.code.size }}×{{ generatedQr.code.size }} modules</span>
    </div>
  </UContainer>
</template>
