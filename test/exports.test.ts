import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SPONSOR_CSV_HEADERS,
  buildSponsorCsv,
  summarizeCurrentDonations,
  type SponsorCsvRow
} from '../lib/sponsor-csv'
import { buildSponsorWorkbook } from '../lib/sponsor-xlsx'
import { buildSponsorPdf } from '../lib/sponsor-pdf'
import type { StatusExportEntry } from '../lib/status-export'

/**
 * Regression tests for the three status-link export renderers. They are pure
 * functions, so no database or server is involved.
 *
 * The CSV assertion is deliberately byte-exact: pre-existing status links are
 * bookmarked by users and the CSV column set is consumed by their spreadsheets,
 * so a change here is a breaking change and should fail loudly.
 */

const CURRENT_FY = 'fy-current'
const OTHER_FY = 'fy-previous'

function sponsor(overrides: Partial<SponsorCsvRow> = {}): SponsorCsvRow {
  return {
    company: null,
    salutation: null,
    firstName: null,
    lastName: null,
    street: null,
    postalCode: null,
    city: null,
    phone: null,
    email: null,
    notes: null,
    donations: [],
    ...overrides
  }
}

const ENTRIES: StatusExportEntry[] = [
  {
    assignedTo: 'Müller Hans',
    sponsor: sponsor({
      company: 'Bäckerei Öhler AG',
      salutation: 'Herr',
      firstName: 'Hans',
      lastName: 'Müller',
      street: 'Bahnhofstrasse 1',
      postalCode: '8000',
      city: 'Zürich',
      phone: '044 111 22 33',
      email: 'hans@example.com',
      notes: 'Notiz mit, Komma',
      donations: [
        { amount: 100.5, fiscalYearId: CURRENT_FY },
        { amount: 50, fiscalYearId: CURRENT_FY },
        { amount: 999, fiscalYearId: OTHER_FY }
      ]
    })
  },
  {
    assignedTo: 'Turnverein (Gruppe)',
    sponsor: sponsor({ firstName: 'Ida', lastName: 'Zwicky' })
  }
]

test('summarizeCurrentDonations counts and sums only the current fiscal year', () => {
  const withDonations = ENTRIES[0].sponsor
  assert.deepEqual(summarizeCurrentDonations(withDonations, CURRENT_FY), { count: 2, sum: 150.5 })
})

test('summarizeCurrentDonations treats a null fiscal year as nothing in scope', () => {
  assert.deepEqual(summarizeCurrentDonations(ENTRIES[0].sponsor, null), { count: 0, sum: 0 })
})

test('summarizeCurrentDonations skips donations with a null amount', () => {
  const s = sponsor({
    donations: [
      { amount: null, fiscalYearId: CURRENT_FY },
      { amount: 25, fiscalYearId: CURRENT_FY }
    ]
  })
  assert.deepEqual(summarizeCurrentDonations(s, CURRENT_FY), { count: 2, sum: 25 })
})

test('the CSV header row is unchanged', () => {
  assert.equal(
    buildSponsorCsv([], CURRENT_FY),
    'Firma,Anrede,Vorname,Nachname,Strasse,PLZ,Ort,Telefon,E-Mail,Notizen,Zugeordnet zu,Anzahl Spenden (laufendes Jahr),Spendensumme (laufendes Jahr)'
  )
  assert.equal(SPONSOR_CSV_HEADERS.length, 13)
})

test('the CSV body is byte-for-byte stable, including quoting and the sum format', () => {
  const expected = [
    'Firma,Anrede,Vorname,Nachname,Strasse,PLZ,Ort,Telefon,E-Mail,Notizen,Zugeordnet zu,Anzahl Spenden (laufendes Jahr),Spendensumme (laufendes Jahr)',
    'Bäckerei Öhler AG,Herr,Hans,Müller,Bahnhofstrasse 1,8000,Zürich,044 111 22 33,hans@example.com,"Notiz mit, Komma",Müller Hans,2,150.50',
    ',,Ida,Zwicky,,,,,,,Turnverein (Gruppe),0,0.00'
  ].join('\n')
  assert.equal(buildSponsorCsv(ENTRIES, CURRENT_FY), expected)
})

test('the Excel workbook is a well-formed container', async () => {
  const buffer = await buildSponsorWorkbook(ENTRIES, CURRENT_FY)
  assert.ok(Buffer.isBuffer(buffer))
  assert.ok(buffer.length > 0)
  assert.equal(buffer.subarray(0, 2).toString('latin1'), 'PK', 'xlsx is a zip container')

  // Deliberately no assertion on the workbook's XML here: an .xlsx is a deflated
  // zip, so scanning the raw bytes for cell values silently finds nothing and any
  // such assertion would pass vacuously. Cell types, the #,##0.00 format, the
  // frozen header and the omission of null cells are verified by the throwaway
  // check script, which unzips the container properly.
})

test('an empty entry list still produces a workbook', async () => {
  const buffer = await buildSponsorWorkbook([], null)
  assert.equal(buffer.subarray(0, 2).toString('latin1'), 'PK')
})

test('the PDF is a well-formed document and renders an empty sponsor list', () => {
  const bytes = buildSponsorPdf('Turnverein Zürich', 'Vereinsjahr 2026', ENTRIES, CURRENT_FY)
  assert.ok(bytes instanceof Uint8Array)
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('latin1'), '%PDF-')

  const empty = buildSponsorPdf('Leere Gruppe', null, [], null)
  assert.ok(empty.length > 0, 'an empty sponsor list still produces a PDF')
})
