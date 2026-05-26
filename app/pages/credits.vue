<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { CreditsSummary, CreditPack } from '~/utils/credits'
import { creditPacks } from '~/utils/credits'
import { useSession } from '~~/lib/auth-client'

const route = useRoute()
const session = useSession()
const isLoading = ref(false)
const isCreatingCheckout = ref('')
const creditsError = ref('')
const summary = ref<CreditsSummary | null>(null)

const isLoggedIn = computed(() => Boolean(session.value.data?.user))
const balance = computed(() => summary.value?.balance ?? 0)
const returnTo = computed(() => {
  const value = route.query.returnTo

  return typeof value === 'string' && value.startsWith('/') ? value : ''
})

onMounted(() => {
  if (isLoggedIn.value) {
    void loadSummary()
  }
})

async function loadSummary() {
  isLoading.value = true
  creditsError.value = ''

  try {
    summary.value = await $fetch<CreditsSummary>('/api/credits/summary')
  } catch (error) {
    creditsError.value = getErrorMessage(error, 'Unable to load credits.')
  } finally {
    isLoading.value = false
  }
}

async function purchaseCredits(pack: CreditPack) {
  if (isCreatingCheckout.value) {
    return
  }

  isCreatingCheckout.value = pack.id
  creditsError.value = ''

  try {
    const response = await $fetch<{ checkoutUrl: string }>('/api/credits/checkout', {
      body: {
        packId: pack.id,
        returnTo: returnTo.value || '/credits'
      },
      method: 'POST'
    })

    window.location.href = response.checkoutUrl
  } catch (error) {
    creditsError.value = getErrorMessage(error, 'Unable to start checkout.')
    isCreatingCheckout.value = ''
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }

  const kilobytes = value / 1024

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`
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
            Credits and purchased PDFs are tied to your account.
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
            @click="loadSummary"
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

      <section class="grid gap-4 lg:grid-cols-2">
        <UCard>
          <div class="space-y-3">
            <h2 class="text-base font-semibold text-highlighted">
              Purchased PDFs
            </h2>

            <UAlert
              v-if="!summary?.pdfs.length"
              color="neutral"
              icon="i-lucide-file-text"
              title="No purchased PDFs yet."
              variant="subtle"
            />

            <div
              v-for="pdf in summary?.pdfs"
              :key="pdf.id"
              class="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div class="min-w-0">
                <span class="block truncate text-sm font-semibold text-highlighted">{{ pdf.qrTitle }}</span>
                <span class="block text-sm text-muted">{{ pdf.templateLabel }} - {{ formatBytes(pdf.sizeBytes) }} - {{ formatDate(pdf.createdAt) }}</span>
              </div>
              <UButton
                color="neutral"
                icon="i-lucide-download"
                :to="pdf.downloadUrl"
                variant="subtle"
              >
                Download PDF
              </UButton>
            </div>
          </div>
        </UCard>

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
