<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSession } from '~~/lib/auth-client'
import { createLabelPrintPayloadFromSavedQr, labelPrintPayloadStorageKey } from '~/utils/label-print'
import { editQrPayloadStorageKey, type SavedQrCode, type SavedQrFolderWithCodes } from '~/utils/saved-qr'

const session = useSession()
const folders = ref<SavedQrFolderWithCodes[]>([])
const selectedFolderId = ref('')
const pageError = ref('')
const isLoading = ref(false)
const qrCodeToDelete = ref<SavedQrCode | null>(null)
const isDeleteDialogOpen = ref(false)
const isDeleting = ref(false)
const isLoggedIn = computed(() => Boolean(session.value.data?.user))
const activeFolder = computed(() => folders.value.find(folder => folder.id === selectedFolderId.value) ?? folders.value[0] ?? null)
const hasSavedQrCodes = computed(() => folders.value.some(folder => folder.qrCodes.length > 0))

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

  folders.value = []
  selectedFolderId.value = ''
})

async function loadSavedQrCodes() {
  isLoading.value = true
  pageError.value = ''

  try {
    const response = await $fetch<{ folders: SavedQrFolderWithCodes[] }>('/api/qr/saved')

    folders.value = response.folders

    if (!selectedFolderId.value || !folders.value.some(folder => folder.id === selectedFolderId.value)) {
      selectedFolderId.value = folders.value[0]?.id ?? ''
    }
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Unable to load saved QR codes.')
  } finally {
    isLoading.value = false
  }
}

function editQrCode(qrCode: SavedQrCode) {
  sessionStorage.setItem(editQrPayloadStorageKey, JSON.stringify(qrCode.payload))
  return navigateTo('/')
}

function printQrCode(qrCode: SavedQrCode) {
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

    folders.value = folders.value.map(folder => ({
      ...folder,
      qrCodes: folder.qrCodes.filter(savedQrCode => savedQrCode.id !== qrCode.id)
    }))
    isDeleteDialogOpen.value = false
    qrCodeToDelete.value = null
  } catch (error) {
    pageError.value = getErrorMessage(error, 'Unable to delete this QR code.')
  } finally {
    isDeleting.value = false
  }
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
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
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">
          Saved QR Codes
        </h1>
        <p class="mt-1 text-sm text-muted">
          Browse folders and manage saved QR codes.
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
            Saved QR codes are tied to your account.
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
          <span>Loading saved QR codes...</span>
        </div>
      </UCard>

      <UAlert
        v-else-if="!folders.length"
        color="neutral"
        icon="i-lucide-folder"
        title="No folders yet."
        description="Save a QR code from the editor to create your first folder."
        variant="subtle"
      />

      <template v-else>
        <div
          aria-label="Saved QR code folders"
          class="flex gap-2 overflow-x-auto pb-2"
          role="tablist"
        >
          <button
            v-for="folder in folders"
            :key="folder.id"
            :aria-selected="activeFolder?.id === folder.id"
            class="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition"
            :class="activeFolder?.id === folder.id ? 'border-primary bg-primary text-inverted' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'"
            role="tab"
            type="button"
            @click="selectedFolderId = folder.id"
          >
            {{ folder.name }}
            <span class="ml-1 opacity-75">({{ folder.qrCodes.length }})</span>
          </button>
        </div>

        <UAlert
          v-if="!hasSavedQrCodes"
          color="neutral"
          icon="i-lucide-qr-code"
          title="No saved QR codes yet."
          description="Use Save under the editor preview to add QR codes here."
          variant="subtle"
        />

        <UAlert
          v-else-if="activeFolder && !activeFolder.qrCodes.length"
          color="neutral"
          icon="i-lucide-folder-open"
          title="This folder is empty."
          variant="subtle"
        />

        <div
          v-else
          class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <UCard
            v-for="qrCode in activeFolder?.qrCodes"
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
                <h2 class="truncate text-sm font-semibold text-highlighted">
                  {{ qrCode.name }}
                </h2>
                <p class="mt-1 truncate text-xs text-muted">
                  {{ qrCode.payload.url }}
                </p>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <UButton
                  class="justify-center"
                  color="neutral"
                  size="sm"
                  variant="subtle"
                  @click="editQrCode(qrCode)"
                >
                  Edit
                </UButton>
                <UButton
                  class="justify-center"
                  color="neutral"
                  size="sm"
                  variant="subtle"
                  @click="printQrCode(qrCode)"
                >
                  Print to Labels
                </UButton>
                <UButton
                  class="justify-center"
                  color="error"
                  size="sm"
                  variant="subtle"
                  @click="openDeleteDialog(qrCode)"
                >
                  Delete
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </template>
    </template>

    <UModal
      v-model:open="isDeleteDialogOpen"
      title="Delete QR Code"
      description="This saved QR code will be permanently removed."
      :dismissible="!isDeleting"
    >
      <template #body>
        <p class="text-sm text-muted">
          Delete “{{ qrCodeToDelete?.name }}”?
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
  </UContainer>
</template>
