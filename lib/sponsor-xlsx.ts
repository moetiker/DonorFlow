import writeExcelFile from 'write-excel-file/node'
import { SPONSOR_CSV_HEADERS, summarizeCurrentDonations } from './sponsor-csv'
import type { StatusExportEntry } from './status-export'

/**
 * Excel rendering of the sponsor address list. Same columns as the CSV export,
 * but the donation count and sum are written as real numbers so they can be
 * summed and sorted in a spreadsheet application.
 */

// Column widths in characters, aligned with SPONSOR_CSV_HEADERS
const COLUMN_WIDTHS = [26, 10, 16, 20, 26, 8, 20, 18, 28, 32, 24, 12, 14]

const MONEY_FORMAT = '#,##0.00'

export async function buildSponsorWorkbook(
  entries: StatusExportEntry[],
  currentFiscalYearId: string | null
): Promise<Buffer> {
  const headerRow = SPONSOR_CSV_HEADERS.map((header) => ({
    value: header,
    fontWeight: 'bold' as const
  }))

  const rows = entries.map(({ sponsor, assignedTo }) => {
    const { count, sum } = summarizeCurrentDonations(sponsor, currentFiscalYearId)
    return [
      // Nullable address fields are coerced to `undefined`, not `''` — an empty
      // string and an empty cell are different things in a spreadsheet, and the
      // library only renders a truly empty cell for `undefined`/`null`.
      { value: sponsor.company ?? undefined },
      { value: sponsor.salutation ?? undefined },
      { value: sponsor.firstName ?? undefined },
      { value: sponsor.lastName ?? undefined },
      { value: sponsor.street ?? undefined },
      { value: sponsor.postalCode ?? undefined },
      { value: sponsor.city ?? undefined },
      { value: sponsor.phone ?? undefined },
      { value: sponsor.email ?? undefined },
      { value: sponsor.notes ?? undefined },
      { value: assignedTo },
      { value: count, type: Number },
      { value: sum, type: Number, format: MONEY_FORMAT }
    ]
  })

  return writeExcelFile([headerRow, ...rows], {
    sheet: 'Goenner',
    stickyRowsCount: 1,
    columns: COLUMN_WIDTHS.map((width) => ({ width }))
  }).toBuffer()
}
