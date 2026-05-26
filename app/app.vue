<script setup lang="ts">
import { computed, ref } from 'vue'
import { signOut, useSession } from '~~/lib/auth-client'

const session = useSession()
const isNavigationOpen = ref(false)
const isLoggedIn = computed(() => Boolean(session.value.data?.user))
const userEmail = computed(() => session.value.data?.user.email || '')
const navigationItems = computed(() => {
  if (isLoggedIn.value) {
    return [{
      label: 'Saved QR Codes',
      icon: 'i-lucide-folder-open',
      to: '/saved-qr-codes'
    }, {
      label: 'Credits',
      icon: 'i-lucide-circle-dollar-sign',
      to: '/credits'
    }, {
      label: 'Logout',
      icon: 'i-lucide-log-out',
      onSelect: handleLogout
    }]
  }

  return [{
    label: 'Login',
    icon: 'i-lucide-log-in',
    to: '/login'
  }, {
    label: 'Register',
    icon: 'i-lucide-user-plus',
    to: '/register'
  }]
})

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/icons/qr-code.svg' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'QR Codes On Labels'
const description = 'Create QR codes and print them on labels.'

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
            src="/icons/qr-code.svg"
            alt=""
            aria-hidden="true"
            class="size-10 shrink-0"
          >
          <span>QR Codes On Labels</span>
        </NuxtLink>
      </template>

      <template #right>
        <div class="hidden lg:block">
          <UDropdownMenu
            :content="{ align: 'end' }"
            :items="navigationItems"
          >
            <UButton
              :aria-label="isLoggedIn ? `Account menu for ${userEmail}` : 'Account menu'"
              color="neutral"
              icon="i-lucide-user"
              :label="isLoggedIn ? userEmail : undefined"
              variant="ghost"
            />
          </UDropdownMenu>
        </div>
      </template>

      <template #body>
        <UNavigationMenu
          :items="navigationItems"
          aria-label="Primary navigation"
          as="nav"
          class="mx-auto w-full max-w-sm pt-6"
          color="neutral"
          orientation="vertical"
          variant="pill"
        />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
