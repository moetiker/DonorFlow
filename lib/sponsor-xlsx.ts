import ExcelJS from 'exceljs'
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
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Goenner')

  sheet.columns = SPONSOR_CSV_HEADERS.map((header, index) => ({
    header,
    width: COLUMN_WIDTHS[index] ?? 18
  }))

  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  for (const { sponsor, assignedTo } of entries) {
    const { count, sum } = summarizeCurrentDonations(sponsor, currentFiscalYearId)

    const row = sheet.addRow([
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
      sum
    ])
    row.getCell(13).numFmt = MONEY_FORMAT
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
