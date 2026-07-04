import { createI18n } from 'vue-i18n'
import en from './locales/en.js'
import ptPT from './locales/pt-PT.js'

const STORAGE_KEY = 'pubquiz_language'

export const SUPPORTED_LANGUAGES = [
  { code: 'en',    label: 'English',    flag: '🇬🇧' },
  { code: 'pt-PT', label: 'Português',  flag: '🇵🇹' },
]

export function getSavedLocale() {
  return localStorage.getItem(STORAGE_KEY)
}

export const i18n = createI18n({
  legacy: false,
  locale: getSavedLocale() ?? 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    'pt-PT': ptPT,
  },
})

export function setLocale(lang) {
  i18n.global.locale.value = lang
  localStorage.setItem(STORAGE_KEY, lang)
}
