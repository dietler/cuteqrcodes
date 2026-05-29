<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useSession } from '~~/lib/auth-client'
import { createDynamicQrRedirectUrl, createRandomDynamicQrSlug, isValidDynamicQrSlug, normalizeDynamicQrSlug, type DynamicQrLinkPayload, type DynamicQrLinkResponse, type DynamicQrSlugAvailabilityResponse } from '~/utils/dynamic-qr'
import { labelPrintPayloadStorageKey, type LabelPrintPayload } from '~/utils/label-print'
import { createQrCode, createQrSvgPath } from '~/utils/qr'
import { currentQrDraftStorageKey, editQrPayloadStorageKey, type CircleLabelOrientation, type CircleLabelPlacement, type CircleLabelPayload, type SavedQrPayload } from '~/utils/saved-qr'
import { embedUsedSvgFontFaces, inlineComputedSvgStyles, inlineSvgImages } from '~/utils/svg-export'

type QrTool = 'shape' | 'colors' | 'step' | 'gradient' | 'label' | 'icon' | 'border'
type QrShape = 'rectangle' | 'circle'
type BorderValue = 'none' | 'hairline' | 'thin' | 'thick' | 'double' | 'wavy'
type CenterIconValue = string
type AdditionalTextPlacement = 'above' | 'below'
type LabelPosition = 'top' | 'left' | 'right' | 'bottom'
type TailwindColorUtility = 'bg' | 'fill' | 'stroke' | 'text'
type GradientStyle = 'none' | 'directional' | 'radial'
type GradientDirection = 'left-to-right' | 'top-to-bottom' | 'diagonal'

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

type GradientStyleOption = {
  label: string
  value: GradientStyle
  icon: string
}

type GradientDirectionOption = {
  label: string
  value: GradientDirection
  icon: string
}

type QrShapeOption = {
  label: string
  value: QrShape
  icon: string
}

type CircleLabelControl = {
  label: string
  placeholder: string
  value: CircleLabelPlacement
}

type CircleLabelArc = {
  start: number
  end: number
  sweep: 0 | 1
}

type CircleLabelPathSide = 'left' | 'right'

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
  categories?: CenterIconCategory[]
}

type BorderLine = {
  inset: number
  strokeWidth: number
  wave?: BorderWave
}

type BorderWave = {
  amplitude: number
  cornerRadius: number
  length: number
}

type BorderStyle = {
  label: string
  value: BorderValue
  lines: BorderLine[]
  contentGap: number
}

type GradientBox = {
  x: number
  y: number
  width: number
  height: number
}

type LinearGradientCoordinates = {
  x1: number
  y1: number
  x2: number
  y2: number
}

type RadialGradientCoordinates = {
  cx: number
  cy: number
  r: number
}

type CurrentQrDraftPayload = SavedQrPayload & {
  activeCenterIconCategory?: string | null
  activeTool?: QrTool | null
  centerIconSearch?: string
}
type DynamicLinkAvailabilityStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error'

const qrStore = useQrStore()
const session = useSession()

const useDynamicUrl = ref(false)
const trackScanStatistics = ref(false)
const dynamicLinkSlug = ref('')
const isCustomizingDynamicLink = ref(false)
const dynamicLinkError = ref('')
const dynamicLinkAvailabilityStatus = ref<DynamicLinkAvailabilityStatus>('idle')
const dynamicLinkAvailabilityMessage = ref('')
const isSavingDynamicLink = ref(false)
const activeDynamicLink = ref<DynamicQrLinkPayload | null>(null)
const activeTool = ref<QrTool | null>(null)
const selectedQrColor = ref<TailwindColor | null>(null)
const colorScroller = ref<HTMLElement | null>(null)
const iconScroller = ref<HTMLElement | null>(null)
const outputSvgElement = ref<SVGSVGElement | null>(null)
const labelMeasureElement = ref<SVGTextElement | null>(null)
const additionalTextMeasureElement = ref<SVGTextElement | null>(null)
const labelTextWidth = ref(0)
const additionalTextLineWidth = ref(0)
const hasColorsBefore = ref(false)
const hasColorsAfter = ref(false)
const hasIconsBefore = ref(false)
const hasIconsAfter = ref(false)
const mobileScrollDesktopWrapClasses = 'flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 md:flex-wrap md:overflow-x-visible md:pb-0'
const mobileLabelSectionUi = {
  label: 'text-base font-bold min-[620px]:text-sm min-[620px]:font-medium'
}
const mobileLabelSectionBoxClasses = 'rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 min-[620px]:rounded-none min-[620px]:border-0 min-[620px]:bg-transparent min-[620px]:p-0 min-[620px]:shadow-none'
const selectedColorStep = ref(500)
const selectedGradientStyle = ref<GradientStyle>('none')
const selectedGradientDirection = ref<GradientDirection>('left-to-right')
const selectedGradientSecondColorName = ref<string | null>(null)
const selectedGradientThirdColorName = ref<string | null>(null)
const selectedQrShape = ref<QrShape>('rectangle')
const labelSizeStep = ref(0)
const additionalTextSizeStep = ref(0)
const qrLabel = ref('')
const qrAdditionalText = ref('')
const selectedAdditionalTextPlacement = ref<AdditionalTextPlacement>('below')
const selectedLabelPosition = ref<LabelPosition>('top')
const selectedCenterIcon = ref<CenterIconValue>('none')
const activeCenterIconCategory = ref<string | null>(null)
const centerIconSearch = ref('')
const isPreparingLabelPrint = ref(false)
const printLabelError = ref('')
const isSaveDialogOpen = ref(false)
const isSavingQr = ref(false)
let isClearingCurrentQrDraft = false
const saveQrName = ref('')
const saveQrTagsInput = ref('')
const saveQrError = ref('')
let dynamicLinkAvailabilityTimer: ReturnType<typeof setTimeout> | null = null
let dynamicLinkAvailabilityRunId = 0
const homepageDescriptionDismissedCookieName = 'cuteqrcodes_home_description_dismissed'
const homepageDescriptionDismissedCookieMaxAge = 60 * 60 * 24 * 365
const dynamicLinkAvailabilityCheckDelayMs = 350
const homepageDescriptionDismissedCookie = useCookie(homepageDescriptionDismissedCookieName, {
  decode: value => value,
  encode: value => String(value),
  maxAge: homepageDescriptionDismissedCookieMaxAge,
  path: '/',
  sameSite: 'lax'
})

const tailwindColorSteps = [100, 200, 300, 400, 500, 600, 700, 800, 900]
const blackColorName = 'Black'
const additionalTextLineLength = 40
const preferredAdditionalTextLineLength = 24
const maxAdditionalTextLength = additionalTextLineLength * 3
const minTextSizeStep = -2
const maxAdditionalTextSizeStep = 4
const versionOneQrSize = 21
const versionOneCenterIconCircleDiameter = 7
const circleBorderCornerInsetRatio = (Math.SQRT2 - 1) / 2
const sideLabelTextInsetRatio = 0.04
const stackedLabelAdditionalTextGapRatio = 0.12
const sideLabelAdditionalTextGapRatio = 0.18

const labelFonts: LabelFont[] = [
  { label: 'Google Sans', value: 'google-sans', class: 'font-google-sans' },
  { label: 'Bebas Neue', value: 'bebas-neue', class: 'font-bebas-neue' },
  { label: 'Oswald', value: 'oswald', class: 'font-oswald' },
  { label: 'Roboto', value: 'roboto', class: 'font-roboto' },
  { label: 'Roboto Condensed', value: 'roboto-condensed', class: 'font-roboto-condensed' },
  { label: 'Figtree', value: 'figtree', class: 'font-figtree' },
  { label: 'Baskerville', value: 'libre-baskerville', class: 'font-libre-baskerville' },
  { label: 'Changa One', value: 'changa-one', class: 'font-changa-one' },
  { label: 'Lexend', value: 'lexend', class: 'font-lexend' },
  { label: 'Rye', value: 'rye', class: 'font-rye' },
  { label: 'Sancreek', value: 'sancreek', class: 'font-sancreek' },
  { label: 'Fell Great', value: 'im-fell-great-primer', class: 'font-im-fell-great-primer' },
  { label: 'Creepster', value: 'creepster', class: 'font-creepster' },
  { label: 'Jersey', value: 'jersey-25', class: 'font-jersey-25' }
]
const fallbackLabelFont = labelFonts[0]!
const selectedLabelFont = ref(fallbackLabelFont.value)
const selectedAdditionalTextFont = ref(fallbackLabelFont.value)
const circleLabelTop = ref('')
const circleLabelBottom = ref('')
const circleLabelLeft = ref('')
const circleLabelRight = ref('')
const selectedCircleLabelTopFont = ref(fallbackLabelFont.value)
const selectedCircleLabelBottomFont = ref(fallbackLabelFont.value)
const selectedCircleLabelLeftFont = ref(fallbackLabelFont.value)
const selectedCircleLabelRightFont = ref(fallbackLabelFont.value)
const circleLabelTopSizeStep = ref(0)
const circleLabelBottomSizeStep = ref(0)
const circleLabelLeftSizeStep = ref(0)
const circleLabelRightSizeStep = ref(0)
const circleLabelTopOrientation = ref<CircleLabelOrientation>('up')
const circleLabelBottomOrientation = ref<CircleLabelOrientation>('down')
const circleLabelLeftOrientation = ref<CircleLabelOrientation>('up')
const circleLabelRightOrientation = ref<CircleLabelOrientation>('down')
const labelFontItems = labelFonts.map(font => ({ label: font.label, value: font.value, class: font.class }))
const labelPositionOptions: LabelPositionOption[] = [
  { label: 'Top', value: 'top', disabled: false },
  { label: 'Bottom', value: 'bottom', disabled: false },
  { label: 'Right', value: 'right', disabled: false },
  { label: 'Left', value: 'left', disabled: false }
]
const qrShapeOptions: QrShapeOption[] = [
  { label: 'Rectangle/Square', value: 'rectangle', icon: 'i-lucide-square' },
  { label: 'Circle', value: 'circle', icon: 'i-lucide-circle' }
]
const circleLabelControls: CircleLabelControl[] = [
  { label: 'Top', placeholder: 'Top text', value: 'top' },
  { label: 'Bottom', placeholder: 'Bottom text', value: 'bottom' },
  { label: 'Left', placeholder: 'Left text', value: 'left' },
  { label: 'Right', placeholder: 'Right text', value: 'right' }
]
const gradientStyleOptions: GradientStyleOption[] = [
  { label: 'No Gradient', value: 'none', icon: 'i-lucide-ban' },
  { label: 'Directional', value: 'directional', icon: 'i-lucide-arrow-right' },
  { label: 'Radial', value: 'radial', icon: 'i-lucide-circle-dot' }
]
const gradientDirectionOptions: GradientDirectionOption[] = [
  { label: 'Left to Right', value: 'left-to-right', icon: 'i-lucide-arrow-right' },
  { label: 'Top to Bottom', value: 'top-to-bottom', icon: 'i-lucide-arrow-down' },
  { label: 'Diagonal', value: 'diagonal', icon: 'i-lucide-arrow-down-right' }
]
const noCenterIconOption: CenterIconOption = { label: 'None', value: 'none', src: '', categoryLabel: '' }
const centerIconCategories: CenterIconCategory[] = [
  {
    label: 'Website',
    value: 'website',
    src: '/icons/center/website/index.svg',
    icons: [
      createCenterIconOption('website', 'Website', 'Link', 'link'),
      createCenterIconOption('website', 'Website', 'Website', 'website'),
      createCenterIconOption('website', 'Website', 'Globe', 'globe'),
      createCenterIconOption('website', 'Website', 'Store', 'store')
    ]
  },
  {
    label: 'Apps',
    value: 'apps',
    src: '/icons/center/apps/index.svg',
    icons: [
      createCenterIconOption('apps', 'Apps', 'App Store', 'app-store'),
      createCenterIconOption('apps', 'Apps', 'Play Store', 'play-store')
    ]
  },
  {
    label: 'Chat',
    value: 'chat',
    src: '/icons/center/chat/index.svg',
    icons: [
      createCenterIconOption('chat', 'Chat', 'Line', 'line'),
      createCenterIconOption('chat', 'Chat', 'Messenger', 'messenger'),
      createCenterIconOption('chat', 'Chat', 'Telegram', 'telegram'),
      createCenterIconOption('chat', 'Chat', 'WhatsApp', 'whatsapp')
    ]
  },
  {
    label: 'Faces',
    value: 'faces',
    src: '/icons/center/faces/index.svg',
    icons: [
      createCenterIconOption('faces', 'Faces', 'Smile', 'smile'),
      createCenterIconOption('faces', 'Faces', 'Laugh', 'laugh'),
      createCenterIconOption('faces', 'Faces', 'Wink', 'wink')
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
      createCenterIconOption('restaurant', 'Restaurant', 'Dessert', 'dessert'),
      createCenterIconOption('restaurant', 'Restaurant', 'Pastry', 'pastry'),
      createCenterIconOption('restaurant', 'Restaurant', 'Salad', 'salad'),
      createCenterIconOption('restaurant', 'Restaurant', 'Wine', 'wine'),
      createCenterIconOption('restaurant', 'Restaurant', 'Cocktail', 'cocktail'),
      createCenterIconOption('restaurant', 'Restaurant', 'Beer', 'beer')
    ],
    categories: [
      {
        label: 'Delivery',
        value: 'restaurant/delivery',
        src: '/icons/center/restaurant/delivery/index.svg',
        icons: [
          createCenterIconOption('restaurant/delivery', 'Restaurant Delivery', 'DoorDash', 'doordash'),
          createCenterIconOption('restaurant/delivery', 'Restaurant Delivery', 'Grubhub', 'grubhub'),
          createCenterIconOption('restaurant/delivery', 'Restaurant Delivery', 'Uber Eats', 'ubereats')
        ]
      }
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
    label: 'Mystery',
    value: 'mystery',
    src: '/icons/center/mystery/index.svg',
    icons: [
      createCenterIconOption('mystery', 'Mystery', 'Clue', 'clue'),
      createCenterIconOption('mystery', 'Mystery', 'Padlock', 'padlock'),
      createCenterIconOption('mystery', 'Mystery', 'Puzzle', 'puzzle'),
      createCenterIconOption('mystery', 'Mystery', 'Question Mark', 'question-mark')
    ]
  },
  {
    label: 'Legal',
    value: 'legal',
    src: '/icons/center/legal/index.svg',
    icons: [
      createCenterIconOption('legal', 'Legal', 'Document', 'document'),
      createCenterIconOption('legal', 'Legal', 'Waiver', 'waiver'),
      createCenterIconOption('legal', 'Legal', 'Signature', 'signature')
    ]
  },
  {
    label: 'Review',
    value: 'review',
    src: '/icons/center/review/index.svg',
    icons: [
      createCenterIconOption('review', 'Review', 'Feedback', 'feedback'),
      createCenterIconOption('review', 'Review', 'Google Maps', 'google-maps'),
      createCenterIconOption('review', 'Review', 'Review', 'review'),
      createCenterIconOption('review', 'Review', 'Yelp', 'yelp')
    ]
  },
  {
    label: 'Rewards',
    value: 'rewards',
    src: '/icons/center/rewards/index.svg',
    icons: [
      createCenterIconOption('rewards', 'Rewards', 'Gift', 'gift'),
      createCenterIconOption('rewards', 'Rewards', 'Trophy', 'trophy')
    ]
  },
  {
    label: 'Music',
    value: 'music',
    src: '/icons/center/music/index.svg',
    icons: [
      createCenterIconOption('music', 'Music', 'Apple Music', 'apple-music'),
      createCenterIconOption('music', 'Music', 'Spotify', 'spotify'),
      createCenterIconOption('music', 'Music', 'YouTube', 'youtube')
    ]
  },
  {
    label: 'Social Media',
    value: 'social-media',
    src: '/icons/center/social-media/index.svg',
    icons: [
      createCenterIconOption('social-media', 'Social Media', 'Discord', 'discord'),
      createCenterIconOption('social-media', 'Social Media', 'Instagram', 'instagram'),
      createCenterIconOption('social-media', 'Social Media', 'Facebook', 'facebook'),
      createCenterIconOption('social-media', 'Social Media', 'LinkedIn', 'linkedin'),
      createCenterIconOption('social-media', 'Social Media', 'Slack', 'slack'),
      createCenterIconOption('social-media', 'Social Media', 'Snapchat', 'snapchat'),
      createCenterIconOption('social-media', 'Social Media', 'TikTok', 'tik-tok'),
      createCenterIconOption('social-media', 'Social Media', 'YouTube', 'youtube'),
      createCenterIconOption('social-media', 'Social Media', 'X', 'x')
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
      createCenterIconOption('payment', 'Payment', 'Cash App', 'cash-app'),
      createCenterIconOption('payment', 'Payment', 'Euro', 'euro'),
      createCenterIconOption('payment', 'Payment', 'Dollar', 'dollar'),
      createCenterIconOption('payment', 'Payment', 'PayPal', 'paypal'),
      createCenterIconOption('payment', 'Payment', 'Receipt', 'receipt'),
      createCenterIconOption('payment', 'Payment', 'Tips', 'tips'),
      createCenterIconOption('payment', 'Payment', 'Venmo', 'venmo')
    ]
  }
]
const centerIconCategoryList = getCenterIconCategories(centerIconCategories)
const centerIconOptions = [noCenterIconOption, ...getCenterIconOptions(centerIconCategories)]
const selectedCenterIconOption = computed(() => centerIconOptions.find(icon => icon.value === selectedCenterIcon.value) ?? noCenterIconOption)
const hasCenterIcon = computed(() => selectedCenterIconOption.value.src.length > 0)

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
  },
  {
    label: 'Wavy border',
    value: 'wavy',
    lines: [{ inset: 0.75, strokeWidth: 0.5, wave: { amplitude: 0.425, cornerRadius: 2.4, length: 4 } }],
    contentGap: 1.25
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
const hasQrContent = computed(() => qrStore.content.length > 0)
const shouldShowHomepageDescription = computed(() => homepageDescriptionDismissedCookie.value !== '1')
const isLoggedIn = computed(() => Boolean(session.value.data?.user))
const hasDynamicQrFeature = computed(() => useDynamicUrl.value || trackScanStatistics.value)
const shouldShowDynamicQrControls = computed(() => hasQrContent.value)
const dynamicLinkCreditCost = computed(() => Number(useDynamicUrl.value) + Number(trackScanStatistics.value))
const normalizedDynamicLinkSlug = computed(() => normalizeDynamicQrSlug(dynamicLinkSlug.value))
const dynamicLinkRedirectUrl = computed(() => createDynamicQrRedirectUrl(normalizedDynamicLinkSlug.value || 'guid'))
const qrContent = computed(() => hasDynamicQrFeature.value ? dynamicLinkRedirectUrl.value : qrStore.content)
const dynamicLinkFeatureDescription = computed(() => {
  if (useDynamicUrl.value && trackScanStatistics.value) {
    return 'Your QR code will scan to this redirect link. We will send visitors to the URL above, let you update that destination later, and record scan time plus IP-based location.'
  }

  if (useDynamicUrl.value) {
    return 'Your QR code will scan to this redirect link. We will send visitors to the URL above, and you will be able to update that destination later.'
  }

  return 'Your QR code will scan to this redirect link. We will send visitors to the URL above and record scan time plus IP-based location.'
})
const dynamicLinkCreditMessage = computed(() => {
  const credits = dynamicLinkCreditCost.value

  return credits === 1
    ? 'This costs 1 credit when the link is created. Printable PDFs include this cost at purchase.'
    : `This costs ${credits} credits when the link is created. Printable PDFs include this cost at purchase.`
})
const dynamicLinkAvailabilityMessageClass = computed(() => {
  if (dynamicLinkAvailabilityStatus.value === 'available') {
    return 'text-green-700 dark:text-green-300'
  }

  if (dynamicLinkAvailabilityStatus.value === 'unavailable' || dynamicLinkAvailabilityStatus.value === 'error') {
    return 'text-error'
  }

  return 'text-muted'
})
const canSaveDynamicLinkUpdate = computed(() =>
  isCustomizingDynamicLink.value
  && dynamicLinkAvailabilityStatus.value === 'available'
  && !isSavingDynamicLink.value
  && (activeDynamicLink.value ? !isActiveDynamicLinkCurrent() : true))
const generatedQr = computed(() => {
  if (!hasQrContent.value) {
    return {
      code: undefined,
      error: 'Enter a URL to generate a QR code.'
    }
  }

  try {
    const code = createQrCode(qrContent.value, {
      errorCorrectionLevel: hasCenterIcon.value ? 'high' : 'medium',
      minVersion: hasCenterIcon.value ? 3 : 1
    })

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
const gradientHasFirstColor = computed(() => Boolean(selectedQrColor.value))
const gradientNeedsColors = computed(() => selectedGradientStyle.value !== 'none')
const hasActiveGradient = computed(() => Boolean(gradientHasFirstColor.value && gradientNeedsColors.value && selectedGradientSecondColorName.value))
const qrPathFillPaint = computed(() => hasActiveGradient.value ? 'url(#qr-path-gradient)' : null)
const qrArtworkFillPaint = computed(() => hasActiveGradient.value ? 'url(#qr-artwork-gradient)' : null)
const borderStrokePaint = computed(() => hasActiveGradient.value ? 'url(#qr-border-gradient)' : null)
const textFillPaint = computed(() => hasActiveGradient.value ? 'url(#qr-text-gradient)' : null)
const gradientStops = computed(() => {
  if (!hasActiveGradient.value || !selectedQrColor.value || !selectedGradientSecondColorName.value) {
    return []
  }

  const colorNames = [
    selectedQrColor.value.name,
    selectedGradientSecondColorName.value,
    ...(selectedGradientThirdColorName.value ? [selectedGradientThirdColorName.value] : [])
  ]
  const lastIndex = colorNames.length - 1

  return colorNames.map((colorName, index) => ({
    colorName,
    key: `${colorName}-${index}`,
    offset: `${(index / lastIndex) * 100}%`,
    textClass: getGradientColorTextClass(colorName)
  }))
})
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
const activeCenterIconCategoryDetails = computed(() => centerIconCategoryList.find(category => category.value === activeCenterIconCategory.value))
const activeCenterIconCategoryIcons = computed(() => activeCenterIconCategoryDetails.value?.icons ?? [])
const activeCenterIconSubcategories = computed(() => activeCenterIconCategoryDetails.value?.categories ?? [])
const activeCenterIconParentCategory = computed(() => activeCenterIconCategory.value ? getCenterIconParentCategory(activeCenterIconCategory.value, centerIconCategories) : null)
const activeCenterIconBackLabel = computed(() => activeCenterIconParentCategory.value?.label ?? 'Folders')
const labelText = computed(() => qrLabel.value.trim())
const additionalText = computed(() => qrAdditionalText.value.trim().slice(0, maxAdditionalTextLength))
const additionalTextLines = computed(() => wrapAdditionalText(additionalText.value))
const longestAdditionalTextLine = computed(() => additionalTextLines.value.reduce((longest, line) => line.length > longest.length ? line : longest, ''))
const selectedLabelFontClass = computed(() => labelFonts.find(font => font.value === selectedLabelFont.value)?.class ?? fallbackLabelFont.class)
const selectedAdditionalTextFontClass = computed(() => labelFonts.find(font => font.value === selectedAdditionalTextFont.value)?.class ?? fallbackLabelFont.class)
const selectedBorderStyle = computed(() => borderStyles.find(border => border.value === selectedBorder.value) ?? noBorderStyle)
const hasBorder = computed(() => selectedBorderStyle.value.lines.length > 0)
const isCircleShape = computed(() => selectedQrShape.value === 'circle')
const circleLabelTexts = computed<Record<CircleLabelPlacement, string>>(() => ({
  bottom: circleLabelBottom.value.trim(),
  left: circleLabelLeft.value.trim(),
  right: circleLabelRight.value.trim(),
  top: circleLabelTop.value.trim()
}))
const hasCircleLabelText = computed(() => isCircleShape.value && Object.values(circleLabelTexts.value).some(text => text.length > 0))
const hasLabelText = computed(() => !isCircleShape.value && (labelText.value.length > 0 || additionalText.value.length > 0))
const hasCircleBorder = computed(() => hasBorder.value && isCircleShape.value)
const hasCircleInset = computed(() => isCircleShape.value)
const circleBorderInnerEdge = computed(() => hasBorder.value ? Math.max(...selectedBorderStyle.value.lines.map(getBorderLineInnerEdge)) : 0)
const labelHasDescender = computed(() => /[gjpqy]/.test(`${labelText.value}${additionalText.value}`))
const labelIsTop = computed(() => hasLabelText.value && selectedLabelPosition.value === 'top')
const labelIsBottom = computed(() => hasLabelText.value && selectedLabelPosition.value === 'bottom')
const labelIsLeft = computed(() => hasLabelText.value && selectedLabelPosition.value === 'left')
const labelIsRight = computed(() => hasLabelText.value && selectedLabelPosition.value === 'right')
const labelIsSide = computed(() => labelIsLeft.value || labelIsRight.value)
const borderContentInset = computed(() => {
  if (hasCircleInset.value) {
    return Math.max(qrSvgSize.value * circleBorderCornerInsetRatio, circleBorderInnerEdge.value + selectedBorderStyle.value.contentGap)
  }

  if (!hasBorder.value) {
    return 0
  }

  return circleBorderInnerEdge.value + selectedBorderStyle.value.contentGap
})
const qrOutputSize = computed(() => qrSvgSize.value)
const baseLabelFontSize = computed(() => qrOutputSize.value * 0.2)
const baseAdditionalTextFontSize = computed(() => qrOutputSize.value * 0.095)
const labelSizeMultiplier = computed(() => getSizeMultiplier(labelSizeStep.value))
const additionalTextSizeMultiplier = computed(() => getAdditionalTextSizeMultiplier(additionalTextSizeStep.value))
const labelFontScale = computed(() => getFittedTextScale(labelTextWidth.value, labelSizeMultiplier.value))
const additionalTextFontScale = computed(() => getFittedTextScale(additionalTextLineWidth.value, additionalTextSizeMultiplier.value))
const labelFontSize = computed(() => baseLabelFontSize.value * labelFontScale.value)
const additionalTextFontSize = computed(() => baseAdditionalTextFontSize.value * additionalTextFontScale.value)
const canIncreaseLabelSize = computed(() => labelText.value.length > 0 && labelTextWidth.value * labelFontScale.value < fittedLabelTextWidth.value - 0.01)
const canDecreaseLabelSize = computed(() => labelText.value.length > 0 && labelSizeStep.value > minTextSizeStep)
const canIncreaseAdditionalTextSize = computed(() => {
  if (additionalTextLines.value.length === 0 || additionalTextSizeStep.value >= maxAdditionalTextSizeStep) {
    return false
  }

  const nextScale = getFittedTextScale(additionalTextLineWidth.value, getAdditionalTextSizeMultiplier(additionalTextSizeStep.value + 1))

  return nextScale > additionalTextFontScale.value + 0.01
})
const canDecreaseAdditionalTextSize = computed(() => additionalTextLines.value.length > 0 && additionalTextSizeStep.value > minTextSizeStep)
const additionalTextLineGap = computed(() => additionalTextLines.value.length > 1 ? additionalTextFontSize.value * 0.12 : 0)
const additionalTextBlockHeight = computed(() => additionalTextLines.value.length ? additionalTextFontSize.value * additionalTextLines.value.length + additionalTextLineGap.value * (additionalTextLines.value.length - 1) : 0)
const additionalTextGap = computed(() => {
  if (!labelText.value || !additionalTextLines.value.length) {
    return 0
  }

  return labelFontSize.value * (labelIsSide.value ? sideLabelAdditionalTextGapRatio : stackedLabelAdditionalTextGapRatio)
})
const labelGap = computed(() => hasLabelText.value ? hasBorder.value ? selectedBorderStyle.value.contentGap : 1 : 0)
const labelBlockHeight = computed(() => {
  if (!hasLabelText.value) {
    return 0
  }

  return (labelText.value ? labelFontSize.value : 0) + additionalTextGap.value + additionalTextBlockHeight.value
})
const topLabelHeight = computed(() => labelIsTop.value ? labelBlockHeight.value : 0)
const bottomLabelHeight = computed(() => labelIsBottom.value ? labelBlockHeight.value : 0)
const topLabelGap = computed(() => labelIsTop.value ? labelGap.value : 0)
const bottomLabelGap = computed(() => labelIsBottom.value ? labelGap.value : 0)
const sideLabelWidth = computed(() => labelIsSide.value ? qrOutputSize.value : 0)
const sideLabelGap = computed(() => labelIsSide.value ? labelGap.value : 0)
const sideLabelTextInset = computed(() => labelIsSide.value ? qrOutputSize.value * sideLabelTextInsetRatio : 0)
const fittedLabelTextWidth = computed(() => Math.max(1, qrOutputSize.value - sideLabelTextInset.value * 2))
const sideContentHeight = computed(() => labelIsSide.value ? Math.max(qrOutputSize.value, labelBlockHeight.value) : qrOutputSize.value)
const labelBottomTrim = computed(() => {
  if (!labelIsBottom.value || !hasBorder.value || labelHasDescender.value) {
    return 0
  }

  return (labelText.value ? labelFontSize.value : additionalTextFontSize.value) * 0.18
})
const qrOutputX = computed(() => borderContentInset.value + (labelIsLeft.value ? sideLabelWidth.value + sideLabelGap.value : 0))
const qrOutputY = computed(() => {
  if (labelIsSide.value) {
    return borderContentInset.value + (sideContentHeight.value - qrOutputSize.value) / 2
  }

  return borderContentInset.value + topLabelHeight.value + topLabelGap.value
})
const centerIconCircleDiameter = computed(() => qrOutputSize.value * versionOneCenterIconCircleDiameter / versionOneQrSize)
const centerIconCircleRadius = computed(() => centerIconCircleDiameter.value / 2)
const centerIconSize = computed(() => centerIconCircleDiameter.value * 0.68)
const centerIconX = computed(() => qrOutputX.value + qrOutputSize.value / 2 - centerIconSize.value / 2)
const centerIconY = computed(() => qrOutputY.value + qrOutputSize.value / 2 - centerIconSize.value / 2)
const outputSvgWidth = computed(() => borderContentInset.value * 2 + sideLabelWidth.value + sideLabelGap.value + qrOutputSize.value)
const outputBottomInset = computed(() => hasBorder.value || hasCircleInset.value ? borderContentInset.value : bottomLabelGap.value)
const outputSvgHeight = computed(() => {
  if (labelIsSide.value) {
    return borderContentInset.value * 2 + sideContentHeight.value
  }

  return borderContentInset.value + topLabelHeight.value + topLabelGap.value + qrOutputSize.value + bottomLabelGap.value + bottomLabelHeight.value + outputBottomInset.value - labelBottomTrim.value
})
const outputViewBox = computed(() => generatedQr.value.code ? `0 0 ${outputSvgWidth.value} ${outputSvgHeight.value}` : '0 0 1 1')
const outputCircleRadius = computed(() => Math.min(outputSvgWidth.value, outputSvgHeight.value) / 2)
const qrPreviewCardClass = computed(() => [
  'w-full max-w-[min(86svw,68svh)]',
  isCircleShape.value ? 'rounded-full' : ''
])
const qrPreviewSurfaceClass = computed(() => [
  'w-full bg-white',
  isCircleShape.value ? 'rounded-full' : 'rounded-lg'
])
const labelX = computed(() => {
  if (labelIsLeft.value) {
    return borderContentInset.value + sideLabelWidth.value / 2
  }

  if (labelIsRight.value) {
    return qrOutputX.value + qrOutputSize.value + sideLabelGap.value + sideLabelWidth.value / 2
  }

  return outputSvgWidth.value / 2
})
const labelBlockY = computed(() => {
  if (labelIsTop.value) {
    return borderContentInset.value
  }

  if (labelIsSide.value) {
    return borderContentInset.value + (sideContentHeight.value - labelBlockHeight.value) / 2
  }

  return qrOutputY.value + qrOutputSize.value + bottomLabelGap.value
})
const labelY = computed(() => {
  if (selectedAdditionalTextPlacement.value === 'above' && additionalTextLines.value.length) {
    return labelBlockY.value + additionalTextBlockHeight.value + additionalTextGap.value + labelFontSize.value / 2
  }

  return labelBlockY.value + labelFontSize.value / 2
})
const selectedBorderLines = computed(() => selectedBorderStyle.value.lines.map(line => ({
  ...line,
  height: outputSvgHeight.value - line.inset * 2,
  width: outputSvgWidth.value - line.inset * 2
})))
const selectedCircleBorderLines = computed(() => selectedBorderStyle.value.lines.map(line => ({
  ...line,
  cx: qrOutputX.value + qrOutputSize.value / 2,
  cy: qrOutputY.value + qrOutputSize.value / 2,
  radius: getCircleBorderRadius(line)
})))
const circleBorderBuffer = computed(() => hasCircleInset.value ? Math.max(0.33, qrOutputSize.value * 0.012) : 0)
const circleBorderBufferRect = computed(() => ({
  height: qrOutputSize.value + circleBorderBuffer.value * 2,
  width: qrOutputSize.value + circleBorderBuffer.value * 2,
  x: qrOutputX.value - circleBorderBuffer.value,
  y: qrOutputY.value - circleBorderBuffer.value
}))
const circleLabelBandWidth = computed(() => Math.max(1, borderContentInset.value - circleBorderInnerEdge.value - circleBorderBuffer.value * 2))
const baseCircleLabelFontSize = computed(() => Math.min(qrOutputSize.value * 0.095, circleLabelBandWidth.value * 0.62))
const circleLabelPathMaxRadius = computed(() => Math.max(
  qrOutputSize.value / 2 + circleBorderBuffer.value,
  qrOutputSize.value / 2 + borderContentInset.value - circleBorderInnerEdge.value - circleBorderBuffer.value
))
const circleLabelArcLength = computed(() => Math.max(1, circleLabelPathMaxRadius.value * Math.PI / 2 * 0.9))
const visibleCircleLabelControls = computed(() => circleLabelControls.filter(control => getCircleLabelText(control.value).length > 0))
const borderGradientBox = computed<GradientBox>(() => ({
  height: Math.max(outputSvgHeight.value, 1),
  width: Math.max(outputSvgWidth.value, 1),
  x: 0,
  y: 0
}))
const qrArtworkGradientBox = computed<GradientBox>(() => ({
  height: Math.max(qrOutputSize.value, 1),
  width: Math.max(qrOutputSize.value, 1),
  x: qrOutputX.value,
  y: qrOutputY.value
}))
const qrPathGradientBox = computed<GradientBox>(() => ({
  height: Math.max(qrSvgSize.value, 1),
  width: Math.max(qrSvgSize.value, 1),
  x: 0,
  y: 0
}))
const textGradientBox = computed<GradientBox>(() => ({
  height: Math.max(hasCircleLabelText.value ? outputSvgHeight.value : labelBlockHeight.value, 1),
  width: Math.max(hasCircleLabelText.value ? outputSvgWidth.value : labelIsSide.value ? sideLabelWidth.value : outputSvgWidth.value, 1),
  x: hasCircleLabelText.value
    ? 0
    : labelIsLeft.value
      ? borderContentInset.value
      : labelIsRight.value
        ? qrOutputX.value + qrOutputSize.value + sideLabelGap.value
        : 0,
  y: hasCircleLabelText.value ? 0 : labelBlockY.value
}))
const borderLinearGradientCoordinates = computed(() => getLinearGradientCoordinates(borderGradientBox.value))
const borderRadialGradientCoordinates = computed(() => getRadialGradientCoordinates(borderGradientBox.value))
const qrArtworkLinearGradientCoordinates = computed(() => getLinearGradientCoordinates(qrArtworkGradientBox.value))
const qrArtworkRadialGradientCoordinates = computed(() => getRadialGradientCoordinates(qrArtworkGradientBox.value))
const qrPathLinearGradientCoordinates = computed(() => getLinearGradientCoordinates(qrPathGradientBox.value))
const qrPathRadialGradientCoordinates = computed(() => getRadialGradientCoordinates(qrPathGradientBox.value))
const textLinearGradientCoordinates = computed(() => getLinearGradientCoordinates(textGradientBox.value))
const textRadialGradientCoordinates = computed(() => getRadialGradientCoordinates(textGradientBox.value))

async function selectTool(tool: QrTool) {
  if ((tool === 'step' || tool === 'gradient') && !selectedQrColor.value) {
    return
  }

  activeTool.value = tool

  if (tool !== 'colors') {
    hasColorsBefore.value = false
    hasColorsAfter.value = false
  }

  if (tool !== 'icon') {
    hasIconsBefore.value = false
    hasIconsAfter.value = false
  }

  await nextTick()

  if (tool === 'colors') {
    updateColorScrollState()
  }

  if (tool === 'icon') {
    updateIconScrollState()
  }
}

function selectBlackColor() {
  selectedQrColor.value = null
  selectedColorStep.value = 500

  if (activeTool.value === 'step' || activeTool.value === 'gradient') {
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

function selectGradientStyle(style: GradientStyle) {
  selectedGradientStyle.value = style
}

function selectGradientDirection(direction: GradientDirection) {
  selectedGradientDirection.value = direction
}

function selectGradientSecondColor(colorName: string) {
  selectedGradientSecondColorName.value = colorName
}

function selectGradientThirdColor(colorName: string | null) {
  selectedGradientThirdColorName.value = colorName
}

function isSelectedGradientColor(selectedColorName: string | null, colorName: string | null) {
  return selectedColorName === colorName
}

function getGradientColorTextClass(colorName: string) {
  if (colorName === blackColorName) {
    return 'text-black'
  }

  const color = tailwindColors.find(item => item.name === colorName)

  return color ? getTailwindColorClass(color, 'text') : 'text-black'
}

function normalizeGradientColorName(colorName: unknown) {
  if (typeof colorName !== 'string') {
    return null
  }

  if (colorName === blackColorName || tailwindColors.some(color => color.name === colorName)) {
    return colorName
  }

  return null
}

function isGradientStyle(value: unknown): value is GradientStyle {
  return gradientStyleOptions.some(option => option.value === value)
}

function isGradientDirection(value: unknown): value is GradientDirection {
  return gradientDirectionOptions.some(option => option.value === value)
}

function getLinearGradientCoordinates(box: GradientBox): LinearGradientCoordinates {
  if (selectedGradientDirection.value === 'top-to-bottom') {
    return {
      x1: box.x,
      y1: box.y,
      x2: box.x,
      y2: box.y + box.height
    }
  }

  if (selectedGradientDirection.value === 'diagonal') {
    return {
      x1: box.x,
      y1: box.y,
      x2: box.x + box.width,
      y2: box.y + box.height
    }
  }

  return {
    x1: box.x,
    y1: box.y,
    x2: box.x + box.width,
    y2: box.y
  }
}

function getRadialGradientCoordinates(box: GradientBox): RadialGradientCoordinates {
  return {
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
    r: Math.hypot(box.width, box.height) / 2
  }
}

function selectQrShape(shape: QrShape) {
  if (shape === selectedQrShape.value) {
    return
  }

  transferLabelTextForShape(shape)
  selectedQrShape.value = shape
}

function transferLabelTextForShape(shape: QrShape) {
  if (shape === 'circle') {
    circleLabelTop.value = qrLabel.value
    circleLabelBottom.value = qrAdditionalText.value
    circleLabelLeft.value = ''
    circleLabelRight.value = ''
    qrLabel.value = ''
    qrAdditionalText.value = ''
    return
  }

  qrLabel.value = circleLabelTop.value
  qrAdditionalText.value = circleLabelBottom.value.slice(0, maxAdditionalTextLength)
  circleLabelTop.value = ''
  circleLabelBottom.value = ''
  circleLabelLeft.value = ''
  circleLabelRight.value = ''
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

function selectAdditionalTextPlacement(placement: AdditionalTextPlacement) {
  selectedAdditionalTextPlacement.value = placement
}

function getCircleLabelText(placement: CircleLabelPlacement) {
  return circleLabelTexts.value[placement]
}

function setCircleLabelText(placement: CircleLabelPlacement, value: string) {
  getCircleLabelTextRef(placement).value = value
}

function getCircleLabelFontValue(placement: CircleLabelPlacement) {
  return getCircleLabelFontRef(placement).value
}

function setCircleLabelFont(placement: CircleLabelPlacement, value: string) {
  getCircleLabelFontRef(placement).value = labelFonts.some(font => font.value === value) ? value : fallbackLabelFont.value
}

function getCircleLabelSizeStepValue(placement: CircleLabelPlacement) {
  return getCircleLabelSizeStepRef(placement).value
}

function setCircleLabelSizeStep(placement: CircleLabelPlacement, value: unknown) {
  getCircleLabelSizeStepRef(placement).value = clampTextSizeStep(value)
}

function getCircleLabelOrientationValue(placement: CircleLabelPlacement) {
  return getCircleLabelOrientationRef(placement).value
}

function setCircleLabelOrientation(placement: CircleLabelPlacement, value: unknown) {
  getCircleLabelOrientationRef(placement).value = isCircleLabelOrientation(value)
    ? value
    : getDefaultCircleLabelOrientation(placement)
}

function toggleCircleLabelOrientation(placement: CircleLabelPlacement) {
  setCircleLabelOrientation(placement, getCircleLabelOrientationValue(placement) === 'up' ? 'down' : 'up')
}

function getCircleLabelFlipIcon(placement: CircleLabelPlacement) {
  return getCircleLabelOrientationValue(placement) === 'up' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'
}

function getCircleLabelFlipAriaLabel(placement: CircleLabelPlacement) {
  const label = getCircleLabelControlLabel(placement)

  return `Flip ${label} circle label text. Current direction ${getCircleLabelOrientationValue(placement)}`
}

function increaseLabelSize() {
  if (canIncreaseLabelSize.value) {
    labelSizeStep.value++
  }
}

function decreaseLabelSize() {
  if (canDecreaseLabelSize.value) {
    labelSizeStep.value--
  }
}

function increaseAdditionalTextSize() {
  if (canIncreaseAdditionalTextSize.value) {
    additionalTextSizeStep.value++
  }
}

function decreaseAdditionalTextSize() {
  if (canDecreaseAdditionalTextSize.value) {
    additionalTextSizeStep.value--
  }
}

function increaseCircleLabelSize(placement: CircleLabelPlacement) {
  if (canIncreaseCircleLabelSize(placement)) {
    setCircleLabelSizeStep(placement, getCircleLabelSizeStepValue(placement) + 1)
  }
}

function decreaseCircleLabelSize(placement: CircleLabelPlacement) {
  if (canDecreaseCircleLabelSize(placement)) {
    setCircleLabelSizeStep(placement, getCircleLabelSizeStepValue(placement) - 1)
  }
}

function canIncreaseCircleLabelSize(placement: CircleLabelPlacement) {
  const text = getCircleLabelText(placement)

  if (!text || getCircleLabelSizeStepValue(placement) >= 8) {
    return false
  }

  return getCircleLabelFontSizeForStep(placement, getCircleLabelSizeStepValue(placement) + 1)
    > getCircleLabelFontSize(placement) + 0.01
}

function canDecreaseCircleLabelSize(placement: CircleLabelPlacement) {
  return getCircleLabelText(placement).length > 0 && getCircleLabelSizeStepValue(placement) > minTextSizeStep
}

function selectCenterIcon(icon: CenterIconOption) {
  selectedCenterIcon.value = icon.value
}

function selectCenterIconCategory(category: CenterIconCategory) {
  activeCenterIconCategory.value = category.value
}

function showParentCenterIconCategory() {
  activeCenterIconCategory.value = activeCenterIconParentCategory.value?.value ?? null
}

function createCenterIconOption(categoryValue: string, categoryLabel: string, label: string, filePath: string): CenterIconOption {
  return {
    label,
    value: `${categoryValue}/${filePath}`,
    src: `/icons/center/${categoryValue}/${filePath}.svg`,
    categoryLabel
  }
}

function getCenterIconCategories(categories: CenterIconCategory[]): CenterIconCategory[] {
  return categories.flatMap(category => [
    category,
    ...getCenterIconCategories(category.categories ?? [])
  ])
}

function getCenterIconOptions(categories: CenterIconCategory[]): CenterIconOption[] {
  return categories.flatMap(category => [
    ...category.icons,
    ...getCenterIconOptions(category.categories ?? [])
  ])
}

function getCenterIconParentCategory(value: string, categories: CenterIconCategory[], parent: CenterIconCategory | null = null): CenterIconCategory | null {
  for (const category of categories) {
    if (category.value === value) {
      return parent
    }

    const nestedParent = getCenterIconParentCategory(value, category.categories ?? [], category)

    if (nestedParent) {
      return nestedParent
    }
  }

  return null
}

function getCenterIconSearchText(icon: CenterIconOption) {
  return `${icon.categoryLabel} ${icon.label} ${icon.value}`.toLowerCase()
}

function isCenterIconCategorySelected(category: CenterIconCategory) {
  return selectedCenterIcon.value.startsWith(`${category.value}/`)
}

function wrapAdditionalText(value: string) {
  const normalizedText = value.replace(/\s+/g, ' ').slice(0, maxAdditionalTextLength).trim()

  if (!normalizedText) {
    return []
  }

  const words = normalizedText.split(' ').filter(Boolean)
  const tokens = words.flatMap(getBreakableWordPieces)
  const targetLineCount = Math.min(tokens.length, Math.max(1, Math.min(3, Math.ceil(normalizedText.length / preferredAdditionalTextLineLength))))

  return getBalancedAdditionalTextLines(tokens, targetLineCount)
}

function getBalancedAdditionalTextLines(tokens: string[], lineCount: number) {
  if (lineCount <= 1) {
    return tokens.join(' ') ? [tokens.join(' ')] : []
  }

  const targetLineLength = tokens.join(' ').length / lineCount
  const cache = new Map<string, { lines: string[], score: number } | null>()

  function lineLength(startIndex: number, endIndex: number) {
    return tokens.slice(startIndex, endIndex).join(' ').length
  }

  function bestFrom(startIndex: number, linesRemaining: number): { lines: string[], score: number } | null {
    const cacheKey = `${startIndex}:${linesRemaining}`
    const cached = cache.get(cacheKey)

    if (cached !== undefined) {
      return cached
    }

    const tokensRemaining = tokens.length - startIndex

    if (tokensRemaining < linesRemaining) {
      cache.set(cacheKey, null)
      return null
    }

    if (linesRemaining === 1) {
      const line = tokens.slice(startIndex).join(' ')
      const length = line.length
      const score = length * 1000 + (length - targetLineLength) ** 2
      const result = { lines: [line], score }

      cache.set(cacheKey, result)

      return result
    }

    let best: { lines: string[], score: number } | null = null
    const lastEndIndex = tokens.length - linesRemaining + 1

    for (let endIndex = startIndex + 1; endIndex <= lastEndIndex; endIndex++) {
      const line = tokens.slice(startIndex, endIndex).join(' ')
      const length = lineLength(startIndex, endIndex)
      const rest = bestFrom(endIndex, linesRemaining - 1)

      if (!rest) {
        continue
      }

      const maxLineLength = Math.max(length, ...rest.lines.map(restLine => restLine.length))
      const raggedness = (length - targetLineLength) ** 2 + rest.lines.reduce((total, restLine) => total + (restLine.length - targetLineLength) ** 2, 0)
      const score = maxLineLength * 1000 + raggedness

      if (!best || score < best.score) {
        best = {
          lines: [line, ...rest.lines],
          score
        }
      }
    }

    cache.set(cacheKey, best)

    return best
  }

  return bestFrom(0, lineCount)?.lines ?? []
}

function getBreakableWordPieces(word: string) {
  const pieces: string[] = []
  let piece = ''

  for (const character of word) {
    piece += character

    if (character === '-') {
      pieces.push(piece)
      piece = ''
    }
  }

  if (piece) {
    pieces.push(piece)
  }

  return pieces.flatMap((piece) => {
    if (piece.length <= additionalTextLineLength) {
      return piece
    }

    const chunks: string[] = []

    for (let index = 0; index < piece.length; index += additionalTextLineLength) {
      chunks.push(piece.slice(index, index + additionalTextLineLength))
    }

    return chunks
  })
}

function getAdditionalTextLineY(index: number) {
  const y = selectedAdditionalTextPlacement.value === 'below' && labelText.value
    ? labelBlockY.value + labelFontSize.value + additionalTextGap.value
    : labelBlockY.value

  return y + additionalTextFontSize.value / 2 + index * (additionalTextFontSize.value + additionalTextLineGap.value)
}

function getCircleLabelTextRef(placement: CircleLabelPlacement) {
  switch (placement) {
    case 'bottom':
      return circleLabelBottom
    case 'left':
      return circleLabelLeft
    case 'right':
      return circleLabelRight
    case 'top':
      return circleLabelTop
  }
}

function getCircleLabelFontRef(placement: CircleLabelPlacement) {
  switch (placement) {
    case 'bottom':
      return selectedCircleLabelBottomFont
    case 'left':
      return selectedCircleLabelLeftFont
    case 'right':
      return selectedCircleLabelRightFont
    case 'top':
      return selectedCircleLabelTopFont
  }
}

function getCircleLabelSizeStepRef(placement: CircleLabelPlacement) {
  switch (placement) {
    case 'bottom':
      return circleLabelBottomSizeStep
    case 'left':
      return circleLabelLeftSizeStep
    case 'right':
      return circleLabelRightSizeStep
    case 'top':
      return circleLabelTopSizeStep
  }
}

function getCircleLabelOrientationRef(placement: CircleLabelPlacement) {
  switch (placement) {
    case 'bottom':
      return circleLabelBottomOrientation
    case 'left':
      return circleLabelLeftOrientation
    case 'right':
      return circleLabelRightOrientation
    case 'top':
      return circleLabelTopOrientation
  }
}

function getDefaultCircleLabelOrientation(placement: CircleLabelPlacement): CircleLabelOrientation {
  return placement === 'bottom' || placement === 'right' ? 'down' : 'up'
}

function isCircleLabelOrientation(value: unknown): value is CircleLabelOrientation {
  return value === 'up' || value === 'down'
}

function getCircleLabelControlLabel(placement: CircleLabelPlacement) {
  return circleLabelControls.find(control => control.value === placement)?.label ?? placement
}

function getCircleLabelFontClass(placement: CircleLabelPlacement) {
  return getLabelFont(getCircleLabelFontValue(placement)).class
}

function getCircleLabelFontSize(placement: CircleLabelPlacement) {
  return getCircleLabelFontSizeForStep(placement, getCircleLabelSizeStepValue(placement))
}

function getCircleLabelFontSizeForStep(placement: CircleLabelPlacement, step: number) {
  const requestedSize = baseCircleLabelFontSize.value * getSizeMultiplier(step)
  const text = getCircleLabelText(placement)

  if (!text) {
    return requestedSize
  }

  const estimatedWidth = estimateCircleLabelTextWidth(text, requestedSize)

  if (estimatedWidth <= circleLabelArcLength.value) {
    return requestedSize
  }

  return Math.max(0.1, requestedSize * circleLabelArcLength.value / estimatedWidth)
}

function estimateCircleLabelTextWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.62
}

function getCircleLabelPathId(placement: CircleLabelPlacement) {
  return `circle-label-${placement}-path`
}

function getCircleLabelPathHref(placement: CircleLabelPlacement) {
  return `#${getCircleLabelPathId(placement)}`
}

function getCircleLabelPath(placement: CircleLabelPlacement) {
  const fontSize = getCircleLabelFontSize(placement)
  const radius = Math.max(qrOutputSize.value / 2 + circleBorderBuffer.value, circleLabelPathMaxRadius.value - fontSize / 2)
  const centerX = qrOutputX.value + qrOutputSize.value / 2
  const centerY = qrOutputY.value + qrOutputSize.value / 2
  const arc = getCircleLabelArc(placement)
  const start = getCirclePoint(centerX, centerY, radius, arc.start)
  const end = getCirclePoint(centerX, centerY, radius, arc.end)

  return `M${start.x} ${start.y}A${radius} ${radius} 0 0 ${arc.sweep} ${end.x} ${end.y}`
}

function getCircleLabelArc(placement: CircleLabelPlacement): CircleLabelArc {
  const arcs: Record<CircleLabelPlacement, CircleLabelArc> = {
    bottom: { start: 135, end: 45, sweep: 0 },
    left: { start: 225, end: 135, sweep: 0 },
    right: { start: 315, end: 45, sweep: 1 },
    top: { start: 225, end: 315, sweep: 1 }
  }
  const arc = arcs[placement]

  if (getCircleLabelOrientationValue(placement) === getDefaultCircleLabelOrientation(placement)) {
    return arc
  }

  return {
    start: arc.end,
    end: arc.start,
    sweep: arc.sweep === 1 ? 0 : 1
  }
}

function getCircleLabelPathSide(placement: CircleLabelPlacement) {
  const defaultSide = getDefaultCircleLabelPathSide(placement)

  return getCircleLabelOrientationValue(placement) === getDefaultCircleLabelOrientation(placement)
    ? defaultSide
    : getOppositeCircleLabelPathSide(defaultSide)
}

function getDefaultCircleLabelPathSide(placement: CircleLabelPlacement): CircleLabelPathSide {
  switch (placement) {
    case 'bottom':
    case 'left':
      return 'right'
    case 'right':
    case 'top':
      return 'left'
  }
}

function getOppositeCircleLabelPathSide(side: CircleLabelPathSide): CircleLabelPathSide {
  return side === 'left' ? 'right' : 'left'
}

function getCirclePoint(centerX: number, centerY: number, radius: number, angleDegrees: number) {
  const angle = angleDegrees * Math.PI / 180

  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle)
  }
}

function getSizeMultiplier(step: number) {
  return step >= 0 ? 1.25 ** step : 0.75 ** Math.abs(step)
}

function getAdditionalTextSizeMultiplier(step: number) {
  return getSizeMultiplier(step - 1)
}

function getFittedTextScale(textWidth: number, requestedScale: number) {
  if (textWidth <= 0) {
    return requestedScale
  }

  return Math.min(requestedScale, fittedLabelTextWidth.value / textWidth)
}

async function updateTextMeasurements() {
  await nextTick()

  const labelElement = labelMeasureElement.value
  const additionalElement = additionalTextMeasureElement.value

  labelTextWidth.value = labelText.value && labelElement ? labelElement.getComputedTextLength() : 0
  additionalTextLineWidth.value = longestAdditionalTextLine.value && additionalElement ? additionalElement.getComputedTextLength() : 0
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

function isWavyBorderLine(line: BorderLine): line is BorderLine & { wave: BorderWave } {
  return Boolean(line.wave)
}

function isPathBorderLine(line: BorderLine) {
  return isWavyBorderLine(line)
}

function getBorderLineInnerEdge(line: BorderLine) {
  return line.inset + line.strokeWidth / 2 + (line.wave?.amplitude ?? 0) * 2
}

function getCircleBorderRadius(line: BorderLine) {
  const waveAmplitude = line.wave?.amplitude ?? 0

  return outputCircleRadius.value - line.inset - waveAmplitude
}

function getPreviewPath(line: BorderLine) {
  if (isWavyBorderLine(line)) {
    const amplitude = line.wave.amplitude * 1.5

    if (isCircleShape.value) {
      return createWavyCirclePreviewPath(line, amplitude)
    }

    return createWavyRectanglePreviewPath(line, amplitude)
  }

  if (isCircleShape.value) {
    const start = 4 + line.inset * 2
    const radius = 24 - start

    return `M${start} 24A${radius} ${radius} 0 0 1 24 ${start}`
  }

  const start = 4 + line.inset * 2

  return `M${start} 24V${start}H24`
}

function createWavyRectanglePreviewPath(line: BorderLine & { wave: BorderWave }, amplitude: number) {
  const start = 4 + line.inset * 2
  const radius = 4
  const waveLength = line.wave.length * 1.2
  const points = [
    ...createWavyLinePoints(start, 24, start, start + radius, -1, 0, amplitude, waveLength),
    ...createWavyCornerPoints(start + radius, start + radius, radius, Math.PI, Math.PI * 1.5, amplitude, waveLength).slice(1),
    ...createWavyLinePoints(start + radius, start, 24, start, 0, -1, amplitude, waveLength).slice(1)
  ]

  return createOpenPath(points)
}

function createWavyCirclePreviewPath(line: BorderLine & { wave: BorderWave }, amplitude: number) {
  const start = 4 + line.inset * 2
  const radius = 24 - start

  return createOpenPath(createWavyCornerPoints(24, 24, radius, Math.PI, Math.PI * 1.5, amplitude, line.wave.length * 1.4))
}

function getPreviewStrokeWidth(line: BorderLine) {
  return line.strokeWidth * 2
}

function getPreviewStrokeLineCap(line: BorderLine) {
  return isPathBorderLine(line) || isCircleShape.value ? 'round' : 'square'
}

function getBorderStrokeLineCap(line: BorderLine) {
  return isPathBorderLine(line) ? 'round' : undefined
}

function getBorderStrokeLineJoin(line: BorderLine) {
  return isPathBorderLine(line) ? 'round' : undefined
}

function getRectangleBorderPath(line: BorderLine & { height: number, width: number }) {
  if (isWavyBorderLine(line)) {
    const offset = line.inset + line.wave.amplitude
    const width = Math.max(1, line.width - line.wave.amplitude * 2)
    const height = Math.max(1, line.height - line.wave.amplitude * 2)

    return createWavyRoundedRectanglePath(offset, offset, width, height, line.wave.cornerRadius, line.wave.amplitude, line.wave.length)
  }
  return ''
}

function getCircleBorderPath(line: BorderLine & { cx: number, cy: number, radius: number }) {
  if (isWavyBorderLine(line)) {
    return createWavyCirclePath(line.cx, line.cy, line.radius, line.wave.amplitude, line.wave.length)
  }
  return ''
}

function createWavyCirclePath(cx: number, cy: number, radius: number, amplitude: number, waveLength: number) {
  const safeRadius = Math.max(1, radius)
  const safeWaveLength = Math.max(0.5, waveLength)
  const circumference = Math.PI * 2 * safeRadius
  const waveCount = Math.max(3, Math.round(circumference / safeWaveLength))
  const pointCount = Math.max(72, waveCount * 12)
  const points = Array.from({ length: pointCount }, (_, index) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / pointCount
    const radiusOffset = Math.sin(index / pointCount * waveCount * Math.PI * 2) * amplitude
    const currentRadius = safeRadius + radiusOffset

    return {
      x: cx + Math.cos(angle) * currentRadius,
      y: cy + Math.sin(angle) * currentRadius
    }
  })

  return createClosedPath(points)
}

function createWavyRoundedRectanglePath(x: number, y: number, width: number, height: number, radius: number, amplitude: number, waveLength: number) {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const safeRadius = Math.max(0, Math.min(radius, safeWidth / 2, safeHeight / 2))
  const safeWaveLength = Math.max(0.5, waveLength)
  const right = x + safeWidth
  const bottom = y + safeHeight
  const points = [
    ...createWavyLinePoints(x + safeRadius, y, right - safeRadius, y, 0, -1, amplitude, safeWaveLength),
    ...createWavyCornerPoints(right - safeRadius, y + safeRadius, safeRadius, -Math.PI / 2, 0, amplitude, safeWaveLength).slice(1),
    ...createWavyLinePoints(right, y + safeRadius, right, bottom - safeRadius, 1, 0, amplitude, safeWaveLength).slice(1),
    ...createWavyCornerPoints(right - safeRadius, bottom - safeRadius, safeRadius, 0, Math.PI / 2, amplitude, safeWaveLength).slice(1),
    ...createWavyLinePoints(right - safeRadius, bottom, x + safeRadius, bottom, 0, 1, amplitude, safeWaveLength).slice(1),
    ...createWavyCornerPoints(x + safeRadius, bottom - safeRadius, safeRadius, Math.PI / 2, Math.PI, amplitude, safeWaveLength).slice(1),
    ...createWavyLinePoints(x, bottom - safeRadius, x, y + safeRadius, -1, 0, amplitude, safeWaveLength).slice(1),
    ...createWavyCornerPoints(x + safeRadius, y + safeRadius, safeRadius, Math.PI, Math.PI * 1.5, amplitude, safeWaveLength).slice(1)
  ]

  return createClosedPath(points)
}

function createWavyLinePoints(startX: number, startY: number, endX: number, endY: number, normalX: number, normalY: number, amplitude: number, waveLength: number) {
  const distanceX = endX - startX
  const distanceY = endY - startY
  const length = Math.hypot(distanceX, distanceY)

  if (length <= 0.001) {
    return [{ x: endX, y: endY }]
  }

  const waveCount = Math.max(1, Math.round(length / waveLength))
  const steps = Math.max(waveCount * 10, Math.ceil(length / Math.max(waveLength / 5, 0.3)))

  return Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps
    const offset = Math.sin(progress * waveCount * Math.PI * 2) * amplitude
    const x = startX + distanceX * progress + normalX * offset
    const y = startY + distanceY * progress + normalY * offset

    return { x, y }
  })
}

function createWavyCornerPoints(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number, amplitude: number, waveLength: number) {
  if (radius <= 0.001) {
    return []
  }

  const angleDistance = endAngle - startAngle
  const arcLength = Math.abs(angleDistance) * radius
  const waveCount = Math.max(1, Math.round(arcLength / waveLength))
  const steps = Math.max(waveCount * 10, Math.ceil(arcLength / Math.max(waveLength / 5, 0.3)))

  return Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps
    const angle = startAngle + angleDistance * progress
    const offset = Math.sin(progress * waveCount * Math.PI * 2) * amplitude
    const currentRadius = radius + offset

    return {
      x: centerX + Math.cos(angle) * currentRadius,
      y: centerY + Math.sin(angle) * currentRadius
    }
  })
}

function createClosedPath(points: Array<{ x: number, y: number }>) {
  if (!points.length) {
    return ''
  }

  const [firstPoint, ...remainingPoints] = points

  return [
    `M${formatSvgNumber(firstPoint!.x)} ${formatSvgNumber(firstPoint!.y)}`,
    ...remainingPoints.map(point => `L${formatSvgNumber(point.x)} ${formatSvgNumber(point.y)}`),
    'Z'
  ].join('')
}

function createOpenPath(points: Array<{ x: number, y: number }>) {
  if (!points.length) {
    return ''
  }

  const [firstPoint, ...remainingPoints] = points

  return [
    `M${formatSvgNumber(firstPoint!.x)} ${formatSvgNumber(firstPoint!.y)}`,
    ...remainingPoints.map(point => `L${formatSvgNumber(point.x)} ${formatSvgNumber(point.y)}`)
  ].join('')
}

function formatSvgNumber(value: number) {
  return Number(value.toFixed(3))
}

async function goToPrintLabels() {
  if (!generatedQr.value.code || isPreparingLabelPrint.value) {
    return
  }

  isPreparingLabelPrint.value = true
  printLabelError.value = ''

  try {
    const payload = await createLabelPrintPayload()

    sessionStorage.setItem(labelPrintPayloadStorageKey, JSON.stringify(payload))
    await navigateTo('/print-labels')
  } catch (error) {
    printLabelError.value = getErrorMessage(error, 'Unable to prepare the label print page.')
  } finally {
    isPreparingLabelPrint.value = false
  }
}

async function handleSaveButtonClick() {
  await openSaveDialog()
}

async function openSaveDialog() {
  if (!generatedQr.value.code) {
    return
  }

  saveQrError.value = ''
  saveQrName.value ||= getDefaultQrName()
  isSaveDialogOpen.value = true
}

async function saveCurrentQr() {
  const name = saveQrName.value.trim()

  if (!name) {
    saveQrError.value = 'QR code name is required.'
    return
  }

  isSavingQr.value = true
  saveQrError.value = ''

  try {
    const printPayload = await createLabelPrintPayload()

    await $fetch('/api/qr/saved', {
      body: {
        name,
        payload: createSavedQrPayload(),
        previewHeight: printPayload.height,
        previewSvg: printPayload.svg,
        previewWidth: printPayload.width,
        tags: parseTagsInput(saveQrTagsInput.value)
      },
      method: 'POST'
    })

    isSaveDialogOpen.value = false
    saveQrName.value = ''
    saveQrTagsInput.value = ''
  } catch (error) {
    saveQrError.value = getErrorMessage(error, 'Unable to save this QR code.')
  } finally {
    isSavingQr.value = false
  }
}

function parseTagsInput(value: string) {
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
}

function createSavedQrPayload(): SavedQrPayload {
  return {
    additionalText: qrAdditionalText.value,
    additionalTextFont: selectedAdditionalTextFont.value,
    additionalTextPlacement: selectedAdditionalTextPlacement.value,
    additionalTextSizeStep: additionalTextSizeStep.value,
    border: selectedBorder.value,
    centerIcon: selectedCenterIcon.value,
    circleLabels: createCircleLabelsPayload(),
    colorName: selectedQrColor.value?.name ?? null,
    colorStep: selectedColorStep.value,
    gradientDirection: selectedGradientDirection.value,
    gradientSecondColorName: selectedGradientSecondColorName.value,
    gradientStyle: selectedGradientStyle.value,
    gradientThirdColorName: selectedGradientThirdColorName.value,
    label: qrLabel.value,
    labelFont: selectedLabelFont.value,
    labelPosition: selectedLabelPosition.value,
    labelSizeStep: labelSizeStep.value,
    shape: selectedQrShape.value,
    url: qrStore.url,
    version: 1,
    ...(hasDynamicQrFeature.value ? { dynamicLink: createDynamicQrLinkPayload() } : {})
  }
}

function createDynamicQrLinkPayload(): DynamicQrLinkPayload {
  const slug = normalizedDynamicLinkSlug.value

  return isActiveDynamicLinkCurrent() && activeDynamicLink.value
    ? activeDynamicLink.value
    : {
        destinationUrl: getDynamicDestinationUrl(),
        id: '',
        redirectUrl: createDynamicQrRedirectUrl(slug || 'guid'),
        slug,
        trackStatistics: trackScanStatistics.value,
        useDynamicUrl: useDynamicUrl.value
      }
}

function isActiveDynamicLinkCurrent() {
  const link = activeDynamicLink.value

  return Boolean(link
    && link.slug === normalizedDynamicLinkSlug.value
    && link.destinationUrl === getDynamicDestinationUrl()
    && link.trackStatistics === trackScanStatistics.value
    && link.useDynamicUrl === useDynamicUrl.value)
}

function updateDynamicLinkSlug(value: string | number) {
  dynamicLinkSlug.value = normalizeDynamicQrSlug(String(value))
}

function resetDynamicLinkAvailability() {
  dynamicLinkAvailabilityRunId += 1
  dynamicLinkAvailabilityStatus.value = 'idle'
  dynamicLinkAvailabilityMessage.value = ''

  if (dynamicLinkAvailabilityTimer) {
    clearTimeout(dynamicLinkAvailabilityTimer)
    dynamicLinkAvailabilityTimer = null
  }
}

function scheduleDynamicLinkAvailabilityCheck() {
  resetDynamicLinkAvailability()

  if (!isCustomizingDynamicLink.value || !hasDynamicQrFeature.value) {
    return
  }

  const slug = normalizedDynamicLinkSlug.value

  if (!slug) {
    dynamicLinkAvailabilityMessage.value = 'Enter a custom link.'
    return
  }

  if (!isValidDynamicQrSlug(slug)) {
    dynamicLinkAvailabilityStatus.value = 'unavailable'
    dynamicLinkAvailabilityMessage.value = 'Use lowercase letters, numbers, and hyphens.'
    return
  }

  if (activeDynamicLink.value?.slug === slug) {
    dynamicLinkAvailabilityStatus.value = 'available'
    dynamicLinkAvailabilityMessage.value = 'This custom link is available for this QR code.'
    return
  }

  const runId = dynamicLinkAvailabilityRunId
  dynamicLinkAvailabilityStatus.value = 'checking'
  dynamicLinkAvailabilityMessage.value = 'Checking availability...'
  dynamicLinkAvailabilityTimer = setTimeout(() => {
    void checkDynamicLinkSlugAvailability(runId, slug)
  }, dynamicLinkAvailabilityCheckDelayMs)
}

async function checkDynamicLinkSlugAvailability(runId: number, slug: string) {
  try {
    const response = await $fetch<DynamicQrSlugAvailabilityResponse>('/api/qr/dynamic-links/availability', {
      query: {
        ...(activeDynamicLink.value?.id ? { existingLinkId: activeDynamicLink.value.id } : {}),
        slug
      }
    })

    if (runId !== dynamicLinkAvailabilityRunId || response.slug !== normalizedDynamicLinkSlug.value) {
      return
    }

    dynamicLinkAvailabilityStatus.value = response.available ? 'available' : 'unavailable'
    dynamicLinkAvailabilityMessage.value = response.available
      ? 'This custom link is available.'
      : 'That custom link is not available.'
  } catch (error) {
    if (runId !== dynamicLinkAvailabilityRunId) {
      return
    }

    dynamicLinkAvailabilityStatus.value = 'error'
    dynamicLinkAvailabilityMessage.value = getErrorMessage(error, 'Unable to check this custom link.')
  }
}

async function saveDynamicLinkUpdate() {
  if (!canSaveDynamicLinkUpdate.value) {
    return
  }

  if (!activeDynamicLink.value) {
    isCustomizingDynamicLink.value = false
    return
  }

  isSavingDynamicLink.value = true
  dynamicLinkError.value = ''

  try {
    const response = await $fetch<DynamicQrLinkResponse>('/api/qr/dynamic-links', {
      body: {
        destinationUrl: getDynamicDestinationUrl(),
        existingLinkId: activeDynamicLink.value.id,
        slug: normalizedDynamicLinkSlug.value,
        trackStatistics: trackScanStatistics.value,
        useDynamicUrl: useDynamicUrl.value
      },
      method: 'POST'
    })

    activeDynamicLink.value = response.link
    dynamicLinkSlug.value = response.link.slug
    isCustomizingDynamicLink.value = false
    resetDynamicLinkAvailability()
  } catch (error) {
    dynamicLinkError.value = getErrorMessage(error, 'Unable to update this custom link.')

    if (dynamicLinkError.value.toLowerCase().includes('taken')) {
      dynamicLinkAvailabilityStatus.value = 'unavailable'
      dynamicLinkAvailabilityMessage.value = 'That custom link is not available.'
    }
  } finally {
    isSavingDynamicLink.value = false
  }
}

function getDynamicDestinationUrl() {
  try {
    return new URL(qrStore.content).toString()
  } catch {
    return qrStore.content
  }
}

function createCircleLabelsPayload(): Record<CircleLabelPlacement, CircleLabelPayload> {
  return {
    bottom: {
      font: selectedCircleLabelBottomFont.value,
      orientation: circleLabelBottomOrientation.value,
      sizeStep: circleLabelBottomSizeStep.value,
      text: circleLabelBottom.value
    },
    left: {
      font: selectedCircleLabelLeftFont.value,
      orientation: circleLabelLeftOrientation.value,
      sizeStep: circleLabelLeftSizeStep.value,
      text: circleLabelLeft.value
    },
    right: {
      font: selectedCircleLabelRightFont.value,
      orientation: circleLabelRightOrientation.value,
      sizeStep: circleLabelRightSizeStep.value,
      text: circleLabelRight.value
    },
    top: {
      font: selectedCircleLabelTopFont.value,
      orientation: circleLabelTopOrientation.value,
      sizeStep: circleLabelTopSizeStep.value,
      text: circleLabelTop.value
    }
  }
}

function createCurrentQrDraftPayload(): CurrentQrDraftPayload {
  return {
    ...createSavedQrPayload(),
    activeCenterIconCategory: activeCenterIconCategory.value,
    activeTool: activeTool.value,
    centerIconSearch: centerIconSearch.value
  }
}

function persistCurrentQrDraft() {
  if (!import.meta.client || isClearingCurrentQrDraft) {
    return
  }

  try {
    const payload = createCurrentQrDraftPayload()

    if (isDefaultCurrentQrDraftPayload(payload)) {
      sessionStorage.removeItem(currentQrDraftStorageKey)
      return
    }

    sessionStorage.setItem(currentQrDraftStorageKey, JSON.stringify(payload))
  } catch {
    // Session storage can be unavailable in private or locked-down browser modes.
  }
}

function restoreCurrentQrDraftFromStorage() {
  const rawPayload = sessionStorage.getItem(currentQrDraftStorageKey)

  if (!rawPayload) {
    return false
  }

  try {
    applyCurrentQrDraftPayload(JSON.parse(rawPayload) as CurrentQrDraftPayload)
    return true
  } catch {
    sessionStorage.removeItem(currentQrDraftStorageKey)
    printLabelError.value = 'Unable to load the current QR code.'
    return false
  }
}

function restoreSavedQrPayloadFromStorage() {
  const rawPayload = sessionStorage.getItem(editQrPayloadStorageKey)

  if (!rawPayload) {
    return false
  }

  sessionStorage.removeItem(editQrPayloadStorageKey)

  try {
    applySavedQrPayload(JSON.parse(rawPayload) as SavedQrPayload)
    return true
  } catch {
    printLabelError.value = 'Unable to load the saved QR code.'
    return false
  }
}

function applyCurrentQrDraftPayload(payload: CurrentQrDraftPayload) {
  applySavedQrPayload(payload)
  activeTool.value = normalizeActiveTool(payload.activeTool)
  activeCenterIconCategory.value = normalizeCenterIconCategory(payload.activeCenterIconCategory)
  centerIconSearch.value = typeof payload.centerIconSearch === 'string' ? payload.centerIconSearch : ''
}

function applySavedQrPayload(payload: SavedQrPayload) {
  if (payload.version !== 1) {
    throw new Error('Unsupported saved QR code version.')
  }

  qrStore.url = typeof payload.url === 'string' ? payload.url : ''
  applyDynamicLinkPayload(payload.dynamicLink)
  selectedQrColor.value = payload.colorName ? tailwindColors.find(color => color.name === payload.colorName) ?? null : null
  selectedColorStep.value = tailwindColorSteps.includes(payload.colorStep) ? payload.colorStep : 500
  selectedGradientStyle.value = isGradientStyle(payload.gradientStyle) && selectedQrColor.value ? payload.gradientStyle : 'none'
  selectedGradientDirection.value = isGradientDirection(payload.gradientDirection) ? payload.gradientDirection : 'left-to-right'
  selectedGradientSecondColorName.value = normalizeGradientColorName(payload.gradientSecondColorName)
  selectedGradientThirdColorName.value = normalizeGradientColorName(payload.gradientThirdColorName)
  qrLabel.value = typeof payload.label === 'string' ? payload.label : ''
  qrAdditionalText.value = typeof payload.additionalText === 'string' ? payload.additionalText.slice(0, maxAdditionalTextLength) : ''
  selectedAdditionalTextPlacement.value = payload.additionalTextPlacement === 'above' ? 'above' : 'below'
  selectedLabelPosition.value = labelPositionOptions.some(option => option.value === payload.labelPosition) ? payload.labelPosition : 'top'
  selectedLabelFont.value = labelFonts.some(font => font.value === payload.labelFont) ? payload.labelFont : fallbackLabelFont.value
  selectedAdditionalTextFont.value = labelFonts.some(font => font.value === payload.additionalTextFont) ? payload.additionalTextFont : fallbackLabelFont.value
  labelSizeStep.value = clampTextSizeStep(payload.labelSizeStep)
  additionalTextSizeStep.value = clampAdditionalTextSizeStep(payload.additionalTextSizeStep)
  selectedCenterIcon.value = centerIconOptions.some(icon => icon.value === payload.centerIcon) ? payload.centerIcon : 'none'
  selectedBorder.value = borderStyles.some(border => border.value === payload.border) ? payload.border as BorderValue : 'none'
  selectedQrShape.value = isQrShape(payload.shape) ? payload.shape : 'rectangle'
  applyCircleLabelsPayload(payload.circleLabels)
  activeCenterIconCategory.value = null
}

function applyCircleLabelsPayload(payload: SavedQrPayload['circleLabels']) {
  for (const placement of circleLabelControls.map(control => control.value)) {
    const label = payload?.[placement]

    setCircleLabelText(placement, typeof label?.text === 'string' ? label.text : '')
    setCircleLabelFont(placement, typeof label?.font === 'string' ? label.font : fallbackLabelFont.value)
    setCircleLabelSizeStep(placement, label?.sizeStep)
    setCircleLabelOrientation(placement, label?.orientation)
  }
}

function applyDynamicLinkPayload(payload: SavedQrPayload['dynamicLink']) {
  if (!payload || typeof payload !== 'object') {
    useDynamicUrl.value = false
    trackScanStatistics.value = false
    dynamicLinkSlug.value = ''
    isCustomizingDynamicLink.value = false
    dynamicLinkError.value = ''
    resetDynamicLinkAvailability()
    activeDynamicLink.value = null
    return
  }

  const slug = normalizeDynamicQrSlug(payload.slug)

  useDynamicUrl.value = payload.useDynamicUrl === true
  trackScanStatistics.value = payload.trackStatistics === true
  dynamicLinkSlug.value = slug
  isCustomizingDynamicLink.value = false
  dynamicLinkError.value = ''
  resetDynamicLinkAvailability()
  activeDynamicLink.value = typeof payload.id === 'string' && payload.id
    ? {
        destinationUrl: typeof payload.destinationUrl === 'string' ? payload.destinationUrl : qrStore.url,
        id: payload.id,
        redirectUrl: typeof payload.redirectUrl === 'string' ? payload.redirectUrl : createDynamicQrRedirectUrl(slug || 'guid'),
        slug,
        trackStatistics: payload.trackStatistics === true,
        useDynamicUrl: payload.useDynamicUrl === true
      }
    : null
}

function clearCurrentQr() {
  isClearingCurrentQrDraft = true
  resetCurrentQrState()

  if (import.meta.client) {
    sessionStorage.removeItem(currentQrDraftStorageKey)
    sessionStorage.removeItem(labelPrintPayloadStorageKey)
  }

  void nextTick(() => {
    if (import.meta.client) {
      sessionStorage.removeItem(currentQrDraftStorageKey)
    }

    isClearingCurrentQrDraft = false
  })
}

function resetCurrentQrState() {
  qrStore.url = ''
  selectedQrColor.value = null
  selectedColorStep.value = 500
  selectedGradientStyle.value = 'none'
  selectedGradientDirection.value = 'left-to-right'
  selectedGradientSecondColorName.value = null
  selectedGradientThirdColorName.value = null
  labelSizeStep.value = 0
  additionalTextSizeStep.value = 0
  qrLabel.value = ''
  qrAdditionalText.value = ''
  applyCircleLabelsPayload(undefined)
  selectedAdditionalTextPlacement.value = 'below'
  selectedLabelPosition.value = 'top'
  selectedLabelFont.value = fallbackLabelFont.value
  selectedAdditionalTextFont.value = fallbackLabelFont.value
  selectedCenterIcon.value = 'none'
  selectedBorder.value = 'none'
  selectedQrShape.value = 'rectangle'
  activeTool.value = null
  activeCenterIconCategory.value = null
  centerIconSearch.value = ''
  printLabelError.value = ''
  isSaveDialogOpen.value = false
  saveQrName.value = ''
  saveQrTagsInput.value = ''
  saveQrError.value = ''
  useDynamicUrl.value = false
  trackScanStatistics.value = false
  dynamicLinkSlug.value = ''
  isCustomizingDynamicLink.value = false
  dynamicLinkError.value = ''
  resetDynamicLinkAvailability()
  activeDynamicLink.value = null
}

function isDefaultCurrentQrDraftPayload(payload: CurrentQrDraftPayload) {
  return payload.url === ''
    && payload.colorName === null
    && payload.colorStep === 500
    && payload.label === ''
    && payload.additionalText === ''
    && payload.additionalTextPlacement === 'below'
    && payload.labelPosition === 'top'
    && payload.labelFont === fallbackLabelFont.value
    && payload.additionalTextFont === fallbackLabelFont.value
    && payload.labelSizeStep === 0
    && payload.additionalTextSizeStep === 0
    && isDefaultCircleLabels(payload.circleLabels)
    && payload.centerIcon === 'none'
    && payload.border === 'none'
    && (!payload.shape || payload.shape === 'rectangle')
    && (!payload.gradientStyle || payload.gradientStyle === 'none')
    && (!payload.gradientDirection || payload.gradientDirection === 'left-to-right')
    && !payload.gradientSecondColorName
    && !payload.gradientThirdColorName
    && !payload.activeTool
    && !payload.activeCenterIconCategory
    && !payload.centerIconSearch
    && !payload.dynamicLink
}

function isDefaultCircleLabels(payload: SavedQrPayload['circleLabels']) {
  if (!payload) {
    return true
  }

  return circleLabelControls.every((control) => {
    const label = payload[control.value]

    return !label
      || (label.text === ''
        && label.font === fallbackLabelFont.value
        && label.sizeStep === 0
        && (!label.orientation || label.orientation === getDefaultCircleLabelOrientation(control.value)))
  })
}

function normalizeActiveTool(value: unknown): QrTool | null {
  if (!hasQrContent.value || !isQrTool(value)) {
    return null
  }

  if ((value === 'step' || value === 'gradient') && !selectedQrColor.value) {
    return 'colors'
  }

  return value
}

function normalizeCenterIconCategory(value: unknown) {
  return typeof value === 'string' && centerIconCategoryList.some(category => category.value === value)
    ? value
    : null
}

function isQrTool(value: unknown): value is QrTool {
  return value === 'shape'
    || value === 'colors'
    || value === 'step'
    || value === 'gradient'
    || value === 'label'
    || value === 'icon'
    || value === 'border'
}

function isQrShape(value: unknown): value is QrShape {
  return value === 'rectangle' || value === 'circle'
}

function clampTextSizeStep(value: unknown) {
  return typeof value === 'number' ? Math.min(Math.max(Math.round(value), minTextSizeStep), 8) : 0
}

function clampAdditionalTextSizeStep(value: unknown) {
  return typeof value === 'number' ? Math.min(Math.max(Math.round(value), minTextSizeStep), maxAdditionalTextSizeStep) : 0
}

function getDefaultQrName() {
  try {
    const url = new URL(qrStore.content)

    return url.hostname.replace(/^www\./, '') || 'QR Code'
  } catch {
    return qrLabel.value.trim() || qrStore.content.slice(0, 60) || 'QR Code'
  }
}

async function createLabelPrintPayload(): Promise<LabelPrintPayload> {
  const sourceSvg = outputSvgElement.value

  if (!sourceSvg) {
    throw new Error('QR preview is not available.')
  }

  const clonedSvg = sourceSvg.cloneNode(true) as SVGSVGElement

  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clonedSvg.setAttribute('width', `${outputSvgWidth.value}`)
  clonedSvg.setAttribute('height', `${outputSvgHeight.value}`)

  inlineComputedSvgStyles(sourceSvg, clonedSvg)
  await embedUsedSvgFontFaces(clonedSvg)
  await inlineSvgImages(clonedSvg)

  return {
    createdAt: Date.now(),
    height: outputSvgHeight.value,
    name: getDefaultQrName(),
    qrPayload: createSavedQrPayload(),
    qrShape: selectedQrShape.value,
    svg: new XMLSerializer().serializeToString(clonedSvg),
    title: qrContent.value,
    url: qrContent.value,
    width: outputSvgWidth.value,
    ...(hasDynamicQrFeature.value ? { dynamicLink: createDynamicQrLinkPayload() } : {})
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { message?: string, statusMessage?: string } }).data
    const message = data?.statusMessage || data?.message

    if (message) {
      return message
    }
  }

  return error instanceof Error ? error.message : fallback
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

function updateIconScrollState() {
  const scroller = iconScroller.value

  if (!scroller || activeTool.value !== 'icon') {
    hasIconsBefore.value = false
    hasIconsAfter.value = false
    return
  }

  const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth

  hasIconsBefore.value = scroller.scrollLeft > 1
  hasIconsAfter.value = scroller.scrollLeft < maxScrollLeft - 1
}

async function refreshIconScrollState() {
  await nextTick()
  updateIconScrollState()
}

function updateScrollStates() {
  updateColorScrollState()
  updateIconScrollState()
}

function dismissHomepageDescription() {
  homepageDescriptionDismissedCookie.value = '1'

  if (import.meta.client) {
    document.cookie = `${homepageDescriptionDismissedCookieName}=1; Max-Age=${homepageDescriptionDismissedCookieMaxAge}; Path=/; SameSite=Lax`
  }
}

onMounted(async () => {
  if (!restoreSavedQrPayloadFromStorage()) {
    restoreCurrentQrDraftFromStorage()
  }

  await nextTick()
  updateScrollStates()
  window.addEventListener('resize', updateScrollStates)
  window.addEventListener('pagehide', persistCurrentQrDraft)

  await updateTextMeasurements()
  void document.fonts?.ready.then(updateTextMeasurements)
})

watch([labelText, longestAdditionalTextLine, selectedLabelFont, selectedAdditionalTextFont, qrOutputSize], updateTextMeasurements, { flush: 'post' })
watch([activeTool, centerIconSearchTerm, activeCenterIconCategory], () => {
  void refreshIconScrollState()
}, { flush: 'post' })
watch(hasQrContent, (hasContent) => {
  if (!hasContent) {
    activeTool.value = null
  }
})
watch(hasDynamicQrFeature, (enabled) => {
  if (enabled && !normalizedDynamicLinkSlug.value) {
    dynamicLinkSlug.value = createRandomDynamicQrSlug()
  }

  if (!enabled) {
    isCustomizingDynamicLink.value = false
  }

  dynamicLinkError.value = ''
  resetDynamicLinkAvailability()
})
watch([() => qrStore.url, useDynamicUrl, trackScanStatistics, dynamicLinkSlug], () => {
  dynamicLinkError.value = ''
})
watch([normalizedDynamicLinkSlug, isCustomizingDynamicLink, hasDynamicQrFeature, activeDynamicLink], () => {
  scheduleDynamicLinkAvailabilityCheck()
})
watch([
  () => qrStore.url,
  useDynamicUrl,
  trackScanStatistics,
  dynamicLinkSlug,
  activeDynamicLink,
  selectedQrColor,
  selectedColorStep,
  selectedGradientStyle,
  selectedGradientDirection,
  selectedGradientSecondColorName,
  selectedGradientThirdColorName,
  labelSizeStep,
  additionalTextSizeStep,
  circleLabelTopSizeStep,
  circleLabelBottomSizeStep,
  circleLabelLeftSizeStep,
  circleLabelRightSizeStep,
  circleLabelTopOrientation,
  circleLabelBottomOrientation,
  circleLabelLeftOrientation,
  circleLabelRightOrientation,
  qrLabel,
  qrAdditionalText,
  circleLabelTop,
  circleLabelBottom,
  circleLabelLeft,
  circleLabelRight,
  selectedAdditionalTextPlacement,
  selectedLabelPosition,
  selectedLabelFont,
  selectedAdditionalTextFont,
  selectedCircleLabelTopFont,
  selectedCircleLabelBottomFont,
  selectedCircleLabelLeftFont,
  selectedCircleLabelRightFont,
  selectedCenterIcon,
  selectedBorder,
  selectedQrShape,
  activeTool,
  activeCenterIconCategory,
  centerIconSearch
], persistCurrentQrDraft)

onBeforeRouteLeave(() => {
  persistCurrentQrDraft()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScrollStates)
  window.removeEventListener('pagehide', persistCurrentQrDraft)
  resetDynamicLinkAvailability()
})
</script>

<template>
  <UContainer
    data-testid="qr-builder-page"
    class="flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col gap-4 py-4 sm:gap-6 sm:py-6"
  >
    <section
      v-if="shouldShowHomepageDescription"
      aria-label="QR code creator description"
      class="homepage-description relative rounded-lg p-px"
    >
      <div class="homepage-description-content relative rounded-[calc(0.5rem-1px)] px-4 py-3 pr-12 text-sm leading-6 text-slate-700 dark:text-slate-100">
        <p>
          Create QR Codes for Menus, Waivers, Websites, Events, Documents, Tickets, Reviews, Music, Payment, Chat and more. Enter your URL. Customize the look and feel, and then select the label size you would like to print your QR Code on.
        </p>
        <p class="mt-2">
          <NuxtLink
            to="/register"
            class="font-semibold text-primary underline underline-offset-2 transition hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Register
          </NuxtLink>
          for an account to Save Draft QR Code designs.
        </p>
        <button
          aria-label="Dismiss homepage description"
          class="absolute right-2 top-2 inline-grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-white/60 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          type="button"
          @click="dismissHomepageDescription"
        >
          <UIcon
            aria-hidden="true"
            name="i-lucide-x"
            class="size-4"
          />
        </button>
      </div>
    </section>

    <UCard>
      <UFormField label="URL">
        <UFieldGroup class="w-full">
          <UInput
            v-model="qrStore.url"
            autofocus
            class="min-w-0 flex-1"
            icon="i-lucide-link"
            size="xl"
            type="url"
          />
          <UButton
            aria-label="Clear current QR code"
            color="neutral"
            icon="i-lucide-rotate-ccw"
            size="xl"
            variant="subtle"
            @click="clearCurrentQr"
          >
            Clear
          </UButton>
        </UFieldGroup>
        <p
          v-if="!hasQrContent"
          class="mt-2 text-sm text-muted"
        >
          {{ generatedQr.error }}
        </p>
      </UFormField>

      <div
        v-if="shouldShowDynamicQrControls"
        class="mt-3"
        :class="hasDynamicQrFeature ? 'space-y-2' : 'flex flex-wrap gap-2'"
      >
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <UButton
            :aria-checked="useDynamicUrl"
            :aria-describedby="useDynamicUrl ? 'dynamic-url-editable-description' : undefined"
            :color="useDynamicUrl ? 'primary' : 'neutral'"
            :icon="useDynamicUrl ? 'i-lucide-square-check' : 'i-lucide-square'"
            role="checkbox"
            size="sm"
            :variant="useDynamicUrl ? 'solid' : 'subtle'"
            @click="useDynamicUrl = !useDynamicUrl"
          >
            Editable
          </UButton>
          <p
            v-if="useDynamicUrl"
            id="dynamic-url-editable-description"
            class="text-xs leading-5 text-muted"
          >
            Use a Dynamic URL that I can update later
          </p>
        </div>
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <UButton
            :aria-checked="trackScanStatistics"
            :aria-describedby="trackScanStatistics ? 'dynamic-url-stats-description' : undefined"
            :color="trackScanStatistics ? 'primary' : 'neutral'"
            :icon="trackScanStatistics ? 'i-lucide-square-check' : 'i-lucide-square'"
            role="checkbox"
            size="sm"
            :variant="trackScanStatistics ? 'solid' : 'subtle'"
            @click="trackScanStatistics = !trackScanStatistics"
          >
            Track Stats
          </UButton>
          <p
            v-if="trackScanStatistics"
            id="dynamic-url-stats-description"
            class="text-xs leading-5 text-muted"
          >
            Track Statistics on when and where the QR Code is scanned
          </p>
        </div>
      </div>
      <div
        v-if="shouldShowDynamicQrControls && hasDynamicQrFeature"
        class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-muted dark:border-slate-800 dark:bg-slate-900/40"
      >
        <p>{{ dynamicLinkFeatureDescription }}</p>
        <p class="mt-1 font-medium text-highlighted">
          {{ dynamicLinkCreditMessage }}
        </p>

        <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div class="min-w-0 flex-1 rounded-md bg-white px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200 break-all dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800">
            {{ dynamicLinkRedirectUrl }}
          </div>
          <UButton
            v-if="!isCustomizingDynamicLink"
            class="justify-center"
            color="neutral"
            icon="i-lucide-pencil"
            size="sm"
            variant="subtle"
            @click="isCustomizingDynamicLink = !isCustomizingDynamicLink"
          >
            Customize Link.
          </UButton>
        </div>

        <div
          v-if="isCustomizingDynamicLink"
          class="mt-3 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
        >
          <span class="font-mono text-xs text-muted">qrcodesonlabels.com/redirect/</span>
          <UInput
            :model-value="dynamicLinkSlug"
            autocomplete="off"
            class="w-full"
            icon="i-lucide-link-2"
            placeholder="custom-slug"
            size="sm"
            @update:model-value="updateDynamicLinkSlug"
          />
          <UButton
            class="justify-center"
            icon="i-lucide-save"
            :disabled="!canSaveDynamicLinkUpdate"
            :loading="isSavingDynamicLink"
            size="sm"
            @click="saveDynamicLinkUpdate"
          >
            Save Update
          </UButton>
        </div>

        <p
          v-if="dynamicLinkAvailabilityMessage"
          aria-live="polite"
          class="mt-2 text-xs font-medium"
          :class="dynamicLinkAvailabilityMessageClass"
        >
          {{ dynamicLinkAvailabilityMessage }}
        </p>

        <p
          v-if="dynamicLinkError"
          class="mt-2 text-xs font-medium text-error"
        >
          {{ dynamicLinkError }}
        </p>
      </div>
    </UCard>

    <div
      v-if="hasQrContent"
      data-testid="qr-builder-workspace"
      class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,34rem)] xl:items-start"
    >
      <div
        data-testid="qr-builder-controls"
        class="min-w-0 space-y-3"
      >
        <div class="flex flex-wrap items-center gap-2">
          <div
            aria-label="QR code tools"
            class="flex flex-wrap items-center gap-2"
            role="toolbar"
          >
            <UButton
              :aria-pressed="activeTool === 'shape'"
              :color="activeTool === 'shape' ? 'primary' : 'neutral'"
              icon="i-lucide-shapes"
              :variant="activeTool === 'shape' ? 'solid' : 'subtle'"
              @click="selectTool('shape')"
            >
              Shape
            </UButton>
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
              <UButton
                v-if="selectedQrColor"
                :aria-pressed="activeTool === 'gradient'"
                :color="activeTool === 'gradient' ? 'primary' : 'neutral'"
                icon="i-lucide-sparkles"
                :variant="activeTool === 'gradient' ? 'solid' : 'subtle'"
                @click="selectTool('gradient')"
              >
                Gradient
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
              :icon="isCircleShape ? 'i-lucide-circle' : 'i-lucide-square'"
              :variant="activeTool === 'border' ? 'solid' : 'subtle'"
              @click="selectTool('border')"
            >
              Border
            </UButton>
          </div>
        </div>

        <div
          v-if="activeTool === 'shape'"
          aria-label="QR code shape"
          class="flex gap-2 overflow-x-auto overscroll-x-contain pb-2"
          role="radiogroup"
        >
          <button
            v-for="option in qrShapeOptions"
            :key="option.value"
            :aria-label="option.label"
            :aria-checked="selectedQrShape === option.value"
            class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition"
            :class="selectedQrShape === option.value ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
            role="radio"
            type="button"
            @click="selectQrShape(option.value)"
          >
            <UIcon
              :name="option.icon"
              class="size-4"
            />
            <span>{{ option.label }}</span>
          </button>
        </div>

        <div
          v-else-if="activeTool === 'colors'"
          class="relative"
        >
          <div
            ref="colorScroller"
            :class="mobileScrollDesktopWrapClasses"
            data-testid="qr-color-selector"
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
            class="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--ui-bg)] to-transparent md:hidden"
          />
          <div
            v-if="hasColorsAfter"
            aria-hidden="true"
            class="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--ui-bg)] to-transparent md:hidden"
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

          <div class="mt-4 flex justify-between text-xs font-medium text-muted">
            <span>Lighter</span>
            <span>Darker</span>
          </div>

          <USlider
            v-model="selectedColorStep"
            class="mt-1"
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
          v-else-if="activeTool === 'gradient'"
          class="space-y-5 rounded-lg border border-default bg-default p-4"
        >
          <div class="space-y-2">
            <span class="text-sm font-medium text-highlighted">Gradient</span>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="option in gradientStyleOptions"
                :key="option.value"
                :aria-pressed="selectedGradientStyle === option.value"
                :color="selectedGradientStyle === option.value ? 'primary' : 'neutral'"
                :icon="option.icon"
                size="sm"
                :variant="selectedGradientStyle === option.value ? 'solid' : 'subtle'"
                @click="selectGradientStyle(option.value)"
              >
                {{ option.label }}
              </UButton>
            </div>
          </div>

          <div
            v-if="selectedGradientStyle === 'directional'"
            class="space-y-2"
          >
            <span class="text-sm font-medium text-highlighted">Direction</span>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="option in gradientDirectionOptions"
                :key="option.value"
                :aria-pressed="selectedGradientDirection === option.value"
                :color="selectedGradientDirection === option.value ? 'primary' : 'neutral'"
                :icon="option.icon"
                size="sm"
                :variant="selectedGradientDirection === option.value ? 'solid' : 'subtle'"
                @click="selectGradientDirection(option.value)"
              >
                {{ option.label }}
              </UButton>
            </div>
          </div>

          <div
            v-if="gradientNeedsColors"
            class="space-y-2"
          >
            <span class="text-sm font-medium text-highlighted">2nd Color</span>
            <div
              :class="mobileScrollDesktopWrapClasses"
              data-testid="gradient-second-color-selector"
            >
              <button
                :aria-label="`Use ${blackColorName} as the 2nd gradient color`"
                :aria-pressed="isSelectedGradientColor(selectedGradientSecondColorName, blackColorName)"
                class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition"
                :class="isSelectedGradientColor(selectedGradientSecondColorName, blackColorName) ? 'border-primary bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
                type="button"
                @click="selectGradientSecondColor(blackColorName)"
              >
                <span
                  aria-hidden="true"
                  class="size-4 rounded-full bg-black ring-1 ring-black/10"
                />
                <span>{{ blackColorName }}</span>
              </button>

              <button
                v-for="color in tailwindColors"
                :key="`second-${color.name}`"
                :aria-label="`Use ${color.name} as the 2nd gradient color`"
                :aria-pressed="isSelectedGradientColor(selectedGradientSecondColorName, color.name)"
                class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition"
                :class="isSelectedGradientColor(selectedGradientSecondColorName, color.name) ? 'border-primary bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
                type="button"
                @click="selectGradientSecondColor(color.name)"
              >
                <span
                  aria-hidden="true"
                  class="size-4 rounded-full ring-1 ring-black/10"
                  :class="getTailwindColorClass(color, 'bg')"
                />
                <span>{{ color.name }}</span>
              </button>
            </div>
          </div>

          <div
            v-if="gradientNeedsColors"
            class="space-y-2"
          >
            <span class="text-sm font-medium text-highlighted">3rd Color</span>
            <div
              :class="mobileScrollDesktopWrapClasses"
              data-testid="gradient-third-color-selector"
            >
              <button
                aria-label="Use no 3rd gradient color"
                :aria-pressed="isSelectedGradientColor(selectedGradientThirdColorName, null)"
                class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition"
                :class="isSelectedGradientColor(selectedGradientThirdColorName, null) ? 'border-primary bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
                type="button"
                @click="selectGradientThirdColor(null)"
              >
                <UIcon
                  aria-hidden="true"
                  class="size-4"
                  name="i-lucide-ban"
                />
                <span>No 3rd Color</span>
              </button>

              <button
                :aria-label="`Use ${blackColorName} as the 3rd gradient color`"
                :aria-pressed="isSelectedGradientColor(selectedGradientThirdColorName, blackColorName)"
                class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition"
                :class="isSelectedGradientColor(selectedGradientThirdColorName, blackColorName) ? 'border-primary bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
                type="button"
                @click="selectGradientThirdColor(blackColorName)"
              >
                <span
                  aria-hidden="true"
                  class="size-4 rounded-full bg-black ring-1 ring-black/10"
                />
                <span>{{ blackColorName }}</span>
              </button>

              <button
                v-for="color in tailwindColors"
                :key="`third-${color.name}`"
                :aria-label="`Use ${color.name} as the 3rd gradient color`"
                :aria-pressed="isSelectedGradientColor(selectedGradientThirdColorName, color.name)"
                class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition"
                :class="isSelectedGradientColor(selectedGradientThirdColorName, color.name) ? 'border-primary bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
                type="button"
                @click="selectGradientThirdColor(color.name)"
              >
                <span
                  aria-hidden="true"
                  class="size-4 rounded-full ring-1 ring-black/10"
                  :class="getTailwindColorClass(color, 'bg')"
                />
                <span>{{ color.name }}</span>
              </button>
            </div>
          </div>
        </div>

        <div
          v-else-if="activeTool === 'label'"
          class="space-y-3"
        >
          <div
            v-if="!isCircleShape"
            data-testid="rectangle-label-position-controls"
          >
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
                  :class="selectedLabelPosition === option.value ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
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
            v-if="isCircleShape"
            class="space-y-3"
            data-testid="circle-label-controls"
          >
            <div
              v-for="control in circleLabelControls"
              :key="control.value"
              :class="[mobileLabelSectionBoxClasses, 'grid grid-cols-[minmax(0,1fr)_4rem] gap-3 min-[620px]:grid-cols-[minmax(0,1fr)_10.5rem_6rem_4rem]']"
              :data-testid="`circle-label-mobile-section-${control.value}`"
            >
              <UFormField
                :label="control.label"
                class="col-span-2 min-[620px]:col-span-1"
                :ui="mobileLabelSectionUi"
              >
                <UInput
                  :model-value="getCircleLabelText(control.value)"
                  class="w-full"
                  icon="i-lucide-type"
                  :placeholder="control.placeholder"
                  size="lg"
                  @update:model-value="setCircleLabelText(control.value, String($event))"
                />
              </UFormField>

              <UFormField
                class="col-span-2 min-[620px]:col-span-1"
                label="Font"
              >
                <USelect
                  :model-value="getCircleLabelFontValue(control.value)"
                  class="w-full"
                  :items="labelFontItems"
                  size="lg"
                  @update:model-value="setCircleLabelFont(control.value, String($event))"
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

              <UFormField label="Size">
                <UFieldGroup
                  class="w-full"
                  size="lg"
                >
                  <UButton
                    :aria-label="`Decrease ${control.label.toLowerCase()} circle label size`"
                    class="flex-1 justify-center disabled:bg-white disabled:text-slate-400 dark:disabled:bg-white"
                    color="neutral"
                    :disabled="!canDecreaseCircleLabelSize(control.value)"
                    icon="i-lucide-minus"
                    size="lg"
                    variant="subtle"
                    @click="decreaseCircleLabelSize(control.value)"
                  />
                  <UButton
                    :aria-label="`Increase ${control.label.toLowerCase()} circle label size`"
                    class="flex-1 justify-center disabled:bg-white disabled:text-slate-400 dark:disabled:bg-white"
                    color="neutral"
                    :disabled="!canIncreaseCircleLabelSize(control.value)"
                    icon="i-lucide-plus"
                    size="lg"
                    variant="subtle"
                    @click="increaseCircleLabelSize(control.value)"
                  />
                </UFieldGroup>
              </UFormField>

              <UFormField label="Flip">
                <UButton
                  :aria-label="getCircleLabelFlipAriaLabel(control.value)"
                  class="w-full justify-center"
                  color="neutral"
                  :icon="getCircleLabelFlipIcon(control.value)"
                  size="lg"
                  variant="subtle"
                  @click="toggleCircleLabelOrientation(control.value)"
                />
              </UFormField>
            </div>
          </div>

          <div
            v-if="!isCircleShape"
            class="space-y-4 min-[620px]:hidden"
            data-testid="rectangle-label-mobile-controls"
          >
            <div
              :class="[mobileLabelSectionBoxClasses, 'grid gap-3']"
              data-testid="rectangle-label-mobile-section-label"
            >
              <UFormField
                label="Label"
                :ui="mobileLabelSectionUi"
              >
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

              <UFormField label="Size">
                <UFieldGroup
                  class="w-full"
                  size="lg"
                >
                  <UButton
                    aria-label="Decrease label size"
                    class="flex-1 justify-center disabled:bg-white disabled:text-slate-400 dark:disabled:bg-white"
                    color="neutral"
                    :disabled="!canDecreaseLabelSize"
                    icon="i-lucide-minus"
                    size="lg"
                    variant="subtle"
                    @click="decreaseLabelSize"
                  />
                  <UButton
                    aria-label="Increase label size"
                    class="flex-1 justify-center disabled:bg-white disabled:text-slate-400 dark:disabled:bg-white"
                    color="neutral"
                    :disabled="!canIncreaseLabelSize"
                    icon="i-lucide-plus"
                    size="lg"
                    variant="subtle"
                    @click="increaseLabelSize"
                  />
                </UFieldGroup>
              </UFormField>
            </div>

            <div
              :class="[mobileLabelSectionBoxClasses, 'grid gap-3']"
              data-testid="rectangle-label-mobile-section-additional"
            >
              <div class="flex items-center justify-between gap-3">
                <label
                  class="text-base font-bold text-highlighted"
                  for="qr-additional-text-mobile"
                >
                  Additional Text
                </label>
                <UFieldGroup size="xs">
                  <UButton
                    :aria-pressed="selectedAdditionalTextPlacement === 'above'"
                    :color="selectedAdditionalTextPlacement === 'above' ? 'primary' : 'neutral'"
                    :variant="selectedAdditionalTextPlacement === 'above' ? 'solid' : 'subtle'"
                    @click="selectAdditionalTextPlacement('above')"
                  >
                    Above
                  </UButton>
                  <UButton
                    :aria-pressed="selectedAdditionalTextPlacement === 'below'"
                    :color="selectedAdditionalTextPlacement === 'below' ? 'primary' : 'neutral'"
                    :variant="selectedAdditionalTextPlacement === 'below' ? 'solid' : 'subtle'"
                    @click="selectAdditionalTextPlacement('below')"
                  >
                    Below
                  </UButton>
                </UFieldGroup>
              </div>

              <UInput
                id="qr-additional-text-mobile"
                v-model="qrAdditionalText"
                class="w-full"
                icon="i-lucide-text-cursor-input"
                :maxlength="maxAdditionalTextLength"
                placeholder="Add smaller text"
                size="lg"
              />

              <UFormField label="Font">
                <USelect
                  v-model="selectedAdditionalTextFont"
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

              <UFormField label="Size">
                <UFieldGroup
                  class="w-full"
                  size="lg"
                >
                  <UButton
                    aria-label="Decrease additional text size"
                    class="flex-1 justify-center disabled:bg-white disabled:text-slate-400 dark:disabled:bg-white"
                    color="neutral"
                    :disabled="!canDecreaseAdditionalTextSize"
                    icon="i-lucide-minus"
                    size="lg"
                    variant="subtle"
                    @click="decreaseAdditionalTextSize"
                  />
                  <UButton
                    aria-label="Increase additional text size"
                    class="flex-1 justify-center disabled:bg-white disabled:text-slate-400 dark:disabled:bg-white"
                    color="neutral"
                    :disabled="!canIncreaseAdditionalTextSize"
                    icon="i-lucide-plus"
                    size="lg"
                    variant="subtle"
                    @click="increaseAdditionalTextSize"
                  />
                </UFieldGroup>
              </UFormField>
            </div>
          </div>

          <div
            v-if="!isCircleShape"
            class="hidden gap-3 min-[620px]:grid min-[620px]:grid-cols-[minmax(0,1fr)_10.5rem_6rem]"
            data-testid="rectangle-label-desktop-primary-controls"
          >
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

            <UFormField label="Size">
              <UFieldGroup
                class="w-full"
                size="lg"
              >
                <UButton
                  aria-label="Decrease label size"
                  class="flex-1 justify-center disabled:bg-white disabled:text-slate-400 dark:disabled:bg-white"
                  color="neutral"
                  :disabled="!canDecreaseLabelSize"
                  icon="i-lucide-minus"
                  size="lg"
                  variant="subtle"
                  @click="decreaseLabelSize"
                />
                <UButton
                  aria-label="Increase label size"
                  class="flex-1 justify-center disabled:bg-white disabled:text-slate-400 dark:disabled:bg-white"
                  color="neutral"
                  :disabled="!canIncreaseLabelSize"
                  icon="i-lucide-plus"
                  size="lg"
                  variant="subtle"
                  @click="increaseLabelSize"
                />
              </UFieldGroup>
            </UFormField>
          </div>

          <div
            v-if="!isCircleShape"
            class="hidden gap-x-3 gap-y-1.5 min-[620px]:grid min-[620px]:grid-cols-[minmax(0,1fr)_10.5rem_6rem]"
            data-testid="rectangle-label-desktop-additional-controls"
          >
            <div class="flex h-6 items-center justify-between gap-3">
              <label
                class="text-sm font-medium text-highlighted"
                for="qr-additional-text"
              >
                Additional Text
              </label>
              <UFieldGroup size="xs">
                <UButton
                  :aria-pressed="selectedAdditionalTextPlacement === 'above'"
                  :color="selectedAdditionalTextPlacement === 'above' ? 'primary' : 'neutral'"
                  :variant="selectedAdditionalTextPlacement === 'above' ? 'solid' : 'subtle'"
                  @click="selectAdditionalTextPlacement('above')"
                >
                  Above
                </UButton>
                <UButton
                  :aria-pressed="selectedAdditionalTextPlacement === 'below'"
                  :color="selectedAdditionalTextPlacement === 'below' ? 'primary' : 'neutral'"
                  :variant="selectedAdditionalTextPlacement === 'below' ? 'solid' : 'subtle'"
                  @click="selectAdditionalTextPlacement('below')"
                >
                  Below
                </UButton>
              </UFieldGroup>
            </div>

            <span
              id="qr-additional-font-label"
              class="flex h-6 items-center text-sm font-medium text-highlighted"
            >
              Font
            </span>

            <span
              id="qr-additional-size-label"
              class="flex h-6 items-center text-sm font-medium text-highlighted"
            >
              Size
            </span>

            <UInput
              id="qr-additional-text"
              v-model="qrAdditionalText"
              class="w-full"
              icon="i-lucide-text-cursor-input"
              :maxlength="maxAdditionalTextLength"
              placeholder="Add smaller text"
              size="lg"
            />

            <USelect
              v-model="selectedAdditionalTextFont"
              aria-labelledby="qr-additional-font-label"
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

            <UFieldGroup
              aria-labelledby="qr-additional-size-label"
              class="w-full"
              size="lg"
            >
              <UButton
                aria-label="Decrease additional text size"
                class="flex-1 justify-center disabled:bg-white disabled:text-slate-400 dark:disabled:bg-white"
                color="neutral"
                :disabled="!canDecreaseAdditionalTextSize"
                icon="i-lucide-minus"
                size="lg"
                variant="subtle"
                @click="decreaseAdditionalTextSize"
              />
              <UButton
                aria-label="Increase additional text size"
                class="flex-1 justify-center disabled:bg-white disabled:text-slate-400 dark:disabled:bg-white"
                color="neutral"
                :disabled="!canIncreaseAdditionalTextSize"
                icon="i-lucide-plus"
                size="lg"
                variant="subtle"
                @click="increaseAdditionalTextSize"
              />
            </UFieldGroup>
          </div>
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
            class="relative"
          >
            <div
              ref="iconScroller"
              aria-label="Matching center icons"
              :class="mobileScrollDesktopWrapClasses"
              data-testid="center-icon-selector"
              role="radiogroup"
              @scroll="updateIconScrollState"
            >
              <button
                v-for="icon in filteredCenterIconOptions"
                :key="icon.value"
                :aria-label="`Use ${icon.label} as the center icon`"
                :aria-checked="selectedCenterIcon === icon.value"
                class="flex min-w-24 shrink-0 flex-col items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition"
                :class="selectedCenterIcon === icon.value ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
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
              v-if="hasIconsBefore"
              aria-hidden="true"
              class="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--ui-bg)] to-transparent md:hidden"
            />
            <div
              v-if="hasIconsAfter"
              aria-hidden="true"
              class="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--ui-bg)] to-transparent md:hidden"
            />
          </div>

          <div
            v-else-if="!activeCenterIconCategory"
            class="relative"
          >
            <div
              ref="iconScroller"
              aria-label="Center icon folders"
              :class="mobileScrollDesktopWrapClasses"
              data-testid="center-icon-selector"
              @scroll="updateIconScrollState"
            >
              <button
                :aria-checked="selectedCenterIcon === 'none'"
                aria-label="Use no center icon"
                class="flex min-w-24 shrink-0 flex-col items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition"
                :class="selectedCenterIcon === 'none' ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
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
                :class="isCenterIconCategorySelected(category) ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
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
              v-if="hasIconsBefore"
              aria-hidden="true"
              class="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--ui-bg)] to-transparent md:hidden"
            />
            <div
              v-if="hasIconsAfter"
              aria-hidden="true"
              class="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--ui-bg)] to-transparent md:hidden"
            />
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
                @click="showParentCenterIconCategory"
              >
                {{ activeCenterIconBackLabel }}
              </UButton>
              <span class="text-sm font-medium text-highlighted">{{ activeCenterIconCategoryDetails?.label }}</span>
            </div>

            <div class="relative">
              <div
                ref="iconScroller"
                aria-label="Center icons in folder"
                :class="mobileScrollDesktopWrapClasses"
                data-testid="center-icon-selector"
                role="radiogroup"
                @scroll="updateIconScrollState"
              >
                <button
                  v-for="category in activeCenterIconSubcategories"
                  :key="category.value"
                  :aria-label="`Open ${category.label} icons`"
                  class="flex min-w-24 shrink-0 flex-col items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition"
                  :class="isCenterIconCategorySelected(category) ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
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

                <button
                  v-for="icon in activeCenterIconCategoryIcons"
                  :key="icon.value"
                  :aria-label="`Use ${icon.label} as the center icon`"
                  :aria-checked="selectedCenterIcon === icon.value"
                  class="flex min-w-24 shrink-0 flex-col items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition"
                  :class="selectedCenterIcon === icon.value ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
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

              <div
                v-if="hasIconsBefore"
                aria-hidden="true"
                class="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--ui-bg)] to-transparent md:hidden"
              />
              <div
                v-if="hasIconsAfter"
                aria-hidden="true"
                class="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--ui-bg)] to-transparent md:hidden"
              />
            </div>
          </div>
        </div>

        <div
          v-else-if="activeTool === 'border'"
          aria-label="Border style"
          :class="mobileScrollDesktopWrapClasses"
          data-testid="border-style-selector"
          role="radiogroup"
        >
          <button
            v-for="border in borderStyles"
            :key="border.value"
            :aria-label="border.label"
            :aria-checked="selectedBorder === border.value"
            class="grid size-14 shrink-0 place-items-center rounded-xl border transition"
            :class="selectedBorder === border.value ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
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
                :stroke-linecap="getPreviewStrokeLineCap(line)"
                :stroke-linejoin="getBorderStrokeLineJoin(line) ?? 'miter'"
                :stroke-width="getPreviewStrokeWidth(line)"
              />
            </svg>
          </button>
        </div>

        <UAlert
          v-if="generatedQr.error"
          color="warning"
          icon="i-lucide-triangle-alert"
          :title="generatedQr.error"
          variant="subtle"
        />
        <UAlert
          v-if="printLabelError"
          color="warning"
          icon="i-lucide-triangle-alert"
          :title="printLabelError"
          variant="subtle"
        />
      </div>

      <div
        data-testid="qr-builder-preview-column"
        class="min-w-0 space-y-4 xl:sticky xl:top-20"
      >
        <section class="flex justify-center">
          <UCard
            data-testid="qr-preview-card"
            :class="qrPreviewCardClass"
          >
            <div
              data-testid="qr-preview-surface"
              :class="qrPreviewSurfaceClass"
            >
              <svg
                v-if="generatedQr.code"
                ref="outputSvgElement"
                aria-label="Generated QR code"
                class="h-auto w-full"
                :data-error-correction-level="generatedQr.code.errorCorrectionLevel"
                role="img"
                :viewBox="outputViewBox"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  v-if="isCircleShape"
                  class="fill-white"
                  data-testid="qr-circle-background"
                  :cx="outputSvgWidth / 2"
                  :cy="outputSvgHeight / 2"
                  :r="outputCircleRadius"
                />
                <rect
                  v-else
                  class="fill-white"
                  data-testid="qr-rectangle-background"
                  :height="outputSvgHeight"
                  :width="outputSvgWidth"
                />
                <defs v-if="hasActiveGradient || hasCircleLabelText">
                  <template v-if="hasActiveGradient">
                    <linearGradient
                      v-if="selectedGradientStyle === 'directional'"
                      id="qr-border-gradient"
                      gradientUnits="userSpaceOnUse"
                      v-bind="borderLinearGradientCoordinates"
                    >
                      <stop
                        v-for="stop in gradientStops"
                        :key="`border-${stop.key}`"
                        :class="stop.textClass"
                        :offset="stop.offset"
                        stop-color="currentColor"
                      />
                    </linearGradient>
                    <radialGradient
                      v-else
                      id="qr-border-gradient"
                      gradientUnits="userSpaceOnUse"
                      v-bind="borderRadialGradientCoordinates"
                    >
                      <stop
                        v-for="stop in gradientStops"
                        :key="`border-${stop.key}`"
                        :class="stop.textClass"
                        :offset="stop.offset"
                        stop-color="currentColor"
                      />
                    </radialGradient>
                    <linearGradient
                      v-if="selectedGradientStyle === 'directional'"
                      id="qr-artwork-gradient"
                      gradientUnits="userSpaceOnUse"
                      v-bind="qrArtworkLinearGradientCoordinates"
                    >
                      <stop
                        v-for="stop in gradientStops"
                        :key="`artwork-${stop.key}`"
                        :class="stop.textClass"
                        :offset="stop.offset"
                        stop-color="currentColor"
                      />
                    </linearGradient>
                    <radialGradient
                      v-else
                      id="qr-artwork-gradient"
                      gradientUnits="userSpaceOnUse"
                      v-bind="qrArtworkRadialGradientCoordinates"
                    >
                      <stop
                        v-for="stop in gradientStops"
                        :key="`artwork-${stop.key}`"
                        :class="stop.textClass"
                        :offset="stop.offset"
                        stop-color="currentColor"
                      />
                    </radialGradient>
                    <linearGradient
                      v-if="selectedGradientStyle === 'directional'"
                      id="qr-text-gradient"
                      gradientUnits="userSpaceOnUse"
                      v-bind="textLinearGradientCoordinates"
                    >
                      <stop
                        v-for="stop in gradientStops"
                        :key="`text-${stop.key}`"
                        :class="stop.textClass"
                        :offset="stop.offset"
                        stop-color="currentColor"
                      />
                    </linearGradient>
                    <radialGradient
                      v-else
                      id="qr-text-gradient"
                      gradientUnits="userSpaceOnUse"
                      v-bind="textRadialGradientCoordinates"
                    >
                      <stop
                        v-for="stop in gradientStops"
                        :key="`text-${stop.key}`"
                        :class="stop.textClass"
                        :offset="stop.offset"
                        stop-color="currentColor"
                      />
                    </radialGradient>
                  </template>
                  <path
                    v-for="control in visibleCircleLabelControls"
                    :id="getCircleLabelPathId(control.value)"
                    :key="`circle-label-path-${control.value}`"
                    :d="getCircleLabelPath(control.value)"
                  />
                </defs>
                <g v-if="hasCircleBorder">
                  <template
                    v-for="line in selectedCircleBorderLines"
                    :key="`circle-${selectedBorder}-${line.inset}`"
                  >
                    <path
                      v-if="isPathBorderLine(line)"
                      :data-testid="`qr-circle-border-${line.inset}`"
                      :d="getCircleBorderPath(line)"
                      fill="none"
                      :class="borderStrokePaint ? undefined : qrStrokeClass"
                      :stroke="borderStrokePaint ?? undefined"
                      :stroke-linecap="getBorderStrokeLineCap(line)"
                      :stroke-linejoin="getBorderStrokeLineJoin(line)"
                      :stroke-width="line.strokeWidth"
                    />
                    <circle
                      v-else
                      :data-testid="`qr-circle-border-${line.inset}`"
                      fill="none"
                      :cx="line.cx"
                      :cy="line.cy"
                      :r="line.radius"
                      :class="borderStrokePaint ? undefined : qrStrokeClass"
                      :stroke="borderStrokePaint ?? undefined"
                      :stroke-width="line.strokeWidth"
                    />
                  </template>
                  <rect
                    class="fill-white"
                    data-testid="qr-circle-border-buffer"
                    :height="circleBorderBufferRect.height"
                    :width="circleBorderBufferRect.width"
                    :x="circleBorderBufferRect.x"
                    :y="circleBorderBufferRect.y"
                  />
                </g>
                <g shape-rendering="crispEdges">
                  <svg
                    :height="qrOutputSize"
                    :viewBox="`0 0 ${qrSvgSize} ${qrSvgSize}`"
                    :width="qrOutputSize"
                    :x="qrOutputX"
                    :y="qrOutputY"
                  >
                    <defs v-if="hasActiveGradient">
                      <linearGradient
                        v-if="selectedGradientStyle === 'directional'"
                        id="qr-path-gradient"
                        gradientUnits="userSpaceOnUse"
                        v-bind="qrPathLinearGradientCoordinates"
                      >
                        <stop
                          v-for="stop in gradientStops"
                          :key="`path-${stop.key}`"
                          :class="stop.textClass"
                          :offset="stop.offset"
                          stop-color="currentColor"
                        />
                      </linearGradient>
                      <radialGradient
                        v-else
                        id="qr-path-gradient"
                        gradientUnits="userSpaceOnUse"
                        v-bind="qrPathRadialGradientCoordinates"
                      >
                        <stop
                          v-for="stop in gradientStops"
                          :key="`path-${stop.key}`"
                          :class="stop.textClass"
                          :offset="stop.offset"
                          stop-color="currentColor"
                        />
                      </radialGradient>
                    </defs>
                    <path
                      :d="qrPath"
                      :class="qrPathFillPaint ? undefined : qrFillClass"
                      :fill="qrPathFillPaint ?? undefined"
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
                  <mask
                    id="center-icon-mask"
                    :height="centerIconSize"
                    mask-type="alpha"
                    maskUnits="userSpaceOnUse"
                    :width="centerIconSize"
                    :x="centerIconX"
                    :y="centerIconY"
                  >
                    <image
                      :href="selectedCenterIconOption.src"
                      :height="centerIconSize"
                      preserveAspectRatio="xMidYMid meet"
                      :width="centerIconSize"
                      :x="centerIconX"
                      :y="centerIconY"
                    />
                  </mask>
                  <rect
                    :class="qrArtworkFillPaint ? undefined : qrFillClass"
                    :fill="qrArtworkFillPaint ?? undefined"
                    :height="centerIconSize"
                    mask="url(#center-icon-mask)"
                    :width="centerIconSize"
                    :x="centerIconX"
                    :y="centerIconY"
                  />
                </template>
                <text
                  v-if="!isCircleShape && labelText"
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
                  v-if="!isCircleShape && longestAdditionalTextLine"
                  ref="additionalTextMeasureElement"
                  aria-hidden="true"
                  fill="currentColor"
                  :font-size="baseAdditionalTextFontSize"
                  opacity="0"
                  :class="[qrTextClass, selectedAdditionalTextFontClass]"
                >
                  {{ longestAdditionalTextLine }}
                </text>
                <text
                  v-if="!isCircleShape && labelText"
                  :fill="textFillPaint ?? 'currentColor'"
                  :font-size="labelFontSize"
                  :x="labelX"
                  :y="labelY"
                  dominant-baseline="central"
                  text-anchor="middle"
                  :class="textFillPaint ? selectedLabelFontClass : [qrTextClass, selectedLabelFontClass]"
                >
                  {{ labelText }}
                </text>
                <text
                  v-for="(line, index) in isCircleShape ? [] : additionalTextLines"
                  :key="`additional-text-${index}`"
                  :fill="textFillPaint ?? 'currentColor'"
                  :font-size="additionalTextFontSize"
                  font-weight="300"
                  opacity="0.68"
                  :x="labelX"
                  :y="getAdditionalTextLineY(index)"
                  dominant-baseline="central"
                  text-anchor="middle"
                  :class="textFillPaint ? selectedAdditionalTextFontClass : [qrTextClass, selectedAdditionalTextFontClass]"
                >
                  {{ line }}
                </text>
                <text
                  v-for="control in visibleCircleLabelControls"
                  :key="`circle-label-text-${control.value}`"
                  :data-testid="`qr-circle-label-${control.value}`"
                  :fill="textFillPaint ?? 'currentColor'"
                  :font-size="getCircleLabelFontSize(control.value)"
                  dominant-baseline="central"
                  text-anchor="middle"
                  :class="textFillPaint ? getCircleLabelFontClass(control.value) : [qrTextClass, getCircleLabelFontClass(control.value)]"
                >
                  <textPath
                    :href="getCircleLabelPathHref(control.value)"
                    :side="getCircleLabelPathSide(control.value)"
                    startOffset="50%"
                  >
                    {{ getCircleLabelText(control.value) }}
                  </textPath>
                </text>
                <template v-if="!isCircleShape">
                  <template
                    v-for="line in selectedBorderLines"
                    :key="`${selectedBorder}-${line.inset}`"
                  >
                    <path
                      v-if="isPathBorderLine(line)"
                      :data-testid="`qr-rectangle-border-${line.inset}`"
                      :d="getRectangleBorderPath(line)"
                      fill="none"
                      :class="borderStrokePaint ? undefined : qrStrokeClass"
                      :stroke="borderStrokePaint ?? undefined"
                      :stroke-linecap="getBorderStrokeLineCap(line)"
                      :stroke-linejoin="getBorderStrokeLineJoin(line)"
                      :stroke-width="line.strokeWidth"
                    />
                    <rect
                      v-else
                      :data-testid="`qr-rectangle-border-${line.inset}`"
                      fill="none"
                      :height="line.height"
                      :width="line.width"
                      :x="line.inset"
                      :y="line.inset"
                      :class="borderStrokePaint ? undefined : qrStrokeClass"
                      :stroke="borderStrokePaint ?? undefined"
                      :stroke-width="line.strokeWidth"
                    />
                  </template>
                </template>
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
          class="flex flex-col items-center justify-center gap-3"
        >
          <div
            class="flex w-full max-w-[min(86svw,68svh)] items-center gap-3"
            :class="isLoggedIn ? 'justify-between' : 'justify-end'"
          >
            <UButton
              v-if="isLoggedIn"
              color="neutral"
              icon="i-lucide-save"
              variant="subtle"
              @click="handleSaveButtonClick"
            >
              Save Draft QR Code
            </UButton>

            <UButton
              color="neutral"
              :disabled="isPreparingLabelPrint"
              :loading="isPreparingLabelPrint"
              variant="subtle"
              @click="goToPrintLabels"
            >
              <span>Print to Labels</span>
              <UIcon
                name="i-lucide-arrow-right"
                class="size-4"
              />
            </UButton>
          </div>

          <div class="flex items-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-scan-line" />
            <span>Version {{ generatedQr.code.version }} · {{ generatedQr.code.size }}×{{ generatedQr.code.size }} modules</span>
          </div>
        </div>
      </div>
    </div>

    <UModal
      v-model:open="isSaveDialogOpen"
      title="Save Draft QR Code"
      description="Name this draft QR code."
      :dismissible="!isSavingQr"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            v-if="saveQrError"
            color="warning"
            icon="i-lucide-triangle-alert"
            :title="saveQrError"
            variant="subtle"
          />

          <UFormField label="QR Code Name">
            <UInput
              v-model="saveQrName"
              autocomplete="off"
              class="w-full"
              icon="i-lucide-qr-code"
              size="lg"
            />
          </UFormField>

          <UFormField label="Tags">
            <UInput
              v-model="saveQrTagsInput"
              autocomplete="off"
              class="w-full"
              icon="i-lucide-tags"
              placeholder="menu, spring, table tents"
              size="lg"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            :disabled="isSavingQr"
            variant="subtle"
            @click="isSaveDialogOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            :disabled="!saveQrName.trim()"
            :loading="isSavingQr"
            @click="saveCurrentQr"
          >
            Save Draft QR Code
          </UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>

<style scoped>
@property --homepage-description-angle {
  syntax: '<angle>';
  inherits: true;
  initial-value: 0deg;
}

.homepage-description {
  --logo-blue: #0bb1d3;
  --logo-purple: #9d31fe;
  animation: homepage-description-glow-spin 14s linear infinite;
  background: conic-gradient(
    from var(--homepage-description-angle),
    rgb(11 177 211 / 92%),
    rgb(157 49 254 / 94%),
    rgb(11 177 211 / 92%)
  );
  box-shadow:
    0 0 6px rgb(11 177 211 / 18%),
    0 0 9px rgb(157 49 254 / 16%);
  isolation: isolate;
}

.homepage-description::before {
  position: absolute;
  inset: -4px;
  z-index: 0;
  background: conic-gradient(
    from var(--homepage-description-angle),
    transparent 0deg,
    rgb(11 177 211 / 82%) 65deg,
    rgb(157 49 254 / 88%) 160deg,
    transparent 250deg,
    rgb(11 177 211 / 82%) 360deg
  );
  border-radius: inherit;
  content: '';
  filter: blur(4px);
  opacity: 0.62;
  pointer-events: none;
}

.homepage-description-content {
  z-index: 1;
  background:
    conic-gradient(
      from var(--homepage-description-angle),
      rgb(11 177 211 / 9%),
      rgb(157 49 254 / 12%),
      rgb(11 177 211 / 9%)
    ),
    rgb(255 255 255 / 94%);
  backdrop-filter: blur(10px);
}

:global(.dark) .homepage-description-content {
  background:
    conic-gradient(
      from var(--homepage-description-angle),
      rgb(11 177 211 / 13%),
      rgb(157 49 254 / 17%),
      rgb(11 177 211 / 13%)
    ),
    rgb(2 6 23 / 92%);
}

@media (prefers-reduced-motion: reduce) {
  .homepage-description {
    animation: none;
  }
}

@keyframes homepage-description-glow-spin {
  to {
    --homepage-description-angle: 360deg;
  }
}
</style>
