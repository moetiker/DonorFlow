'use client'

import { NavDropdown } from 'react-bootstrap'
import { useLocale } from 'next-intl'
import { locales, localeNames, localeFlags, type Locale } from '@/lib/i18n/config'

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale

  const handleLocaleChange = (newLocale: Locale) => {
    if (typeof window !== 'undefined' && (window as any).__setLocale) {
      (window as any).__setLocale(newLocale)
    }
  }

  return (
    <NavDropdown
      title={
        <>
          {localeFlags[currentLocale]} {localeNames[currentLocale]}
        </>
      }
      id="language-dropdown"
      align="end"
    >
      {locales.map((locale) => (
        <NavDropdown.Item
          key={locale}
          active={locale === currentLocale}
          onClick={() => handleLocaleChange(locale)}
        >
          {localeFlags[locale]} {localeNames[locale]}
        </NavDropdown.Item>
      ))}
    </NavDropdown>
  )
}
