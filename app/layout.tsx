import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './globals.css'
import { Providers } from './providers'
import { LocaleHtmlWrapper } from './LocaleHtmlWrapper'

const inter = Inter({ subsets: ['latin'] })

// Force dynamic rendering for all routes
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Gönnerverwaltung',
  description: 'Gönnerverwaltung für Vereinsmitglieder und Gruppen'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <LocaleHtmlWrapper />
          {children}
        </Providers>
      </body>
    </html>
  )
}
