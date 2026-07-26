import { buildCSV } from './csv'

/**
 * Shared address-CSV building for a set of sponsors, scoped to one fiscal year
 * for the donation-summary columns. Used by the public status export and the
 * donor mailing so both produce identical CSVs.
 */

// Prisma select for a sponsor row used in the CSV
export const SPONSOR_CSV_SELECT = {
  company: true,
  salutation: true,
  firstName: true,
  lastName: true,
  street: true,
  postalCode: true,
  city: true,
  phone: true,
  email: true,
  notes: true,
  donations: { select: { amount: true, fiscalYearId: true } },
} as const

export type SponsorCsvRow = {
  company: string | null
  salutation: string | null
  firstName: string | null
  lastName: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  phone: string | null
  email: string | null
  notes: string | null
  donations: { amount: number | null; fiscalYearId: string | null }[]
}

export const SPONSOR_CSV_HEADERS = [
  'Firma',
  'Anrede',
  'Vorname',
  'Nachname',
  'Strasse',
  'PLZ',
  'Ort',
  'Telefon',
  'E-Mail',
  'Notizen',
  'Zugeordnet zu',
  'Anzahl Spenden (laufendes Jahr)',
  'Spendensumme (laufendes Jahr)',
]

/**
 * Builds the CSV string from sponsor entries. Each entry pairs a sponsor with
 * the "assigned to" label (member name or "<group> (Gruppe)"). Donation count
 * and sum count only the current fiscal year, matching the status page.
 */
// Address-only variant (used for the donor mailing): no notes, assignment, or
// donation-summary columns.
export const SPONSOR_ADDRESS_HEADERS = [
  'Firma',
  'Anrede',
  'Vorname',
  'Nachname',
  'Strasse',
  'PLZ',
  'Ort',
  'Telefon',
  'E-Mail',
]

export function buildSponsorAddressCsv(sponsors: SponsorCsvRow[]): string {
  const rows = sponsors.map((s) => [
    s.company,
    s.salutation,
    s.firstName,
    s.lastName,
    s.street,
    s.postalCode,
    s.city,
    s.phone,
    s.email,
  ])
  return buildCSV(SPONSOR_ADDRESS_HEADERS, rows)
}

/**
 * Counts a sponsor's donations in the given fiscal year and sums their amounts.
 * Shared by every export format so the CSV, Excel and PDF summaries cannot
 * drift apart. A null fiscal year yields zeros - nothing is in scope.
 */
export function summarizeCurrentDonations(
  sponsor: SponsorCsvRow,
  currentFiscalYearId: string | null
): { count: number; sum: number } {
  const current = currentFiscalYearId
    ? sponsor.donations.filter((d) => d.fiscalYearId === currentFiscalYearId)
    : []
  return {
    count: current.length,
    sum: current.reduce((acc, d) => acc + (d.amount || 0), 0)
  }
}

export function buildSponsorCsv(
  entries: { sponsor: SponsorCsvRow; assignedTo: string }[],
  currentFiscalYearId: string | null
): string {
  const rows = entries.map(({ sponsor, assignedTo }) => {
    const { count, sum } = summarizeCurrentDonations(sponsor, currentFiscalYearId)
    return [
      sponsor.company,
      sponsor.salutation,
      sponsor.firstName,
      sponsor.lastName,
      sponsor.street,
      sponsor.postalCode,
      sponsor.city,
      sponsor.phone,
      sponsor.email,
      sponsor.notes,
      assignedTo,
      count,
      sum.toFixed(2),
    ]
  })
  return buildCSV(SPONSOR_CSV_HEADERS, rows)
}
