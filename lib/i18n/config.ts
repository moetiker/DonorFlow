export const locales = ['de', 'en', 'fr', 'it'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  it: 'Italiano'
}

export const localeFlags: Record<Locale, string> = {
  de: '🇩🇪',
  en: '🇬🇧',
  fr: '🇫🇷',
  it: '🇮🇹'
}
