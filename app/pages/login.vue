<script setup lang="ts">
import { computed, ref } from 'vue'
import { requestPasswordReset, signIn, useSession } from '~~/lib/auth-client'

const route = useRoute()
const session = useSession()
const email = ref('')
const password = ref('')
const rememberMe = ref(true)
const resetEmail = ref('')
const isResetMode = ref(false)
const isSubmitting = ref(false)
const isResetSubmitting = ref(false)
const authError = ref('')
const resetError = ref('')
const resetSuccess = ref('')
const redirectPath = computed(() => {
  const redirect = route.query.redirect

  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

function showResetForm() {
  resetEmail.value = email.value.trim()
  authError.value = ''
  resetError.value = ''
  resetSuccess.value = ''
  isResetMode.value = true
}

function showLoginForm() {
  resetError.value = ''
  resetSuccess.value = ''
  isResetMode.value = false
}

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

async function submitPasswordResetRequest() {
  resetError.value = ''
  resetSuccess.value = ''

  const trimmedEmail = resetEmail.value.trim()

  if (!trimmedEmail) {
    resetError.value = 'Email is required.'
    return
  }

  isResetSubmitting.value = true

  try {
    const result = await requestPasswordReset({
      email: trimmedEmail,
      redirectTo: '/reset-password'
    })

    if (result.error) {
      resetError.value = result.error.message || 'Unable to send a reset link.'
      return
    }

    resetSuccess.value = result.data?.message || 'If this email exists, check your email for the reset link.'
  } catch (error) {
    resetError.value = error instanceof Error ? error.message : 'Unable to send a reset link.'
  } finally {
    isResetSubmitting.value = false
  }
}
</script>

<template>
  <UContainer class="flex min-h-[calc(100svh-4rem)] max-w-md flex-col justify-center gap-4 py-6">
    <UCard>
      <form
        v-if="isResetMode"
        class="space-y-5"
        @submit.prevent="submitPasswordResetRequest"
      >
        <div>
          <h1 class="text-lg font-semibold text-highlighted">
            Reset password
          </h1>
          <p class="mt-1 text-sm text-muted">
            Get a reset link for your saved QR codes account.
          </p>
        </div>

        <UAlert
          v-if="resetError"
          color="warning"
          icon="i-lucide-triangle-alert"
          :title="resetError"
          variant="subtle"
        />

        <UAlert
          v-if="resetSuccess"
          color="success"
          icon="i-lucide-circle-check"
          :title="resetSuccess"
          variant="subtle"
        />

        <UFormField label="Email">
          <UInput
            v-model="resetEmail"
            autocomplete="email"
            class="w-full"
            icon="i-lucide-mail"
            size="lg"
            type="email"
          />
        </UFormField>

        <div class="flex items-center justify-between gap-3">
          <UButton
            color="neutral"
            type="button"
            variant="subtle"
            @click="showLoginForm"
          >
            Back to login
          </UButton>
          <UButton
            :loading="isResetSubmitting"
            type="submit"
          >
            Send link
          </UButton>
        </div>
      </form>

      <form
        v-else
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

        <div class="space-y-2">
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

          <UButton
            color="neutral"
            size="sm"
            type="button"
            variant="link"
            @click="showResetForm"
          >
            Forgot password?
          </UButton>
        </div>

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
