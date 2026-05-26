// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2026-05-26',

  nitro: {
    prerender: {
      autoSubfolderIndex: false
    },
    cloudflare: {
      nodeCompat: true
    }
  },

  vite: {
    optimizeDeps: {
      include: ['better-auth/vue', 'pdf-lib']
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  fonts: {
    families: [{
      name: 'Google Sans',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Bebas Neue',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Oswald',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Roboto',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Roboto Condensed',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Figtree',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Libre Baskerville',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Changa One',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Lexend',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Rye',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Sancreek',
      provider: 'google',
      weights: [400]
    }, {
      name: 'IM Fell Great Primer',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Creepster',
      provider: 'google',
      weights: [400]
    }, {
      name: 'Jersey 25',
      provider: 'google',
      weights: [400]
    }]
  }
})
