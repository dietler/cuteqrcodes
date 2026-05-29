<script setup lang="ts">
import { computed, ref } from 'vue'
import { signOut, useSession } from '~~/lib/auth-client'

const session = useSession()
const route = useRoute()
const isNavigationOpen = ref(false)
const isLoggedIn = computed(() => Boolean(session.value.data?.user))
const userEmail = computed(() => session.value.data?.user.email || '')
const siteName = 'QR Codes On Labels'
const siteUrl = 'https://qrcodesonlabels.com'
const canonicalUrl = computed(() => new URL(route.path || '/', siteUrl).toString())
const title = 'Custom Printable QR Codes for Avery Labels | QR Codes On Labels'
const description = 'Create custom printable QR codes for Avery labels and Presta templates. Add colors, icons, circular QR codes, label text, then download a print-ready PDF.'
const seoTopics = [
  'QR codes',
  'Avery labels',
  'printable labels',
  'custom QR codes',
  'printable QR codes',
  'Presta templates',
  'circular QR codes',
  'QR code labels',
  'menu QR codes',
  'waiver QR codes',
  'event QR codes',
  'ticket QR codes',
  'review QR codes',
  'payment QR codes',
  'restaurant QR codes'
]
const navigationItems = computed(() => {
  if (isLoggedIn.value) {
    return [
      {
        label: 'My QR Codes',
        icon: 'i-lucide-qr-code',
        to: '/saved-qr-codes'
      },
      {
        label: 'Stats',
        icon: 'i-lucide-chart-no-axes-column',
        to: '/stats'
      },
      {
        label: 'Credits',
        icon: 'i-lucide-circle-dollar-sign',
        to: '/credits'
      },
      {
        label: 'Logout',
        icon: 'i-lucide-log-out',
        onSelect: handleLogout
      }
    ]
  }

  return [
    {
      label: 'Login to Save Drafts',
      icon: 'i-lucide-save',
      to: '/login'
    },
    {
      label: 'Create an Account',
      icon: 'i-lucide-user-plus',
      to: '/register'
    }
  ]
})

useHead(() => ({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'application-name', content: siteName },
    { name: 'apple-mobile-web-app-title', content: siteName },
    { name: 'theme-color', content: '#4f46e5' }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/icons/qr-code.svg' },
    { rel: 'canonical', href: canonicalUrl.value }
  ],
  script: [
    {
      key: 'structured-data',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${siteUrl}/#organization`,
            'name': siteName,
            'url': `${siteUrl}/`,
            'email': 'andy@qrcodesonlabels.com',
            'logo': `${siteUrl}/icons/qr-code.svg`
          },
          {
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
            'name': siteName,
            'url': `${siteUrl}/`,
            'description': description,
            'inLanguage': 'en-US',
            'publisher': { '@id': `${siteUrl}/#organization` }
          },
          {
            '@type': 'WebPage',
            '@id': `${canonicalUrl.value}#webpage`,
            'url': canonicalUrl.value,
            'name': title,
            'description': description,
            'isPartOf': { '@id': `${siteUrl}/#website` },
            'about': seoTopics.map(topic => ({
              '@type': 'Thing',
              'name': topic
            })),
            'keywords': seoTopics.join(', '),
            'inLanguage': 'en-US'
          }
        ]
      })
    }
  ],
  htmlAttrs: {
    lang: 'en'
  }
}))

useSeoMeta({
  title,
  description,
  robots: 'index, follow, max-image-preview:large',
  ogTitle: title,
  ogDescription: description,
  ogSiteName: siteName,
  ogType: 'website',
  ogUrl: canonicalUrl,
  twitterTitle: title,
  twitterDescription: description,
  twitterCard: 'summary'
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
        <div class="hidden items-center gap-2 lg:flex">
          <UDropdownMenu
            v-if="isLoggedIn"
            :content="{ align: 'end' }"
            :items="navigationItems"
          >
            <UButton
              :aria-label="
                isLoggedIn ? `Account menu for ${userEmail}` : 'Account menu'
              "
              color="neutral"
              icon="i-lucide-user"
              :label="isLoggedIn ? userEmail : undefined"
              trailing-icon="i-lucide-chevron-down"
              variant="subtle"
            />
          </UDropdownMenu>
          <template v-else>
            <UButton
              color="neutral"
              icon="i-lucide-save"
              to="/login"
              variant="subtle"
            >
              Login to Save Drafts
            </UButton>
            <UButton
              icon="i-lucide-user-plus"
              to="/register"
            >
              Create an Account
            </UButton>
          </template>
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

    <footer class="border-t border-slate-200 bg-white py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      <UContainer class="text-center">
        Questions? Issues? Suggestions? E-mail me at
        <a
          class="font-medium text-primary hover:underline"
          href="mailto:andy@qrcodesonlabels.com"
        >andy@qrcodesonlabels.com</a>
        and I'll get back to you ASAP.
      </UContainer>
    </footer>
  </UApp>
</template>
