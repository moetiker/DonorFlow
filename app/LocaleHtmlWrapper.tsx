'use client'

import { useLocale } from 'next-intl'
import { useEffect } from 'react'

export function LocaleHtmlWrapper() {
  const locale = useLocale()

  useEffect(() => {
    // Update html lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
  }, [locale])

  return null
}
