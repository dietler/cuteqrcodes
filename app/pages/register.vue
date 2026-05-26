<script setup lang="ts">
import { computed, ref } from 'vue'
import { signUp, useSession } from '~~/lib/auth-client'

const route = useRoute()
const session = useSession()
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const isSubmitting = ref(false)
const authError = ref('')
const redirectPath = computed(() => {
  const redirect = route.query.redirect

  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

async function submitRegister() {
  authError.value = ''
  const trimmedEmail = email.value.trim()

  if (!trimmedEmail || !password.value) {
    authError.value = 'Email and password are required.'
    return
  }

  if (password.value !== passwordConfirmation.value) {
    authError.value = 'Passwords must match.'
    return
  }

  isSubmitting.value = true

  try {
    const result = await signUp.email({
      email: trimmedEmail,
      name: trimmedEmail,
      password: password.value
    })

    if (result.error) {
      authError.value = result.error.message || 'Unable to register.'
      return
    }

    await session.value.refetch()
    await navigateTo(redirectPath.value)
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Unable to register.'
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
        @submit.prevent="submitRegister"
      >
        <div>
          <h1 class="text-lg font-semibold text-highlighted">
            Register
          </h1>
          <p class="mt-1 text-sm text-muted">
            Create an account to save and manage QR codes.
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
            autocomplete="new-password"
            class="w-full"
            icon="i-lucide-lock"
            size="lg"
            type="password"
          />
        </UFormField>

        <UFormField label="Confirm Password">
          <UInput
            v-model="passwordConfirmation"
            autocomplete="new-password"
            class="w-full"
            icon="i-lucide-lock-keyhole"
            size="lg"
            type="password"
          />
        </UFormField>

        <div class="flex items-center justify-between gap-3">
          <UButton
            color="neutral"
            to="/login"
            variant="subtle"
          >
            Login
          </UButton>
          <UButton
            :loading="isSubmitting"
            type="submit"
          >
            Register
          </UButton>
        </div>
      </form>
    </UCard>
  </UContainer>
</template>
