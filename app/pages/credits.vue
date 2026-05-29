<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CreditsSummary, CreditPack, CreditPackId } from '~/utils/credits'
import { creditPacks } from '~/utils/credits'
import { useSession } from '~~/lib/auth-client'

type StoredCreditCheckout = {
  credits: number
  packId: CreditPackId
  startedAt: string
}

const checkoutStateStorageKey = 'cuteqrcodes.creditCheckout'
const checkoutPollingDelayMs = 1500
const checkoutPollingAttempts = 12
const checkoutMatchGraceMs = 5 * 60 * 1000

const route = useRoute()
const session = useSession()
const isLoading = ref(false)
const isCreatingCheckout = ref('')
const creditsError = ref('')
const isProcessingCheckoutReturn = ref(false)
const summary = ref<CreditsSummary | null>(null)
let checkoutPollingTimer: number | null = null
let checkoutPollingRunId = 0

const isLoggedIn = computed(() => Boolean(session.value.data?.user))
const balance = computed(() => summary.value?.balance ?? 0)
const isCheckoutSuccess = computed(() => route.query.checkout === 'success')
const checkoutSuccessMessage = computed(() => isProcessingCheckoutReturn.value
  ? 'Payment complete. Updating your credits...'
  : 'Payment complete. If the latest purchase is not shown yet, it will appear shortly.')
const returnTo = computed(() => {
  const value = route.query.returnTo

  return typeof value === 'string' && value.startsWith('/') ? value : ''
})

onMounted(() => {
  if (isLoggedIn.value) {
    refreshCreditsForRoute()
  }
})

onBeforeUnmount(() => {
  stopCheckoutReturnRefresh()
})

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    refreshCreditsForRoute()
  } else {
    stopCheckoutReturnRefresh()
    summary.value = null
  }
})

watch(() => route.query.checkout, () => {
  if (isLoggedIn.value) {
    refreshCreditsForRoute()
  }
})

function refreshCreditsForRoute() {
  if (isCheckoutSuccess.value) {
    startCheckoutReturnRefresh()
  } else {
    stopCheckoutReturnRefresh()
    void loadSummary()
  }
}

async function loadSummary(): Promise<CreditsSummary | null> {
  isLoading.value = true
  creditsError.value = ''

  try {
    const nextSummary = await $fetch<CreditsSummary>('/api/credits/summary')
    summary.value = nextSummary

    return nextSummary
  } catch (error) {
    creditsError.value = getErrorMessage(error, 'Unable to load credits.')

    return null
  } finally {
    isLoading.value = false
  }
}

async function refreshSummary() {
  await loadSummary()
}

async function purchaseCredits(pack: CreditPack) {
  if (isCreatingCheckout.value) {
    return
  }

  isCreatingCheckout.value = pack.id
  creditsError.value = ''

  try {
    storePendingCheckout(pack)

    const response = await $fetch<{ checkoutUrl: string }>('/api/credits/checkout', {
      body: {
        packId: pack.id,
        returnTo: returnTo.value || '/credits'
      },
      method: 'POST'
    })

    window.location.href = response.checkoutUrl
  } catch (error) {
    clearPendingCheckout()
    creditsError.value = getErrorMessage(error, 'Unable to start checkout.')
    isCreatingCheckout.value = ''
  }
}

function startCheckoutReturnRefresh() {
  stopCheckoutReturnRefresh()

  isProcessingCheckoutReturn.value = true
  checkoutPollingRunId += 1

  void pollCheckoutReturnSummary(checkoutPollingRunId, 1)
}

function stopCheckoutReturnRefresh() {
  checkoutPollingRunId += 1
  isProcessingCheckoutReturn.value = false

  if (checkoutPollingTimer) {
    window.clearTimeout(checkoutPollingTimer)
    checkoutPollingTimer = null
  }
}

async function pollCheckoutReturnSummary(runId: number, attempt: number) {
  const nextSummary = await loadSummary()

  if (runId !== checkoutPollingRunId) {
    return
  }

  const pendingCheckout = getPendingCheckout()

  if (nextSummary && pendingCheckout && hasExpectedCreditPurchase(nextSummary, pendingCheckout)) {
    clearPendingCheckout()
    finishCheckoutReturnRefresh(runId)

    return
  }

  if (attempt >= checkoutPollingAttempts || !isCheckoutSuccess.value) {
    clearPendingCheckout()
    finishCheckoutReturnRefresh(runId)

    return
  }

  checkoutPollingTimer = window.setTimeout(() => {
    void pollCheckoutReturnSummary(runId, attempt + 1)
  }, checkoutPollingDelayMs)
}

function finishCheckoutReturnRefresh(runId: number) {
  if (runId !== checkoutPollingRunId) {
    return
  }

  isProcessingCheckoutReturn.value = false
  checkoutPollingTimer = null
}

function hasExpectedCreditPurchase(nextSummary: CreditsSummary, pendingCheckout: StoredCreditCheckout) {
  const startedAt = Date.parse(pendingCheckout.startedAt)
  const earliestMatchTime = Number.isFinite(startedAt) ? startedAt - checkoutMatchGraceMs : 0

  return nextSummary.transactions.some(transaction =>
    transaction.type === 'credit_purchase'
    && transaction.credits === pendingCheckout.credits
    && Date.parse(transaction.createdAt) >= earliestMatchTime)
}

function storePendingCheckout(pack: CreditPack) {
  if (!import.meta.client) {
    return
  }

  try {
    sessionStorage.setItem(checkoutStateStorageKey, JSON.stringify({
      credits: pack.credits,
      packId: pack.id,
      startedAt: new Date().toISOString()
    } satisfies StoredCreditCheckout))
  } catch {
    // The success-return polling still works without session storage; it just runs for the full window.
  }
}

function getPendingCheckout(): StoredCreditCheckout | null {
  if (!import.meta.client) {
    return null
  }

  try {
    const rawValue = sessionStorage.getItem(checkoutStateStorageKey)

    if (!rawValue) {
      return null
    }

    const value = JSON.parse(rawValue) as Partial<StoredCreditCheckout>

    if (!value.packId || typeof value.credits !== 'number' || !value.startedAt) {
      return null
    }

    return {
      credits: value.credits,
      packId: value.packId,
      startedAt: value.startedAt
    }
  } catch {
    return null
  }
}

function clearPendingCheckout() {
  if (!import.meta.client) {
    return
  }

  try {
    sessionStorage.removeItem(checkoutStateStorageKey)
  } catch {
    // Ignore storage cleanup failures.
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
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
  <UContainer class="flex min-h-[calc(100svh-4rem)] max-w-5xl flex-col gap-4 py-4 sm:gap-6 sm:py-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">
          Credits
        </h1>
        <p class="mt-1 text-sm text-muted">
          Use credits to create unwatermarked label PDFs.
        </p>
      </div>

      <UButton
        v-if="returnTo"
        color="neutral"
        icon="i-lucide-arrow-left"
        :to="returnTo"
        variant="subtle"
      >
        Back to Labels
      </UButton>
    </div>

    <UAlert
      v-if="route.query.needCredits"
      color="warning"
      icon="i-lucide-circle-dollar-sign"
      title="Purchase credits before creating an unwatermarked PDF."
      variant="subtle"
    />

    <UAlert
      v-if="isCheckoutSuccess"
      color="success"
      icon="i-lucide-check-circle"
      :title="checkoutSuccessMessage"
      variant="subtle"
    />

    <UAlert
      v-if="creditsError"
      color="warning"
      icon="i-lucide-triangle-alert"
      :title="creditsError"
      variant="subtle"
    />

    <UCard v-if="!isLoggedIn">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-base font-semibold text-highlighted">
            Log in to manage credits
          </h2>
          <p class="mt-1 text-sm text-muted">
            Credits are tied to your account.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-log-in"
            to="/login"
          >
            Login
          </UButton>
          <UButton
            color="neutral"
            icon="i-lucide-user-plus"
            to="/register"
            variant="subtle"
          >
            Register
          </UButton>
        </div>
      </div>
    </UCard>

    <template v-else>
      <UCard>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span class="block text-sm font-medium text-muted">Current Balance</span>
            <span class="mt-1 block text-3xl font-semibold text-highlighted">{{ balance }}</span>
          </div>
          <UButton
            color="neutral"
            icon="i-lucide-refresh-cw"
            :loading="isLoading"
            variant="subtle"
            @click="refreshSummary"
          >
            Refresh
          </UButton>
        </div>
      </UCard>

      <section class="space-y-3">
        <h2 class="text-base font-semibold text-highlighted">
          Buy Credits
        </h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <UCard
            v-for="pack in creditPacks"
            :key="pack.id"
          >
            <div class="flex h-full flex-col gap-4">
              <div>
                <span class="block text-sm font-semibold text-highlighted">{{ pack.label }}</span>
                <span class="mt-1 block text-2xl font-semibold text-highlighted">{{ pack.priceLabel }}</span>
              </div>
              <UButton
                block
                icon="i-lucide-shopping-cart"
                :loading="isCreatingCheckout === pack.id"
                @click="purchaseCredits(pack)"
              >
                Purchase
              </UButton>
            </div>
          </UCard>
        </div>
      </section>

      <section>
        <UCard>
          <div class="space-y-3">
            <h2 class="text-base font-semibold text-highlighted">
              Credit History
            </h2>

            <UAlert
              v-if="!summary?.transactions.length"
              color="neutral"
              icon="i-lucide-list"
              title="No credit history yet."
              variant="subtle"
            />

            <div
              v-for="transaction in summary?.transactions"
              :key="transaction.id"
              class="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div class="min-w-0">
                <span class="block text-sm font-semibold text-highlighted">{{ transaction.description }}</span>
                <span class="block text-sm text-muted">{{ formatDate(transaction.createdAt) }}</span>
              </div>
              <div class="shrink-0 text-right">
                <span
                  class="block text-sm font-semibold"
                  :class="transaction.credits > 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-200'"
                >
                  {{ transaction.credits > 0 ? '+' : '' }}{{ transaction.credits }}
                </span>
                <span class="block text-xs text-muted">{{ transaction.balanceAfter }} left</span>
              </div>
            </div>
          </div>
        </UCard>
      </section>
    </template>
  </UContainer>
</template>
