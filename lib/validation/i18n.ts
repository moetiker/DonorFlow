import { NextRequest } from 'next/server'
import { locales, type Locale, defaultLocale } from '@/lib/i18n/config'

/**
 * Extract locale from Accept-Language header
 * Priority: Accept-Language header → default locale
 *
 * Examples:
 * - "de-CH, de;q=0.9, en;q=0.8" → 'de'
 * - "en-US, en;q=0.9" → 'en'
 * - "fr-FR" → 'fr'
 */
export function getLocaleFromRequest(request: NextRequest): Locale {
  const acceptLanguage = request.headers.get('accept-language')

  if (!acceptLanguage) return defaultLocale

  // Parse Accept-Language header: "de-CH, de;q=0.9, en;q=0.8"
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [locale, qValue] = lang.trim().split(';')
      const quality = qValue ? parseFloat(qValue.split('=')[1]) : 1.0
      return { locale: locale.toLowerCase(), quality }
    })
    .sort((a, b) => b.quality - a.quality)

  // Find first matching locale
  for (const { locale: browserLocale } of languages) {
    // Try exact match first (e.g., "de")
    if (locales.includes(browserLocale as Locale)) {
      return browserLocale as Locale
    }

    // Try language prefix (e.g., "de-CH" → "de")
    const lang = browserLocale.split('-')[0]
    if (locales.includes(lang as Locale)) {
      return lang as Locale
    }
  }

  return defaultLocale
}

// In-memory cache for loaded messages
const messagesCache = new Map<Locale, any>()

/**
 * Load translation messages for a specific locale
 * Server-side only - dynamic import of JSON files
 * Results are cached in memory for performance
 */
export async function getMessages(locale: Locale): Promise<any> {
  if (messagesCache.has(locale)) {
    return messagesCache.get(locale)
  }

  try {
    const messages = (await import(`@/messages/${locale}.json`)).default
    messagesCache.set(locale, messages)
    return messages
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error)
    // Fallback to default locale
    if (locale !== defaultLocale) {
      return getMessages(defaultLocale)
    }
    throw error
  }
}

/**
 * Simple string interpolation
 * Replaces {key} placeholders with values
 *
 * @example
 * interpolate("Must be at least {min} characters", { min: 6 })
 * // => "Must be at least 6 characters"
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key]
    return value !== undefined ? String(value) : `{${key}}`
  })
}
