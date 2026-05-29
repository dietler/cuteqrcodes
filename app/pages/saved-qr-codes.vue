<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSession } from '~~/lib/auth-client'
import { createLabelPrintPayloadFromSavedQr, labelPrintPayloadStorageKey } from '~/utils/label-print'
import type { DynamicQrLinkResponse, DynamicQrStats } from '~/utils/dynamic-qr'
import { editQrPayloadStorageKey, type SavedQrCode, type SavedQrSummary } from '~/utils/saved-qr'

type TagRemovalTarget = {
  qrCode: SavedQrCode
  tag: string
}

const session = useSession()
const qrCodes = ref<SavedQrCode[]>([])
const selectedTag = ref('')
const pageError = ref('')
const isLoading = ref(false)
const qrCodeToDelete = ref<SavedQrCode | null>(null)
const isDeleteDialogOpen = ref(false)
const isDeleting = ref(false)
const tagInputs = ref<Record<string, string>>({})
const activeTagUpdateId = ref('')
const tagRemovalTarget = ref<TagRemovalTarget | null>(null)
const isRemoveTagDialogOpen = ref(false)
const qrCodeToEditUrl = ref<SavedQrCode | null>(null)
const isEditUrlDialogOpen = ref(false)
const editUrlValue = ref('')
const isUpdatingUrl = ref(false)
const urlEditError = ref('')
const statsQrCode = ref<SavedQrCode | null>(null)
const isStatsDialogOpen = ref(false)
const isLoadingStats = ref(false)
const statsError = ref('')
const activeStats = ref<DynamicQrStats | null>(null)
const isLoggedIn = computed(() => Boolean(session.value.data?.user))
const allTags = computed(() => [...new Set(qrCodes.value.flatMap(qrCode => qrCode.tags))].sort((first, second) => first.localeCompare(second)))
const filteredQrCodes = computed(() => {
  if (!selectedTag.value) {
    return qrCodes.value
  }

  return qrCodes.value.filter(qrCode => qrCode.tags.some(tag => tagsMatch(tag, selectedTag.value)))
})
const draftQrCodes = computed(() => filteredQrCodes.value.filter(qrCode => qrCode.status === 'draft'))
const purchasedQrCodes = computed(() => filteredQrCodes.value.filter(qrCode => qrCode.status === 'purchased'))
const hasQrCodes = computed(() => qrCodes.value.length > 0)
const isRemovingTag = computed(() =>
  Boolean(tagRemovalTarget.value && activeTagUpdateId.value === tagRemovalTarget.value.qrCode.id)
)
const removeTagDialogDescription = computed(() => {
  const tag = tagRemovalTarget.value?.tag || 'selected'

  return `Remove the "${tag}" tag from this QR code?`
})

onMounted(() => {
  if (isLoggedIn.value) {
    void loadSavedQrCodes()
  }
})

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    void loadSavedQrCodes()
    return
  }

  qrCodes.value = []
  selectedTag.value = ''
})

watch(isRemoveTagDialogOpen, (isOpen) => {
  if (!isOpen && !isRemovingTag.value) {
    tagRemovalTarget.value = null
  }
})

async function loadSavedQrCodes() {
  isLoading.value = true
  pageError.value = ''

  try {
    const response = await $fetch<SavedQrSummary>('/api/qr/saved')

    qrCodes.value = response.qrCodes

    if (selectedTag.value && !allTags.value.some(tag => tagsMatch(tag, selectedTag.value))) {
      selectedTag.value = ''
    }
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Unable to load QR codes.')
  } finally {
    isLoading.value = false
  }
}

function editQrCode(qrCode: SavedQrCode) {
  sessionStorage.setItem(editQrPayloadStorageKey, JSON.stringify(qrCode.payload))
  return navigateTo('/')
}

function printDraftQrCode(qrCode: SavedQrCode) {
  sessionStorage.setItem(labelPrintPayloadStorageKey, JSON.stringify(createLabelPrintPayloadFromSavedQr(qrCode)))

  return navigateTo({
    path: '/print-labels',
    query: {
      saved: qrCode.id
    }
  })
}

function openDeleteDialog(qrCode: SavedQrCode) {
  qrCodeToDelete.value = qrCode
  isDeleteDialogOpen.value = true
}

async function confirmDeleteQrCode() {
  const qrCode = qrCodeToDelete.value

  if (!qrCode || isDeleting.value) {
    return
  }

  isDeleting.value = true
  pageError.value = ''

  try {
    await $fetch(`/api/qr/saved/${qrCode.id}`, {
      method: 'DELETE'
    })

    qrCodes.value = qrCodes.value.filter(savedQrCode => savedQrCode.id !== qrCode.id)
    isDeleteDialogOpen.value = false
    qrCodeToDelete.value = null
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Unable to delete this QR code.')
  } finally {
    isDeleting.value = false
  }
}

async function addTags(qrCode: SavedQrCode) {
  const tags = parseTags(tagInputs.value[qrCode.id] || '')

  if (!tags.length || activeTagUpdateId.value) {
    return
  }

  await updateTags(qrCode, [...qrCode.tags, ...tags])
  tagInputs.value = {
    ...tagInputs.value,
    [qrCode.id]: ''
  }
}

function openRemoveTagDialog(qrCode: SavedQrCode, tag: string) {
  if (activeTagUpdateId.value) {
    return
  }

  tagRemovalTarget.value = {
    qrCode,
    tag
  }
  isRemoveTagDialogOpen.value = true
}

async function confirmRemoveTag() {
  const target = tagRemovalTarget.value

  if (!target || isRemovingTag.value) {
    return
  }

  const wasUpdated = await updateTags(
    target.qrCode,
    target.qrCode.tags.filter(tag => !tagsMatch(tag, target.tag))
  )

  if (wasUpdated) {
    isRemoveTagDialogOpen.value = false
    tagRemovalTarget.value = null
  }
}

function cancelRemoveTag() {
  if (isRemovingTag.value) {
    return
  }

  isRemoveTagDialogOpen.value = false
  tagRemovalTarget.value = null
}

async function updateTags(qrCode: SavedQrCode, tags: string[]) {
  activeTagUpdateId.value = qrCode.id
  pageError.value = ''

  try {
    const response = await $fetch<{ qrCode: SavedQrCode }>(`/api/qr/saved/${qrCode.id}`, {
      body: {
        tags
      },
      method: 'PATCH'
    })

    replaceQrCode(response.qrCode)
    return true
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Unable to update tags.')
    return false
  } finally {
    activeTagUpdateId.value = ''
  }
}

function setTagFilter(tag: string) {
  selectedTag.value = tagsMatch(selectedTag.value, tag) ? '' : tag
}

function openEditUrlDialog(qrCode: SavedQrCode) {
  qrCodeToEditUrl.value = qrCode
  editUrlValue.value = qrCode.payload.dynamicLink?.destinationUrl || qrCode.payload.url
  urlEditError.value = ''
  isEditUrlDialogOpen.value = true
}

async function updateEditableUrl() {
  const qrCode = qrCodeToEditUrl.value
  const dynamicLink = qrCode?.payload.dynamicLink

  if (!qrCode || !dynamicLink || isUpdatingUrl.value) {
    return
  }

  isUpdatingUrl.value = true
  urlEditError.value = ''

  try {
    const response = await $fetch<DynamicQrLinkResponse>('/api/qr/dynamic-links', {
      body: {
        destinationUrl: editUrlValue.value,
        existingLinkId: dynamicLink.id,
        slug: dynamicLink.slug,
        trackStatistics: dynamicLink.trackStatistics,
        useDynamicUrl: true
      },
      method: 'POST'
    })
    const updateResponse = await $fetch<{ qrCode: SavedQrCode }>(`/api/qr/saved/${qrCode.id}`, {
      body: {
        dynamicLink: response.link
      },
      method: 'PATCH'
    })

    replaceQrCode(updateResponse.qrCode)
    isEditUrlDialogOpen.value = false
    qrCodeToEditUrl.value = null
  } catch (error) {
    urlEditError.value = getErrorMessage(error, 'Unable to update this URL.')
  } finally {
    isUpdatingUrl.value = false
  }
}

async function openStatsDialog(qrCode: SavedQrCode) {
  const dynamicLinkId = qrCode.payload.dynamicLink?.id

  if (!dynamicLinkId) {
    return
  }

  statsQrCode.value = qrCode
  activeStats.value = null
  statsError.value = ''
  isStatsDialogOpen.value = true
  isLoadingStats.value = true

  try {
    activeStats.value = await $fetch<DynamicQrStats>(`/api/qr/dynamic-links/${dynamicLinkId}/stats`)
  } catch (error) {
    statsError.value = getErrorMessage(error, 'Unable to load stats.')
  } finally {
    isLoadingStats.value = false
  }
}

function replaceQrCode(updatedQrCode: SavedQrCode) {
  qrCodes.value = qrCodes.value.map(qrCode => qrCode.id === updatedQrCode.id ? updatedQrCode : qrCode)
}

function canEditUrl(qrCode: SavedQrCode) {
  const dynamicLink = qrCode.payload.dynamicLink

  return qrCode.status === 'purchased' && Boolean(dynamicLink?.id && dynamicLink.useDynamicUrl)
}

function canViewStats(qrCode: SavedQrCode) {
  const dynamicLink = qrCode.payload.dynamicLink

  return qrCode.status === 'purchased' && Boolean(dynamicLink?.id && dynamicLink.trackStatistics)
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function downloadUrl(qrCode: SavedQrCode) {
  return qrCode.pdfPurchaseId ? `/api/credits/pdfs/${qrCode.pdfPurchaseId}` : ''
}

function parseTags(value: string) {
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
}

function tagsMatch(first: string, second: string) {
  return first.toLocaleLowerCase() === second.toLocaleLowerCase()
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatLocation(scan: DynamicQrStats['recentScans'][number]) {
  return [scan.city, scan.region, scan.country].filter(Boolean).join(', ') || 'Unknown location'
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
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">
          My QR Codes
        </h1>
        <p class="mt-1 text-sm text-muted">
          Draft QR Codes and purchased printable QR Codes.
        </p>
      </div>

      <UButton
        color="neutral"
        icon="i-lucide-plus"
        to="/"
        variant="subtle"
      >
        QR Code
      </UButton>
    </div>

    <UAlert
      v-if="pageError"
      color="warning"
      icon="i-lucide-triangle-alert"
      :title="pageError"
      variant="subtle"
    />

    <UCard v-if="!isLoggedIn">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-base font-semibold text-highlighted">
            Login Required
          </h2>
          <p class="mt-1 text-sm text-muted">
            QR codes are tied to your account.
          </p>
        </div>
        <div class="flex gap-2">
          <UButton
            color="neutral"
            to="/register?redirect=/saved-qr-codes"
            variant="subtle"
          >
            Register
          </UButton>
          <UButton to="/login?redirect=/saved-qr-codes">
            Login
          </UButton>
        </div>
      </div>
    </UCard>

    <template v-else>
      <UCard v-if="isLoading">
        <div class="flex items-center gap-2 text-sm text-muted">
          <UIcon
            name="i-lucide-loader-circle"
            class="animate-spin"
          />
          <span>Loading QR codes...</span>
        </div>
      </UCard>

      <UAlert
        v-else-if="!hasQrCodes"
        color="neutral"
        icon="i-lucide-qr-code"
        title="No QR codes yet."
        variant="subtle"
      />

      <template v-else>
        <div
          v-if="allTags.length"
          aria-label="QR code tags"
          class="flex gap-2 overflow-x-auto pb-2"
        >
          <UButton
            color="neutral"
            size="sm"
            :variant="selectedTag ? 'subtle' : 'solid'"
            @click="selectedTag = ''"
          >
            All
          </UButton>
          <UButton
            v-for="tag in allTags"
            :key="tag"
            color="neutral"
            icon="i-lucide-tag"
            size="sm"
            :variant="tagsMatch(selectedTag, tag) ? 'solid' : 'subtle'"
            @click="setTagFilter(tag)"
          >
            {{ tag }}
          </UButton>
        </div>

        <section class="space-y-3">
          <h2 class="text-base font-semibold text-highlighted">
            Draft QR Codes
          </h2>

          <UAlert
            v-if="!draftQrCodes.length"
            color="neutral"
            icon="i-lucide-file-pen-line"
            title="No draft QR codes."
            variant="subtle"
          />

          <div
            v-else
            class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <UCard
              v-for="qrCode in draftQrCodes"
              :key="qrCode.id"
            >
              <div class="space-y-3">
                <div class="rounded-lg bg-white p-4 ring-1 ring-slate-200 dark:ring-slate-800">
                  <img
                    :src="svgToDataUrl(qrCode.previewSvg)"
                    :alt="qrCode.name"
                    class="aspect-square h-auto w-full object-contain"
                  >
                </div>
                <div>
                  <h3 class="truncate text-sm font-semibold text-highlighted">
                    {{ qrCode.name }}
                  </h3>
                  <p class="mt-1 truncate text-xs text-muted">
                    {{ qrCode.payload.url }}
                  </p>
                </div>
                <div class="grid gap-2 sm:grid-cols-3">
                  <UButton
                    class="justify-center whitespace-normal text-center leading-tight"
                    color="neutral"
                    icon="i-lucide-copy"
                    size="sm"
                    variant="subtle"
                    @click="editQrCode(qrCode)"
                  >
                    New QR Code Based on This One
                  </UButton>
                  <UButton
                    class="justify-center"
                    color="neutral"
                    icon="i-lucide-printer"
                    size="sm"
                    variant="subtle"
                    @click="printDraftQrCode(qrCode)"
                  >
                    Print to Labels
                  </UButton>
                  <UButton
                    class="justify-center"
                    color="error"
                    icon="i-lucide-trash-2"
                    size="sm"
                    variant="subtle"
                    @click="openDeleteDialog(qrCode)"
                  >
                    Delete Draft
                  </UButton>
                </div>
                <div class="space-y-2">
                  <div
                    v-if="qrCode.tags.length"
                    class="flex flex-wrap gap-2"
                  >
                    <span
                      v-for="tag in qrCode.tags"
                      :key="tag"
                      class="inline-flex items-center overflow-hidden rounded-md border text-xs font-medium"
                      :class="tagsMatch(selectedTag, tag) ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'"
                    >
                      <button
                        class="inline-flex items-center gap-1 px-2 py-1"
                        type="button"
                        @click="setTagFilter(tag)"
                      >
                        <UIcon name="i-lucide-tag" />
                        <span>{{ tag }}</span>
                      </button>
                      <UButton
                        :aria-label="`Remove ${tag}`"
                        color="neutral"
                        icon="i-lucide-x"
                        size="xs"
                        variant="ghost"
                        @click="openRemoveTagDialog(qrCode, tag)"
                      />
                    </span>
                  </div>
                  <UFieldGroup class="w-full">
                    <UInput
                      v-model="tagInputs[qrCode.id]"
                      class="min-w-0 flex-1"
                      icon="i-lucide-tags"
                      placeholder="Add tag"
                      size="sm"
                      @keydown.enter.prevent="addTags(qrCode)"
                    />
                    <UButton
                      aria-label="Add tag"
                      color="neutral"
                      icon="i-lucide-plus"
                      :loading="activeTagUpdateId === qrCode.id"
                      size="sm"
                      variant="subtle"
                      @click="addTags(qrCode)"
                    />
                  </UFieldGroup>
                </div>
              </div>
            </UCard>
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="text-base font-semibold text-highlighted">
            My QR Codes
          </h2>

          <UAlert
            v-if="!purchasedQrCodes.length"
            color="neutral"
            icon="i-lucide-qr-code"
            title="No purchased QR codes."
            variant="subtle"
          />

          <div
            v-else
            class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <UCard
              v-for="qrCode in purchasedQrCodes"
              :key="qrCode.id"
            >
              <div class="space-y-3">
                <div class="rounded-lg bg-white p-4 ring-1 ring-slate-200 dark:ring-slate-800">
                  <img
                    :src="svgToDataUrl(qrCode.previewSvg)"
                    :alt="qrCode.name"
                    class="aspect-square h-auto w-full object-contain"
                  >
                </div>
                <div>
                  <h3 class="truncate text-sm font-semibold text-highlighted">
                    {{ qrCode.name }}
                  </h3>
                  <p class="mt-1 truncate text-xs text-muted">
                    {{ qrCode.payload.url }}
                  </p>
                </div>
                <div class="grid gap-2 sm:grid-cols-2">
                  <UButton
                    class="justify-center"
                    color="neutral"
                    icon="i-lucide-pencil"
                    size="sm"
                    variant="subtle"
                    @click="editQrCode(qrCode)"
                  >
                    Edit QR Code
                  </UButton>
                  <UButton
                    v-if="downloadUrl(qrCode)"
                    class="justify-center"
                    color="neutral"
                    icon="i-lucide-download"
                    size="sm"
                    :to="downloadUrl(qrCode)"
                    variant="subtle"
                  >
                    Download PDF
                  </UButton>
                  <UButton
                    v-if="canEditUrl(qrCode)"
                    class="justify-center"
                    color="neutral"
                    icon="i-lucide-link"
                    size="sm"
                    variant="subtle"
                    @click="openEditUrlDialog(qrCode)"
                  >
                    Edit URL
                  </UButton>
                  <UButton
                    v-if="canViewStats(qrCode)"
                    class="justify-center"
                    color="neutral"
                    icon="i-lucide-chart-no-axes-column"
                    size="sm"
                    variant="subtle"
                    @click="openStatsDialog(qrCode)"
                  >
                    View Stats
                  </UButton>
                </div>
                <div class="space-y-2">
                  <div
                    v-if="qrCode.tags.length"
                    class="flex flex-wrap gap-2"
                  >
                    <span
                      v-for="tag in qrCode.tags"
                      :key="tag"
                      class="inline-flex items-center overflow-hidden rounded-md border text-xs font-medium"
                      :class="tagsMatch(selectedTag, tag) ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'"
                    >
                      <button
                        class="inline-flex items-center gap-1 px-2 py-1"
                        type="button"
                        @click="setTagFilter(tag)"
                      >
                        <UIcon name="i-lucide-tag" />
                        <span>{{ tag }}</span>
                      </button>
                      <UButton
                        :aria-label="`Remove ${tag}`"
                        color="neutral"
                        icon="i-lucide-x"
                        size="xs"
                        variant="ghost"
                        @click="openRemoveTagDialog(qrCode, tag)"
                      />
                    </span>
                  </div>
                  <UFieldGroup class="w-full">
                    <UInput
                      v-model="tagInputs[qrCode.id]"
                      class="min-w-0 flex-1"
                      icon="i-lucide-tags"
                      placeholder="Add tag"
                      size="sm"
                      @keydown.enter.prevent="addTags(qrCode)"
                    />
                    <UButton
                      aria-label="Add tag"
                      color="neutral"
                      icon="i-lucide-plus"
                      :loading="activeTagUpdateId === qrCode.id"
                      size="sm"
                      variant="subtle"
                      @click="addTags(qrCode)"
                    />
                  </UFieldGroup>
                </div>
              </div>
            </UCard>
          </div>
        </section>
      </template>
    </template>

    <UModal
      v-model:open="isDeleteDialogOpen"
      title="Delete Draft QR Code"
      description="This draft QR code will be permanently removed."
      :dismissible="!isDeleting"
    >
      <template #body>
        <p class="text-sm text-muted">
          Delete "{{ qrCodeToDelete?.name }}"?
        </p>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            :disabled="isDeleting"
            variant="subtle"
            @click="isDeleteDialogOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            color="error"
            :loading="isDeleting"
            @click="confirmDeleteQrCode"
          >
            Delete
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isRemoveTagDialogOpen"
      title="Remove Tag"
      :description="removeTagDialogDescription"
      :dismissible="!isRemovingTag"
    >
      <template #body>
        <p class="text-sm text-muted">
          Remove "{{ tagRemovalTarget?.tag }}" from "{{ tagRemovalTarget?.qrCode.name }}"?
        </p>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            :disabled="isRemovingTag"
            variant="subtle"
            @click="cancelRemoveTag"
          >
            Cancel
          </UButton>
          <UButton
            color="error"
            :loading="isRemovingTag"
            @click="confirmRemoveTag"
          >
            Remove Tag
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isEditUrlDialogOpen"
      title="Edit URL"
      :dismissible="!isUpdatingUrl"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            v-if="urlEditError"
            color="warning"
            icon="i-lucide-triangle-alert"
            :title="urlEditError"
            variant="subtle"
          />
          <UFormField label="URL">
            <UInput
              v-model="editUrlValue"
              autocomplete="off"
              class="w-full"
              icon="i-lucide-link"
              type="url"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            :disabled="isUpdatingUrl"
            variant="subtle"
            @click="isEditUrlDialogOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            :disabled="!editUrlValue.trim()"
            :loading="isUpdatingUrl"
            @click="updateEditableUrl"
          >
            Save URL
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isStatsDialogOpen"
      title="View Stats"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            v-if="statsError"
            color="warning"
            icon="i-lucide-triangle-alert"
            :title="statsError"
            variant="subtle"
          />

          <div
            v-if="isLoadingStats"
            class="flex items-center gap-2 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="animate-spin"
            />
            <span>Loading stats...</span>
          </div>

          <template v-else-if="activeStats">
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <span class="block text-xs font-medium text-muted">Total Scans</span>
                <span class="mt-1 block text-2xl font-semibold text-highlighted">{{ activeStats.totalScans }}</span>
              </div>
              <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <span class="block text-xs font-medium text-muted">Last Scan</span>
                <span class="mt-1 block text-sm font-semibold text-highlighted">
                  {{ activeStats.lastScannedAt ? formatDate(activeStats.lastScannedAt) : 'Never' }}
                </span>
              </div>
            </div>

            <UAlert
              v-if="activeStats.totalScans === 0"
              color="neutral"
              icon="i-lucide-chart-no-axes-column"
              title="No scans yet."
              variant="subtle"
            />

            <div
              v-if="activeStats.scansByCountry.length"
              class="space-y-2"
            >
              <h3 class="text-sm font-semibold text-highlighted">
                Countries
              </h3>
              <div class="space-y-2">
                <div
                  v-for="country in activeStats.scansByCountry"
                  :key="country.label"
                  class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <span>{{ country.label }}</span>
                  <span class="font-semibold text-highlighted">{{ country.count }}</span>
                </div>
              </div>
            </div>

            <div
              v-if="activeStats.recentScans.length"
              class="space-y-2"
            >
              <h3 class="text-sm font-semibold text-highlighted">
                Recent Scans
              </h3>
              <div class="space-y-2">
                <div
                  v-for="scan in activeStats.recentScans"
                  :key="scan.id"
                  class="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <span class="block font-medium text-highlighted">{{ formatDate(scan.scannedAt) }}</span>
                  <span class="block text-muted">{{ formatLocation(scan) }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <span class="truncate text-sm text-muted">{{ statsQrCode?.name }}</span>
          <UButton
            color="neutral"
            variant="subtle"
            @click="isStatsDialogOpen = false"
          >
            Close
          </UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
