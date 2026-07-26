import { prisma } from './db'
import { getMemberDisplayName } from './utils'
import { SPONSOR_CSV_SELECT, type SponsorCsvRow } from './sponsor-csv'

/**
 * Shared data loading for the public status-link exports. All export formats
 * (CSV, Excel, PDF) build on this single result so their rows and ordering are
 * guaranteed to be identical.
 */

// Status tokens are 32 characters (base64url, 192 bits entropy)
export const STATUS_TOKEN_LENGTH = 32

export type StatusExportEntry = {
  sponsor: SponsorCsvRow
  /** Member display name, or "<group> (Gruppe)" for group-level sponsors */
  assignedTo: string
}

export type StatusExportData = {
  /** Member or group name - used for the file name and the PDF header */
  name: string
  entries: StatusExportEntry[]
  currentFiscalYearId: string | null
  fiscalYearName: string | null
}

/**
 * Resolves a status token to the sponsor list it grants access to.
 * Returns null when the token belongs to neither a member nor a group, so
 * callers answer an unknown and an invalid token identically.
 */
export async function loadStatusExportData(token: string): Promise<StatusExportData | null> {
  // Current fiscal year - donation totals are scoped to it (matches status page)
  const now = new Date()
  const currentFiscalYear = await prisma.fiscalYear.findFirst({
    where: { startDate: { lte: now }, endDate: { gte: now } },
    select: { id: true, name: true }
  })
  const currentFiscalYearId = currentFiscalYear?.id ?? null
  const fiscalYearName = currentFiscalYear?.name ?? null

  // Member link: the member's own sponsors
  const member = await prisma.member.findUnique({
    where: { statusToken: token },
    select: {
      firstName: true,
      lastName: true,
      sponsors: { orderBy: { lastName: 'asc' }, select: SPONSOR_CSV_SELECT }
    }
  })

  if (member) {
    const memberName = getMemberDisplayName(member)
    return {
      name: memberName,
      entries: member.sponsors.map((sponsor: SponsorCsvRow) => ({ sponsor, assignedTo: memberName })),
      currentFiscalYearId,
      fiscalYearName
    }
  }

  // Group link: group-level sponsors first, then every member's sponsors
  const group = await prisma.group.findUnique({
    where: { statusToken: token },
    select: {
      name: true,
      sponsors: { orderBy: { lastName: 'asc' }, select: SPONSOR_CSV_SELECT },
      members: {
        orderBy: { lastName: 'asc' },
        select: {
          firstName: true,
          lastName: true,
          sponsors: { orderBy: { lastName: 'asc' }, select: SPONSOR_CSV_SELECT }
        }
      }
    }
  })

  if (group) {
    const entries: StatusExportEntry[] = []
    for (const sponsor of group.sponsors) {
      entries.push({ sponsor, assignedTo: `${group.name} (Gruppe)` })
    }
    for (const groupMember of group.members) {
      const memberName = getMemberDisplayName(groupMember)
      for (const sponsor of groupMember.sponsors) {
        entries.push({ sponsor, assignedTo: memberName })
      }
    }
    return { name: group.name, entries, currentFiscalYearId, fiscalYearName }
  }

  return null
}
