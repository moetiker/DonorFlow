'use client'

import { SessionProvider } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl'
import { useEffect, useState } from 'react'
import { detectBrowserLocale, saveLocale } from '@/lib/i18n/utils'
import { defaultLocale, type Locale } from '@/lib/i18n/config'

export function Providers({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [messages, setMessages] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Detect and load locale
    const detectedLocale = detectBrowserLocale()
    setLocaleState(detectedLocale)

    // Load messages for detected locale
    import(`../messages/${detectedLocale}.json`)
      .then((mod) => {
        setMessages(mod.default)
        setIsLoading(false)
      })
      .catch((error) => {
        console.error('Error loading messages:', error)
        // Fallback to default locale
        import(`../messages/${defaultLocale}.json`).then((mod) => {
          setMessages(mod.default)
          setIsLoading(false)
        })
      })
  }, [])

  // Expose locale setter for language switcher
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setLocale = (newLocale: Locale) => {
        setLocaleState(newLocale)
        saveLocale(newLocale)

        // Load new messages
        import(`../messages/${newLocale}.json`).then((mod) => {
          setMessages(mod.default)
        })
      }
    }
  }, [])

  if (isLoading || !messages) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SessionProvider>{children}</SessionProvider>
    </NextIntlClientProvider>
  )
}
