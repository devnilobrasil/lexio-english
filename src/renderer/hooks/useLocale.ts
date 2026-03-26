// src/renderer/hooks/useLocale.ts
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { Locale } from '../../types'

const LOCALE_KEY = 'lexio_locale'

export function useLocale() {
  const { i18n } = useTranslation()

  const locale = i18n.language as Locale

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(LOCALE_KEY, next)
    i18n.changeLanguage(next)
  }, [i18n])

  return { locale, setLocale }
}
