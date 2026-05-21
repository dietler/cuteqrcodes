<script setup lang="ts">
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
</script>

<template>
  <UApp>
    <UHeader>
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
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
