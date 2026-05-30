const googleAnalyticsMeasurementId = 'G-32JLP5DEZC'
const googleAnalyticsScriptId = 'google-analytics-gtag'
const googleAnalyticsHosts = new Set([
  'qrcodesonlabels.com',
  'www.qrcodesonlabels.com'
])

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export default defineNuxtPlugin(() => {
  if (!shouldEnableGoogleAnalytics()) {
    return
  }

  ensureGoogleAnalyticsScript()
  initializeGoogleAnalytics()

  const router = useRouter()
  let trackedPagePath = getCurrentPagePath()

  trackGoogleAnalyticsPageView(trackedPagePath)

  router.afterEach(() => {
    window.requestAnimationFrame(() => {
      const pagePath = getCurrentPagePath()

      if (pagePath === trackedPagePath) {
        return
      }

      trackedPagePath = pagePath
      trackGoogleAnalyticsPageView(pagePath)
    })
  })
})

function shouldEnableGoogleAnalytics() {
  return googleAnalyticsHosts.has(window.location.hostname)
}

function ensureGoogleAnalyticsScript() {
  if (document.getElementById(googleAnalyticsScriptId)) {
    return
  }

  const script = document.createElement('script')

  script.async = true
  script.id = googleAnalyticsScriptId
  script.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsMeasurementId}`
  document.head.append(script)
}

function initializeGoogleAnalytics() {
  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function gtag(...args: unknown[]) {
    window.dataLayer?.push(args)
  }
  window.gtag('js', new Date())
}

function trackGoogleAnalyticsPageView(pagePath: string) {
  window.gtag?.('config', googleAnalyticsMeasurementId, {
    page_location: window.location.href,
    page_path: pagePath,
    page_title: document.title
  })
}

function getCurrentPagePath() {
  return `${window.location.pathname}${window.location.search}`
}
