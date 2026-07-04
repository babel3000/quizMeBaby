import { createI18n } from 'vue-i18n'
import en from './locales/en.js'
import ptPT from './locales/pt-PT.js'

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    'pt-PT': ptPT,
  },
})

export function setLocale(lang) {
  i18n.global.locale.value = lang
}
