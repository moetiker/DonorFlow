import { prisma } from './db'
import type { Prisma } from '@prisma/client'
import { sponsorCsvSelect, type SponsorCsvRow } from './sponsor-csv'
import {
  donationsCreditedTo,
  donationsCreditedToGroupTotal,
  sponsorsListedFor,
  recipientLabel,
  type RecipientRef
} from './crediting'

/**
 * Shared data loading for the public status-link exports. All export formats
 * (CSV, Excel, PDF) build on this single result so their rows and ordering are
 * guaranteed to be identical.
 */

// Status tokens are 32 characters (base64url, 192 bits entropy)
export const STATUS_TOKEN_LENGTH = 32

export type StatusExportEntry = {
  sponsor: SponsorCsvRow
  /** Member display name for a member link, "<group> (Gruppe)" for a group link */
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
 * Resolves a status token to the sponsor list it grants access to. Each
 * sponsor's donations are limited to those credited to the link's recipient.
 * Returns null when the token belongs to neither a member nor an active group,
 * so callers answer an unknown and an invalid token identically.
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

  // Member link: sponsors assigned to the member plus donors credited to it
  const member = await prisma.member.findUnique({
    where: { statusToken: token },
    select: { id: true, firstName: true, lastName: true }
  })

  if (member) {
    const ref: RecipientRef = { memberId: member.id }
    const memberName = recipientLabel({ member, group: null })
    const sponsors = await loadSponsorRows(sponsorsListedFor(ref), donationsCreditedTo(ref))
    return {
      name: memberName,
      entries: sponsors.map(sponsor => ({ sponsor, assignedTo: memberName })),
      currentFiscalYearId,
      fiscalYearName
    }
  }

  // Group link: sponsors assigned to the group itself plus donors credited to
  // the group itself; their donations count those credited to the group or to
  // any of its members. A dissolved group exports nothing.
  const group = await prisma.group.findUnique({
    where: { statusToken: token },
    select: { id: true, name: true, dissolvedAt: true, members: { select: { id: true } } }
  })

  if (group && !group.dissolvedAt) {
    const sponsors = await loadSponsorRows(
      sponsorsListedFor({ groupId: group.id }),
      donationsCreditedToGroupTotal(group.id, group.members.map(m => m.id))
    )
    const assignedTo = recipientLabel({ member: null, group })
    return {
      name: group.name,
      entries: sponsors.map(sponsor => ({ sponsor, assignedTo })),
      currentFiscalYearId,
      fiscalYearName
    }
  }

  return null
}

/**
 * Sponsors matching `listed`, sorted by name, with their donations limited
 * to `credited`.
 */
function loadSponsorRows(
  listed: Prisma.SponsorWhereInput,
  credited: Prisma.DonationWhereInput
): Promise<SponsorCsvRow[]> {
  return prisma.sponsor.findMany({
    where: listed,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { company: 'asc' }],
    select: sponsorCsvSelect(credited)
  })
}
