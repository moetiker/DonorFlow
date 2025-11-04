import { locales, defaultLocale, type Locale } from './config'

/**
 * Detect locale from browser preferences
 * Priority: localStorage > browser language > default
 *
 * Special rules:
 * - de-AT (Austria), de-DE (Germany), de-CH (Switzerland) → 'de'
 * - fr-FR, fr-CH, fr-BE → 'fr'
 * - it-IT, it-CH → 'it'
 * - en-* → 'en'
 * - Otherwise → 'en' (default)
 */
export function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale

  // Check localStorage first
  const stored = localStorage.getItem('locale')
  if (stored && locales.includes(stored as Locale)) {
    return stored as Locale
  }

  // Check browser languages
  const browserLocales = navigator.languages || [navigator.language]
  for (const browserLocale of browserLocales) {
    const fullLocale = browserLocale.toLowerCase()

    // Map specific locale codes to our supported languages
    if (fullLocale.startsWith('de-')) {
      // de-AT (Austria), de-DE (Germany), de-CH (Switzerland) → German
      return 'de'
    }
    if (fullLocale.startsWith('fr-')) {
      // fr-FR, fr-CH, fr-BE → French
      return 'fr'
    }
    if (fullLocale.startsWith('it-')) {
      // it-IT, it-CH → Italian
      return 'it'
    }
    if (fullLocale.startsWith('en-')) {
      // en-US, en-GB, etc. → English
      return 'en'
    }

    // Fallback: check base language code
    const lang = browserLocale.split('-')[0] // 'en-US' → 'en'
    if (locales.includes(lang as Locale)) {
      return lang as Locale
    }
  }

  return defaultLocale
}

/**
 * Save locale preference
 */
export function saveLocale(locale: Locale): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('locale', locale)
  // Also set as cookie for SSR hydration
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000` // 1 year
}

/**
 * Get locale from cookie (for SSR)
 */
export function getLocaleFromCookie(): Locale | null {
  if (typeof document === 'undefined') return null

  const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/)
  const locale = match?.[1]

  if (locale && locales.includes(locale as Locale)) {
    return locale as Locale
  }

  return null
}
