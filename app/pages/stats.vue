<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSession } from '~~/lib/auth-client'
import type {
  DynamicQrAggregateRecentScan,
  DynamicQrAggregateStats,
  DynamicQrScanSummary,
  DynamicQrStatsRange,
  DynamicQrTopLinkSummary
} from '~/utils/dynamic-qr'

type StatsRangeOption = {
  label: string
  value: DynamicQrStatsRange
}

const rangeOptions: StatsRangeOption[] = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 365 days', value: '365d' }
]

const session = useSession()
const selectedRange = ref<DynamicQrStatsRange>('7d')
const stats = ref<DynamicQrAggregateStats | null>(null)
const statsError = ref('')
const isLoading = ref(false)
let statsRunId = 0

const isLoggedIn = computed(() => Boolean(session.value.data?.user))
const hasTrackedQrCodes = computed(() => (stats.value?.totalTrackedLinks ?? 0) > 0)
const hasScans = computed(() => (stats.value?.totalScans ?? 0) > 0)
const maxPeriodCount = computed(() => getMaxCount(stats.value?.scansByPeriod ?? []))
const maxCountryCount = computed(() => getMaxCount(stats.value?.scansByCountry ?? []))
const maxTopLinkCount = computed(() => getMaxCount(stats.value?.topLinks ?? []))
const selectedRangeLabel = computed(() =>
  rangeOptions.find(option => option.value === selectedRange.value)?.label || 'Last 7 days')
const metricCards = computed(() => [
  {
    icon: 'i-lucide-scan-line',
    label: 'Total Scans',
    tone: 'primary',
    value: formatNumber(stats.value?.totalScans ?? 0)
  },
  {
    icon: 'i-lucide-activity',
    label: 'Active QR Codes',
    tone: 'success',
    value: formatNumber(stats.value?.activeTrackedLinks ?? 0)
  },
  {
    icon: 'i-lucide-qr-code',
    label: 'QR Codes with Stats',
    tone: 'neutral',
    value: formatNumber(stats.value?.totalTrackedLinks ?? 0)
  },
  {
    icon: 'i-lucide-clock',
    label: 'Last Scan',
    tone: 'warning',
    value: stats.value?.lastScannedAt ? formatDate(stats.value.lastScannedAt) : 'Never'
  }
])

useSeoMeta({
  title: 'Stats | QR Codes On Labels',
  description: 'View aggregate scan statistics for your QR codes.'
})

onMounted(() => {
  if (isLoggedIn.value) {
    void loadStats()
  }
})

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    void loadStats()
    return
  }

  stats.value = null
})

watch(selectedRange, () => {
  if (isLoggedIn.value) {
    void loadStats()
  }
})

function selectRange(range: DynamicQrStatsRange) {
  selectedRange.value = range
}

async function loadStats() {
  const runId = statsRunId + 1

  statsRunId = runId
  isLoading.value = true
  statsError.value = ''

  try {
    const response = await $fetch<DynamicQrAggregateStats>('/api/qr/stats', {
      query: {
        range: selectedRange.value
      }
    })

    if (runId === statsRunId) {
      stats.value = response
    }
  } catch (error) {
    if (runId === statsRunId) {
      statsError.value = getErrorMessage(error, 'Unable to load stats.')
    }
  } finally {
    if (runId === statsRunId) {
      isLoading.value = false
    }
  }
}

function getMaxCount(rows: Array<Pick<DynamicQrScanSummary, 'count'>>) {
  return Math.max(1, ...rows.map(row => row.count))
}

function getBarWidth(count: number, maxCount: number) {
  return `${Math.max(4, Math.round((count / maxCount) * 100))}%`
}

function getMetricClasses(tone: string) {
  if (tone === 'primary') {
    return 'bg-primary/10 text-primary ring-primary/20'
  }

  if (tone === 'success') {
    return 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/50 dark:text-green-300 dark:ring-green-800'
  }

  if (tone === 'warning') {
    return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800'
  }

  return 'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatLocation(scan: DynamicQrAggregateRecentScan) {
  return [scan.city, scan.region, scan.country].filter(Boolean).join(', ') || 'Unknown location'
}

function formatPeriodLabel(label: string) {
  if (selectedRange.value === '24h') {
    const parsed = new Date(`${label.replace(' ', 'T')}:00Z`)

    return Number.isNaN(parsed.valueOf())
      ? label
      : new Intl.DateTimeFormat(undefined, {
          hour: 'numeric',
          month: 'short',
          day: 'numeric'
        }).format(parsed)
  }

  if (selectedRange.value === '365d') {
    const parsed = new Date(`${label}-01T00:00:00Z`)

    return Number.isNaN(parsed.valueOf())
      ? label
      : new Intl.DateTimeFormat(undefined, {
          month: 'short',
          year: 'numeric'
        }).format(parsed)
  }

  const parsed = new Date(`${label}T00:00:00Z`)

  return Number.isNaN(parsed.valueOf())
    ? label
    : new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric'
      }).format(parsed)
}

function topLinkDescription(link: DynamicQrTopLinkSummary) {
  return link.lastScannedAt
    ? `Last scan ${formatDate(link.lastScannedAt)}`
    : 'No scans yet'
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
</script>

<template>
  <UContainer class="flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col gap-4 py-4 sm:gap-6 sm:py-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">
          Stats
        </h1>
        <p class="mt-1 text-sm text-muted">
          Aggregate scan activity across every QR code with stats enabled.
        </p>
      </div>

      <UButton
        color="neutral"
        icon="i-lucide-qr-code"
        to="/saved-qr-codes"
        variant="subtle"
      >
        My QR Codes
      </UButton>
    </div>

    <UCard v-if="!isLoggedIn">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-base font-semibold text-highlighted">
            Login Required
          </h2>
          <p class="mt-1 text-sm text-muted">
            Stats are tied to your QR code account.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            to="/register?redirect=/stats"
            variant="subtle"
          >
            Register
          </UButton>
          <UButton to="/login?redirect=/stats">
            Login
          </UButton>
        </div>
      </div>
    </UCard>

    <template v-else>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          aria-label="Stats range"
          class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        >
          <UButton
            v-for="option in rangeOptions"
            :key="option.value"
            color="neutral"
            size="sm"
            :variant="selectedRange === option.value ? 'solid' : 'subtle'"
            :aria-pressed="selectedRange === option.value"
            @click="selectRange(option.value)"
          >
            {{ option.label }}
          </UButton>
        </div>

        <UButton
          class="justify-center"
          color="neutral"
          icon="i-lucide-refresh-cw"
          :loading="isLoading"
          variant="subtle"
          @click="loadStats"
        >
          Refresh
        </UButton>
      </div>

      <UAlert
        v-if="statsError"
        color="warning"
        icon="i-lucide-triangle-alert"
        :title="statsError"
        variant="subtle"
      />

      <UCard v-if="isLoading && !stats">
        <div class="flex items-center gap-2 text-sm text-muted">
          <UIcon
            name="i-lucide-loader-circle"
            class="animate-spin"
          />
          <span>Loading stats...</span>
        </div>
      </UCard>

      <template v-else-if="stats">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="metric in metricCards"
            :key="metric.label"
            class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="block text-sm font-medium text-muted">{{ metric.label }}</span>
                <span class="mt-2 block text-2xl font-semibold text-highlighted">{{ metric.value }}</span>
              </div>
              <span
                class="inline-flex size-9 shrink-0 items-center justify-center rounded-md ring-1"
                :class="getMetricClasses(metric.tone)"
              >
                <UIcon
                  aria-hidden="true"
                  class="size-4"
                  :name="metric.icon"
                />
              </span>
            </div>
          </div>
        </div>

        <UAlert
          v-if="!hasTrackedQrCodes"
          color="neutral"
          icon="i-lucide-chart-no-axes-column"
          title="No QR codes have stats enabled yet."
          variant="subtle"
        />

        <UAlert
          v-else-if="!hasScans"
          color="neutral"
          icon="i-lucide-clock"
          :title="`No scans in ${selectedRangeLabel.toLowerCase()}.`"
          variant="subtle"
        />

        <div
          v-if="hasTrackedQrCodes"
          class="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]"
        >
          <UCard>
            <div class="space-y-4">
              <div>
                <h2 class="text-base font-semibold text-highlighted">
                  Scans Over Time
                </h2>
                <p class="mt-1 text-sm text-muted">
                  {{ selectedRangeLabel }}
                </p>
              </div>

              <UAlert
                v-if="!stats.scansByPeriod.length"
                color="neutral"
                icon="i-lucide-chart-column"
                title="No scan activity for this range."
                variant="subtle"
              />

              <div
                v-else
                class="space-y-3"
              >
                <div
                  v-for="period in stats.scansByPeriod"
                  :key="period.label"
                  class="grid grid-cols-[5.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm"
                >
                  <span class="truncate text-xs text-muted">{{ formatPeriodLabel(period.label) }}</span>
                  <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                    <div
                      class="h-full rounded-full bg-primary"
                      :style="{ width: getBarWidth(period.count, maxPeriodCount) }"
                    />
                  </div>
                  <span class="text-right font-semibold text-highlighted">{{ formatNumber(period.count) }}</span>
                </div>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="space-y-4">
              <div>
                <h2 class="text-base font-semibold text-highlighted">
                  Top QR Codes
                </h2>
                <p class="mt-1 text-sm text-muted">
                  QR codes with the most scans in this range.
                </p>
              </div>

              <UAlert
                v-if="!stats.topLinks.length"
                color="neutral"
                icon="i-lucide-list"
                title="No scanned QR codes in this range."
                variant="subtle"
              />

              <div
                v-else
                class="space-y-3"
              >
                <div
                  v-for="link in stats.topLinks"
                  :key="link.id"
                  class="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <span class="block truncate text-sm font-semibold text-highlighted">{{ link.label }}</span>
                      <span class="block truncate text-xs text-muted">/r/{{ link.slug }}</span>
                    </div>
                    <span class="shrink-0 text-sm font-semibold text-highlighted">{{ formatNumber(link.count) }}</span>
                  </div>
                  <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                    <div
                      class="h-full rounded-full bg-green-500"
                      :style="{ width: getBarWidth(link.count, maxTopLinkCount) }"
                    />
                  </div>
                  <span class="block text-xs text-muted">{{ topLinkDescription(link) }}</span>
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <div
          v-if="hasTrackedQrCodes"
          class="grid gap-4 lg:grid-cols-2"
        >
          <UCard>
            <div class="space-y-4">
              <div>
                <h2 class="text-base font-semibold text-highlighted">
                  Countries
                </h2>
                <p class="mt-1 text-sm text-muted">
                  Scan locations are estimated from IP data.
                </p>
              </div>

              <UAlert
                v-if="!stats.scansByCountry.length"
                color="neutral"
                icon="i-lucide-map-pin"
                title="No country data in this range."
                variant="subtle"
              />

              <div
                v-else
                class="space-y-3"
              >
                <div
                  v-for="country in stats.scansByCountry"
                  :key="country.label"
                  class="grid grid-cols-[minmax(0,1fr)_3.5rem] gap-3"
                >
                  <div class="min-w-0">
                    <div class="flex items-center justify-between gap-3 text-sm">
                      <span class="truncate font-medium text-highlighted">{{ country.label }}</span>
                    </div>
                    <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                      <div
                        class="h-full rounded-full bg-amber-500"
                        :style="{ width: getBarWidth(country.count, maxCountryCount) }"
                      />
                    </div>
                  </div>
                  <span class="self-center text-right text-sm font-semibold text-highlighted">{{ formatNumber(country.count) }}</span>
                </div>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="space-y-4">
              <div>
                <h2 class="text-base font-semibold text-highlighted">
                  Recent Scans
                </h2>
                <p class="mt-1 text-sm text-muted">
                  Latest scans across all tracked QR codes.
                </p>
              </div>

              <UAlert
                v-if="!stats.recentScans.length"
                color="neutral"
                icon="i-lucide-clock"
                title="No recent scans in this range."
                variant="subtle"
              />

              <div
                v-else
                class="space-y-3"
              >
                <div
                  v-for="scan in stats.recentScans"
                  :key="scan.id"
                  class="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <span class="block truncate text-sm font-semibold text-highlighted">{{ scan.linkName }}</span>
                      <span class="block truncate text-xs text-muted">{{ formatLocation(scan) }}</span>
                    </div>
                    <span class="shrink-0 text-right text-xs text-muted">{{ formatDate(scan.scannedAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </template>
    </template>
  </UContainer>
</template>
