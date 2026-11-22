import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSponsorDisplayName, getMemberDisplayName, getGroupDisplayName } from '@/lib/utils'
import {
  donationsCreditedTo,
  donationsCreditedToGroupTotal,
  sponsorsAssignedTo,
  type RecipientRef
} from '@/lib/crediting'

/**
 * Data behind the public status page (GET /api/public/status/[token]).
 *
 * Everything shown for one member or group counts only the donations credited
 * to that recipient (donation.memberId / donation.groupId), never a sponsor's
 * donations to other recipients:
 * - member: sponsors assigned to the member plus sponsors of donations
 *   credited to the member
 * - group: sponsors assigned to the group itself plus sponsors of donations
 *   credited to the group or to any of its members; the group total counts
 *   the same donations
 * - dissolved group: only its name, no data
 */

export interface StatusFiscalYear {
  name: string
  startDate: Date
  endDate: Date
}

export interface StatusProgress {
  target: number
  actual: number
  percentage: number
}

export interface StatusInKindDonation {
  description: string
  date: Date
  /** Member the donation is credited to; null when credited to a group */
  memberName: string | null
}

export interface StatusHistoryEntry {
  date: Date
  type: string
  amount: number | null
  description: string | null
  fiscalYearName: string
}

export interface StatusSponsor {
  name: string
  phone: string | null
  email: string | null
  donated: boolean
  donatedLastYear: boolean
  isLYBUNT: boolean
  totalAmount: number
  lastDonation: Date | null
  inKindDonations: StatusInKindDonation[]
  history: StatusHistoryEntry[]
}

export type StatusData =
  | {
      type: 'member'
      name: string
      fiscalYear: StatusFiscalYear | null
      progress: StatusProgress
      sponsors: StatusSponsor[]
    }
  | {
      type: 'group'
      name: string
      fiscalYear: StatusFiscalYear | null
      progress: StatusProgress
      groupSponsors: StatusSponsor[]
    }
  | { type: 'dissolved'; name: string }

const SPONSOR_FIELDS = {
  id: true,
  company: true,
  phone: true,
  email: true,
  firstName: true,
  lastName: true
} as const

const DONATION_FIELDS = {
  type: true,
  amount: true,
  description: true,
  donationDate: true,
  fiscalYearId: true,
  fiscalYear: { select: { name: true } },
  member: { select: { firstName: true, lastName: true } }
} as const

type SponsorWithDonations = Prisma.SponsorGetPayload<{
  select: typeof SPONSOR_FIELDS & { donations: { select: typeof DONATION_FIELDS } }
}>

/**
 * Sponsors to list for a recipient: those matching `assigned` plus everyone
 * with a donation matching `credited`. Each sponsor's donations are limited to
 * `credited`, most recent first.
 */
function loadSponsors(
  assigned: Prisma.SponsorWhereInput,
  credited: Prisma.DonationWhereInput
): Promise<SponsorWithDonations[]> {
  return prisma.sponsor.findMany({
    where: { OR: [assigned, { donations: { some: credited } }] },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { company: 'asc' }],
    select: {
      ...SPONSOR_FIELDS,
      donations: { where: credited, orderBy: { donationDate: 'desc' }, select: DONATION_FIELDS }
    }
  })
}

/**
 * Resolves a status token to the data shown on the public status page.
 * Returns null when the token belongs to neither a member nor a group.
 */
export async function loadStatusData(token: string): Promise<StatusData | null> {
  const now = new Date()
  const currentFiscalYear = await prisma.fiscalYear.findFirst({
    where: { startDate: { lte: now }, endDate: { gte: now } },
    select: { id: true, name: true, startDate: true, endDate: true }
  })

  // Previous fiscal year: the one with the greatest startDate before the
  // current year's start. Comparing on startDate (not endDate) is robust when
  // adjacent fiscal years touch or overlap by a day at the boundary, which would
  // otherwise leave previousFiscalYear null and make LYBUNT detection impossible.
  const previousFiscalYear = currentFiscalYear
    ? await prisma.fiscalYear.findFirst({
        where: { startDate: { lt: currentFiscalYear.startDate } },
        orderBy: { startDate: 'desc' },
        select: { id: true }
      })
    : null

  const fiscalYear = currentFiscalYear
    ? {
        name: currentFiscalYear.name,
        startDate: currentFiscalYear.startDate,
        endDate: currentFiscalYear.endDate
      }
    : null
  const currentId = currentFiscalYear?.id ?? null
  const previousId = previousFiscalYear?.id ?? null
  const targetSelect = currentFiscalYear
    ? { where: { fiscalYearId: currentFiscalYear.id }, select: { targetAmount: true } }
    : { take: 0, select: { targetAmount: true } }

  const member = await prisma.member.findUnique({
    where: { statusToken: token },
    select: { id: true, firstName: true, lastName: true, memberTargets: targetSelect }
  })

  if (member) {
    const ref: RecipientRef = { memberId: member.id }
    const sponsors = await loadSponsors(sponsorsAssignedTo(ref), donationsCreditedTo(ref))
    const target = member.memberTargets[0]?.targetAmount ?? 0
    const { actual, sponsors: list } = buildSponsorList(sponsors, currentId, previousId)
    return {
      type: 'member',
      name: getMemberDisplayName(member),
      fiscalYear,
      progress: progress(target, actual),
      sponsors: list
    }
  }

  const group = await prisma.group.findUnique({
    where: { statusToken: token },
    select: {
      id: true,
      name: true,
      dissolvedAt: true,
      members: { select: { id: true, memberTargets: targetSelect } }
    }
  })

  if (!group) return null

  if (group.dissolvedAt) {
    return { type: 'dissolved', name: getGroupDisplayName(group) }
  }

  const memberIds = group.members.map(m => m.id)
  const sponsors = await loadSponsors(
    sponsorsAssignedTo({ groupId: group.id }),
    donationsCreditedToGroupTotal(group.id, memberIds)
  )
  // Group target = sum of the member targets
  const target = group.members.reduce((sum, m) => sum + (m.memberTargets[0]?.targetAmount ?? 0), 0)
  const { actual, sponsors: list } = buildSponsorList(sponsors, currentId, previousId)
  return {
    type: 'group',
    name: getGroupDisplayName(group),
    fiscalYear,
    progress: progress(target, actual),
    groupSponsors: list
  }
}

function progress(target: number, actual: number): StatusProgress {
  return { target, actual, percentage: target > 0 ? Math.round((actual / target) * 100) : 0 }
}

/**
 * Builds the per-sponsor rows and the collected total. The donations passed in
 * are already limited to the recipient; amounts count monetary donations of
 * the current fiscal year only.
 */
function buildSponsorList(
  sponsors: SponsorWithDonations[],
  currentFiscalYearId: string | null,
  previousFiscalYearId: string | null
): { actual: number; sponsors: StatusSponsor[] } {
  let totalActual = 0

  const list = sponsors.map(sponsor => {
    const donations = sponsor.donations
    const currentYearDonations = donations.filter(d => d.fiscalYearId === currentFiscalYearId)
    const previousYearDonations = donations.filter(d => d.fiscalYearId === previousFiscalYearId)

    const monetaryDonations = currentYearDonations.filter(d => d.type === 'MONETARY')
    const inKindDonations = currentYearDonations.filter(d => d.type === 'IN_KIND')

    const totalAmount = monetaryDonations.reduce((sum, d) => sum + (d.amount ?? 0), 0)
    const lastDonation = monetaryDonations[0]?.donationDate ?? null
    totalActual += totalAmount

    // LYBUNT detection: donated last year but not this year (any type counts)
    const donatedThisYear = currentYearDonations.length > 0
    const donatedLastYear = previousYearDonations.length > 0

    return {
      name: getSponsorDisplayName(sponsor),
      phone: sponsor.phone,
      email: sponsor.email,
      donated: donatedThisYear,
      donatedLastYear,
      isLYBUNT: donatedLastYear && !donatedThisYear,
      totalAmount,
      lastDonation,
      inKindDonations: inKindDonations.map(d => ({
        description: d.description ?? '',
        date: d.donationDate,
        memberName: d.member ? getMemberDisplayName(d.member) : null
      })),
      // Full donation history across all fiscal years (most recent first)
      history: donations.map(d => ({
        date: d.donationDate,
        type: d.type,
        amount: d.amount ?? null,
        description: d.description ?? null,
        fiscalYearName: d.fiscalYear?.name ?? ''
      }))
    }
  })

  return { actual: totalActual, sponsors: list }
}
