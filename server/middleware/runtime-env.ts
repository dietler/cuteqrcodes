import { populateProcessEnvFromRuntime } from '~~/server/utils/runtime-env'

export default defineEventHandler((event) => {
  populateProcessEnvFromRuntime(event)
})
