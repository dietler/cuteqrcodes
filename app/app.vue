<script setup lang="ts">
import { computed, ref } from 'vue'
import { signOut, useSession } from '~~/lib/auth-client'

const session = useSession()
const isNavigationOpen = ref(false)
const isLoggedIn = computed(() => Boolean(session.value.data?.user))

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/icons/rabbit.svg' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Cute QR Codes'
const description = 'Create scalable SVG QR codes with Nuxt 4, Nuxt UI, and Pinia.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})

async function handleLogout() {
  await signOut()
  await session.value.refetch()
  isNavigationOpen.value = false
  await navigateTo('/')
}
</script>

<template>
  <UApp>
    <UHeader v-model:open="isNavigationOpen">
      <template #left>
        <NuxtLink
          to="/"
          class="flex items-center gap-2 font-semibold"
        >
          <img
            src="/icons/rabbit.svg"
            alt=""
            aria-hidden="true"
            class="size-10 shrink-0"
          >
          <span>Cute QR Codes</span>
        </NuxtLink>
      </template>

      <template #right>
        <UColorModeButton />
      </template>

      <template #body>
        <nav
          aria-label="Primary navigation"
          class="mx-auto flex w-full max-w-sm flex-col gap-2 pt-6"
        >
          <UButton
            v-if="isLoggedIn"
            class="justify-start"
            color="neutral"
            icon="i-lucide-folder-open"
            size="xl"
            to="/saved-qr-codes"
            variant="ghost"
          >
            Saved QR Codes
          </UButton>

          <UButton
            v-if="!isLoggedIn"
            class="justify-start"
            color="neutral"
            icon="i-lucide-log-in"
            size="xl"
            to="/login"
            variant="ghost"
          >
            Login
          </UButton>

          <UButton
            v-if="!isLoggedIn"
            class="justify-start"
            color="neutral"
            icon="i-lucide-user-plus"
            size="xl"
            to="/register"
            variant="ghost"
          >
            Register
          </UButton>

          <UButton
            v-if="isLoggedIn"
            class="justify-start"
            color="neutral"
            icon="i-lucide-log-out"
            size="xl"
            variant="ghost"
            @click="handleLogout"
          >
            Logout
          </UButton>
        </nav>
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
