import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF'
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('de-CH').format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('de-CH', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(d)
}

// Prüft ob ein Datum innerhalb eines Vereinsjahres liegt
export function isDateInFiscalYear(
  date: Date,
  fiscalYearStart: Date,
  fiscalYearEnd: Date
): boolean {
  return date >= fiscalYearStart && date <= fiscalYearEnd
}

// Gibt das aktuelle Vereinsjahr basierend auf einem Datum zurück
export function getCurrentFiscalYearDates(
  startMonth: number = 7,
  startDay: number = 1
): { start: Date; end: Date } {
  const today = new Date()
  const currentYear = today.getFullYear()

  const fiscalYearStart = new Date(currentYear, startMonth - 1, startDay)

  let fiscalYearEnd: Date
  if (today < fiscalYearStart) {
    // Wir sind noch im vorherigen Vereinsjahr
    fiscalYearStart.setFullYear(currentYear - 1)
    fiscalYearEnd = new Date(currentYear, startMonth - 1, startDay - 1)
  } else {
    // Wir sind im aktuellen Vereinsjahr
    fiscalYearEnd = new Date(currentYear + 1, startMonth - 1, startDay - 1)
  }

  return { start: fiscalYearStart, end: fiscalYearEnd }
}

/**
 * Recursively serializes Date objects to ISO strings for JSON responses
 * Handles nested objects and arrays
 */
export function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (obj instanceof Date) {
    return obj.toISOString() as any
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeDates) as any
  }

  if (typeof obj === 'object') {
    const serialized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeDates(value)
    }
    return serialized
  }

  return obj
}

/**
 * Returns a display name for a sponsor
 * Prioritizes company name, falls back to first/last name combination
 */
export function getSponsorDisplayName(sponsor: {
  company: string | null
  firstName: string | null
  lastName: string | null
}): string {
  if (sponsor.company) {
    return sponsor.company
  }

  const parts = [sponsor.firstName, sponsor.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : 'Unbekannt'
}
