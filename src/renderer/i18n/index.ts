import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Locale } from '../../types'
import ptBR from './locales/pt-BR.json'
import es from './locales/es.json'

const LOCALE_KEY = 'lexio_locale'
const savedLocale = localStorage.getItem(LOCALE_KEY) as Locale | null

i18n
  .use(initReactI18next)
  .init({
    lng: savedLocale ?? 'pt-BR',
    fallbackLng: 'pt-BR',
    resources: {
      'pt-BR': { translation: ptBR },
      'es': { translation: es },
    },
    interpolation: { escapeValue: false },
  })

export default i18n
