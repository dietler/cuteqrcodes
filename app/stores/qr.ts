import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useQrStore = defineStore('qr', () => {
  const url = ref('')

  const content = computed(() => url.value.trim())

  return {
    url,
    content
  }
})
