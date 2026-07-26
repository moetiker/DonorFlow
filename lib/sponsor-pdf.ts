import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { summarizeCurrentDonations } from './sponsor-csv'
import type { StatusExportEntry } from './status-export'

/**
 * PDF rendering of the sponsor address list, A4 landscape. The CSV's 13 columns
 * do not fit legibly, so related fields are combined into two-line cells and
 * salutation and notes are omitted.
 */

const HEADERS = [
  'Firma / Name',
  'Adresse',
  'Telefon',
  'E-Mail',
  'Zugeordnet zu',
  'Spenden',
  'Summe'
]

function nonEmpty(parts: (string | null | undefined)[]): string[] {
  return parts.map((p) => (p ?? '').trim()).filter((p) => p.length > 0)
}

/** Joins the non-empty parts with newlines, producing a multi-line table cell. */
function multiline(...parts: (string | null | undefined)[]): string {
  return nonEmpty(parts).join('\n')
}

/** Joins the non-empty parts with a single space, for one line of a cell. */
function oneline(...parts: (string | null | undefined)[]): string {
  return nonEmpty(parts).join(' ')
}

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`
}

export function buildSponsorPdf(
  title: string,
  fiscalYearName: string | null,
  entries: StatusExportEntry[],
  currentFiscalYearId: string | null
): Uint8Array {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFontSize(14)
  doc.text(title, 12, 14)
  doc.setFontSize(10)
  const subtitleParts = [fiscalYearName, formatDate(new Date())].filter(Boolean)
  doc.text(subtitleParts.join(' • '), 12, 20)

  const body = entries.map(({ sponsor, assignedTo }) => {
    const { count, sum } = summarizeCurrentDonations(sponsor, currentFiscalYearId)
    return [
      multiline(sponsor.company, oneline(sponsor.firstName, sponsor.lastName)),
      multiline(sponsor.street, oneline(sponsor.postalCode, sponsor.city)),
      sponsor.phone ?? '',
      sponsor.email ?? '',
      assignedTo,
      String(count),
      sum.toFixed(2)
    ]
  })

  autoTable(doc, {
    head: [HEADERS],
    body,
    startY: 25,
    margin: { left: 12, right: 12, bottom: 16 },
    styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [234, 118, 0], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 48 },
      2: { cellWidth: 28 },
      3: { cellWidth: 60 },
      4: { cellWidth: 47 },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' }
    }
  })

  // Footer with page numbers - added after the table so the total is known
  const pageCount = doc.getNumberOfPages()
  doc.setFontSize(8)
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.text(`Seite ${page} von ${pageCount}`, pageWidth - 12, pageHeight - 8, { align: 'right' })
  }

  return new Uint8Array(doc.output('arraybuffer'))
}
