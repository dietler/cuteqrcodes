<script setup lang="ts">
import { computed, ref } from 'vue'
import { signIn, useSession } from '~~/lib/auth-client'

const route = useRoute()
const session = useSession()
const email = ref('')
const password = ref('')
const rememberMe = ref(true)
const isSubmitting = ref(false)
const authError = ref('')
const redirectPath = computed(() => {
  const redirect = route.query.redirect

  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

async function submitLogin() {
  authError.value = ''

  if (!email.value.trim() || !password.value) {
    authError.value = 'Email and password are required.'
    return
  }

  isSubmitting.value = true

  try {
    const result = await signIn.email({
      email: email.value.trim(),
      password: password.value,
      rememberMe: rememberMe.value
    })

    if (result.error) {
      authError.value = result.error.message || 'Unable to log in.'
      return
    }

    await session.value.refetch()
    await navigateTo(redirectPath.value)
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Unable to log in.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UContainer class="flex min-h-[calc(100svh-4rem)] max-w-md flex-col justify-center gap-4 py-6">
    <UCard>
      <form
        class="space-y-5"
        @submit.prevent="submitLogin"
      >
        <div>
          <h1 class="text-lg font-semibold text-highlighted">
            Login
          </h1>
          <p class="mt-1 text-sm text-muted">
            Access your saved QR codes.
          </p>
        </div>

        <UAlert
          v-if="authError"
          color="warning"
          icon="i-lucide-triangle-alert"
          :title="authError"
          variant="subtle"
        />

        <UFormField label="Email">
          <UInput
            v-model="email"
            autocomplete="email"
            class="w-full"
            icon="i-lucide-mail"
            size="lg"
            type="email"
          />
        </UFormField>

        <UFormField label="Password">
          <UInput
            v-model="password"
            autocomplete="current-password"
            class="w-full"
            icon="i-lucide-lock"
            size="lg"
            type="password"
          />
        </UFormField>

        <UCheckbox
          v-model="rememberMe"
          label="Keep me logged in"
        />

        <div class="flex items-center justify-between gap-3">
          <UButton
            color="neutral"
            to="/register"
            variant="subtle"
          >
            Register
          </UButton>
          <UButton
            :loading="isSubmitting"
            type="submit"
          >
            Login
          </UButton>
        </div>
      </form>
    </UCard>
  </UContainer>
</template>
