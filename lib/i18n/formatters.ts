'use client'

import { useLocale, useFormatter } from 'next-intl'
import { type Locale } from './config'

/**
 * Hook to get locale-aware formatting functions
 * Uses next-intl's built-in formatter with proper locale support
 */
export function useLocalizedFormatters() {
  const locale = useLocale() as Locale
  const format = useFormatter()

  return {
    /**
     * Format currency amount
     * For German: CHF 1'000.00 (apostrophe as thousands separator, dot as decimal - Swiss style)
     * For English: CHF 1,000.00 (comma as thousands separator, dot as decimal)
     * For French: CHF 1 000,00 (space as thousands separator, comma as decimal)
     * For Italian: CHF 1.000,00 (dot as thousands separator, comma as decimal)
     */
    formatCurrency: (amount: number): string => {
      // Map our locales to proper BCP 47 locale tags for currency formatting
      const localeMap: Record<Locale, string> = {
        de: 'de-CH', // German (Switzerland) - uses apostrophe for thousands, dot for decimal
        en: 'en-US', // English (US) - uses comma for thousands, dot for decimal
        fr: 'fr-FR', // French (France) - uses space for thousands, comma for decimal
        it: 'it-IT'  // Italian (Italy) - uses dot for thousands, comma for decimal
      }

      const formattingLocale = localeMap[locale]

      return new Intl.NumberFormat(formattingLocale, {
        style: 'currency',
        currency: 'CHF',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
    },

    /**
     * Format date
     * Adapts to locale-specific date format
     */
    formatDate: (date: Date | string): string => {
      const d = typeof date === 'string' ? new Date(date) : date
      return format.dateTime(d, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Europe/Zurich'
      })
    },

    /**
     * Format date and time
     * Adapts to locale-specific date/time format
     */
    formatDateTime: (date: Date | string): string => {
      const d = typeof date === 'string' ? new Date(date) : date
      return format.dateTime(d, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Zurich'
      })
    },

    /**
     * Format number
     * Adapts to locale-specific number formatting
     */
    formatNumber: (num: number): string => {
      return format.number(num)
    },

    /**
     * Current locale
     */
    locale
  }
}
