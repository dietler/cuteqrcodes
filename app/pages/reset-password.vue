<script setup lang="ts">
import { computed, ref } from 'vue'
import { resetPassword } from '~~/lib/auth-client'

const route = useRoute()
const password = ref('')
const passwordConfirmation = ref('')
const isSubmitting = ref(false)
const resetError = ref('')
const resetSuccess = ref('')
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')
const linkError = computed(() => route.query.error === 'INVALID_TOKEN' || !token.value ? 'Reset link is invalid or expired.' : '')
const canSubmit = computed(() => Boolean(token.value) && !resetSuccess.value)

async function submitPasswordReset() {
  resetError.value = ''

  if (!token.value) {
    resetError.value = 'Reset link is invalid or expired.'
    return
  }

  if (!password.value) {
    resetError.value = 'Password is required.'
    return
  }

  if (password.value.length < 8) {
    resetError.value = 'Password must be at least 8 characters.'
    return
  }

  if (password.value !== passwordConfirmation.value) {
    resetError.value = 'Passwords must match.'
    return
  }

  isSubmitting.value = true

  try {
    const result = await resetPassword({
      newPassword: password.value,
      token: token.value
    })

    if (result.error) {
      resetError.value = result.error.message || 'Unable to reset password.'
      return
    }

    resetSuccess.value = 'Password updated. You can log in now.'
    password.value = ''
    passwordConfirmation.value = ''
  } catch (error) {
    resetError.value = error instanceof Error ? error.message : 'Unable to reset password.'
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
        @submit.prevent="submitPasswordReset"
      >
        <div>
          <h1 class="text-lg font-semibold text-highlighted">
            Reset password
          </h1>
          <p class="mt-1 text-sm text-muted">
            Choose a new password for your account.
          </p>
        </div>

        <UAlert
          v-if="linkError || resetError"
          color="warning"
          icon="i-lucide-triangle-alert"
          :title="linkError || resetError"
          variant="subtle"
        />

        <UAlert
          v-if="resetSuccess"
          color="success"
          icon="i-lucide-circle-check"
          :title="resetSuccess"
          variant="subtle"
        />

        <template v-if="canSubmit">
          <UFormField label="New Password">
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
              Reset password
            </UButton>
          </div>
        </template>

        <div
          v-else
          class="flex justify-end"
        >
          <UButton to="/login">
            Login
          </UButton>
        </div>
      </form>
    </UCard>
  </UContainer>
</template>
