import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { summarizeCurrentDonations } from './sponsor-csv'
import type { StatusExportEntry } from './status-export'

/**
 * PDF rendering of the sponsor address list, A4 landscape. The CSV's 13 columns
 * do not fit legibly, so related fields are combined into two-line cells and
 * salutation and notes are omitted.
 */

// Page margins in mm. The column widths in columnStyles below are sized to the
// resulting usable width (297 - 2 * 12 = 273 mm), so changing this means
// resizing them too.
const MARGIN = 12

// Baseline distance between two wrapped title lines at font size 14, in mm.
const TITLE_LINE_HEIGHT = 6

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

  // The title is a member or group name and can be arbitrarily long, so wrap it
  // to the usable width instead of letting it run off the page. Everything below
  // shifts down by however many lines it takes.
  doc.setFontSize(14)
  const titleLines: string[] = doc.splitTextToSize(title, pageWidth - MARGIN * 2)
  doc.text(titleLines, MARGIN, 14)

  const subtitleY = 14 + titleLines.length * TITLE_LINE_HEIGHT
  doc.setFontSize(10)
  const subtitleParts = [fiscalYearName, formatDate(new Date())].filter(Boolean)
  doc.text(subtitleParts.join(' • '), MARGIN, subtitleY)

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
    startY: subtitleY + 5,
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
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
    doc.text(`Seite ${page} von ${pageCount}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' })
  }

  return new Uint8Array(doc.output('arraybuffer'))
}
