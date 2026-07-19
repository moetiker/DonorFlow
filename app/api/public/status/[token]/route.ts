import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withPublicApiRoute } from '@/lib/api-helpers'
import { serializeDates, getSponsorDisplayName, getMemberDisplayName, getGroupDisplayName } from '@/lib/utils'

// Token format: 32 characters (base64url, 192 bits entropy)
const TOKEN_LENGTH = 32

interface RouteParams {
  params: Promise<{ token: string }>
}

/**
 * Public status endpoint - returns donation collection progress for a member or group
 * No authentication required - access is granted via capability URL token
 *
 * GET /api/public/status/[token]
 *
 * Donation attribution logic:
 * - A donation is credited to member M if: donation.memberId = M.id OR (donation.memberId IS NULL AND sponsor.memberId = M.id)
 * - A donation is credited to group G if: donation.groupId = G.id OR (donation.groupId IS NULL AND sponsor.groupId = G.id)
 * - Donation-level overrides take precedence over sponsor assignments
 */
export const GET = withPublicApiRoute(async (request: NextRequest, { params }: RouteParams) => {
  const { token } = await params

  // Validate token format (must be exactly 32 characters)
  if (!token || token.length !== TOKEN_LENGTH) {
    return NextResponse.json(
      { error: 'Not found' },
      {
        status: 404,
        headers: {
          'Referrer-Policy': 'no-referrer',
          'Cache-Control': 'private, max-age=60'
        }
      }
    )
  }

  // Get current fiscal year
  const now = new Date()
  const currentFiscalYear = await prisma.fiscalYear.findFirst({
    where: {
      startDate: { lte: now },
      endDate: { gte: now }
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true
    }
  })

  // Get previous fiscal year: the one with the greatest startDate before the
  // current year's start. Comparing on startDate (not endDate) is robust when
  // adjacent fiscal years touch or overlap by a day at the boundary, which would
  // otherwise leave previousFiscalYear null and make LYBUNT detection impossible.
  const previousFiscalYear = currentFiscalYear
    ? await prisma.fiscalYear.findFirst({
        where: {
          startDate: { lt: currentFiscalYear.startDate }
        },
        orderBy: {
          startDate: 'desc'
        },
        select: {
          id: true
        }
      })
    : null

  // Try to find member by statusToken first
  const member = await prisma.member.findUnique({
    where: { statusToken: token },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      memberTargets: currentFiscalYear ? {
        where: { fiscalYearId: currentFiscalYear.id },
        select: { targetAmount: true }
      } : { take: 0 },
      sponsors: {
        select: {
          id: true,
          company: true,
          phone: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  })

  if (member) {
    // Get donations credited to this member
    // Either: donation.memberId = member.id (explicit override)
    // Or: donation.memberId IS NULL AND sponsor.memberId = member.id (sponsor's assignment)
    const donations = await prisma.donation.findMany({
      where: {
        OR: [
          // Explicit override to this member
          { memberId: member.id },
          // No override, sponsor assigned to this member
          {
            memberId: null,
            sponsor: { memberId: member.id }
          }
        ]
      },
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        donationDate: true,
        fiscalYearId: true,
        fiscalYear: { select: { name: true } },
        sponsor: {
          select: {
            id: true,
            company: true,
            phone: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { donationDate: 'desc' }
    })

    const response = buildMemberResponse(member, donations, currentFiscalYear, previousFiscalYear?.id ?? null)
    return NextResponse.json(serializeDates(response), {
      headers: {
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'private, max-age=60'
      }
    })
  }

  // Try to find group by statusToken
  const group = await prisma.group.findUnique({
    where: { statusToken: token },
    select: {
      id: true,
      name: true,
      members: {
        orderBy: { lastName: 'asc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          memberTargets: currentFiscalYear ? {
            where: { fiscalYearId: currentFiscalYear.id },
            select: { targetAmount: true }
          } : { take: 0 },
          sponsors: {
            select: {
              id: true,
              company: true,
              phone: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      },
      sponsors: {
        select: {
          id: true,
          company: true,
          phone: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  })

  if (group) {
    // Get donations credited to this group (group-level)
    // Either: donation.groupId = group.id (explicit override)
    // Or: donation.groupId IS NULL AND sponsor.groupId = group.id (sponsor's assignment)
    const groupDonations = await prisma.donation.findMany({
      where: {
        OR: [
          // Explicit override to this group
          { groupId: group.id },
          // No override, sponsor assigned to this group
          {
            groupId: null,
            memberId: null,  // Also no member override
            sponsor: { groupId: group.id }
          }
        ]
      },
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        donationDate: true,
        fiscalYearId: true,
        fiscalYear: { select: { name: true } },
        sponsor: {
          select: {
            id: true,
            company: true,
            phone: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { donationDate: 'desc' }
    })

    // Get donations for each member in the group
    const memberDonationsMap = new Map<string, typeof groupDonations>()

    for (const member of group.members) {
      const memberDonations = await prisma.donation.findMany({
        where: {
          OR: [
            // Explicit override to this member
            { memberId: member.id },
            // No override, sponsor assigned to this member
            {
              memberId: null,
              groupId: null,  // Also no group override
              sponsor: { memberId: member.id }
            }
          ]
        },
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          donationDate: true,
          fiscalYearId: true,
          fiscalYear: { select: { name: true } },
          sponsor: {
            select: {
              id: true,
              company: true,
              phone: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { donationDate: 'desc' }
      })
      memberDonationsMap.set(member.id, memberDonations)
    }

    const response = buildGroupResponse(group, groupDonations, memberDonationsMap, currentFiscalYear, previousFiscalYear?.id ?? null)
    return NextResponse.json(serializeDates(response), {
      headers: {
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'private, max-age=60'
      }
    })
  }

  // Token not found
  return NextResponse.json(
    { error: 'Not found' },
    {
      status: 404,
      headers: {
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'private, max-age=60'
      }
    }
  )
})

interface MemberBasic {
  id: string
  firstName: string
  lastName: string
  memberTargets: { targetAmount: number }[]
  sponsors: SponsorBasic[]
}

interface SponsorBasic {
  id: string
  company: string | null
  phone: string | null
  email: string | null
  firstName: string | null
  lastName: string | null
}

interface DonationWithSponsor {
  id: string
  type: string
  amount: number | null
  description: string | null
  donationDate: Date
  fiscalYearId: string | null
  fiscalYear: { name: string } | null
  sponsor: SponsorBasic
}

interface FiscalYearInfo {
  id: string
  name: string
  startDate: Date
  endDate: Date
}

interface GroupBasic {
  id: string
  name: string
  members: MemberBasic[]
  sponsors: SponsorBasic[]
}

function buildMemberResponse(
  member: MemberBasic,
  donations: DonationWithSponsor[],
  fiscalYear: FiscalYearInfo | null,
  previousFiscalYearId: string | null
) {
  const target = member.memberTargets[0]?.targetAmount ?? 0
  const { actual, sponsors } = calculateSponsorsProgressFromDonations(
    member.sponsors,
    donations,
    fiscalYear?.id ?? null,
    previousFiscalYearId
  )
  const percentage = target > 0 ? Math.round((actual / target) * 100) : 0

  return {
    type: 'member' as const,
    name: getMemberDisplayName(member),
    fiscalYear: fiscalYear ? {
      name: fiscalYear.name,
      startDate: fiscalYear.startDate,
      endDate: fiscalYear.endDate
    } : null,
    progress: {
      target,
      actual,
      percentage
    },
    sponsors
  }
}

function buildGroupResponse(
  group: GroupBasic,
  groupDonations: DonationWithSponsor[],
  memberDonationsMap: Map<string, DonationWithSponsor[]>,
  fiscalYear: FiscalYearInfo | null,
  previousFiscalYearId: string | null
) {
  // Calculate aggregate target from all members
  const aggregateTarget = group.members.reduce((sum, member) => {
    const memberTarget = member.memberTargets[0]?.targetAmount ?? 0
    return sum + memberTarget
  }, 0)

  // Build member data with individual progress and sponsors
  const members = group.members.map(member => {
    const memberTarget = member.memberTargets[0]?.targetAmount ?? 0
    const memberDonations = memberDonationsMap.get(member.id) || []
    const { actual: memberActual, sponsors: memberSponsors } = calculateSponsorsProgressFromDonations(
      member.sponsors,
      memberDonations,
      fiscalYear?.id ?? null,
      previousFiscalYearId
    )
    const memberPercentage = memberTarget > 0 ? Math.round((memberActual / memberTarget) * 100) : 0

    return {
      id: member.id,
      name: getMemberDisplayName(member),
      progress: {
        target: memberTarget,
        actual: memberActual,
        percentage: memberPercentage
      },
      sponsors: memberSponsors
    }
  })

  // Calculate group-level sponsors (those directly assigned to the group)
  const { actual: groupSponsorsActual, sponsors: groupSponsors } = calculateSponsorsProgressFromDonations(
    group.sponsors,
    groupDonations,
    fiscalYear?.id ?? null,
    previousFiscalYearId
  )

  // Aggregate actual = sum of all member donations + group-level donations
  const aggregateActual = members.reduce((sum, member) => sum + member.progress.actual, 0) + groupSponsorsActual

  // Calculate aggregate percentage
  const aggregatePercentage = aggregateTarget > 0 ? Math.round((aggregateActual / aggregateTarget) * 100) : 0

  return {
    type: 'group' as const,
    name: getGroupDisplayName(group),
    fiscalYear: fiscalYear ? {
      name: fiscalYear.name,
      startDate: fiscalYear.startDate,
      endDate: fiscalYear.endDate
    } : null,
    progress: {
      target: aggregateTarget,
      actual: aggregateActual,
      percentage: aggregatePercentage
    },
    members,
    groupSponsors
  }
}

function calculateSponsorsProgressFromDonations(
  sponsors: SponsorBasic[],
  donations: DonationWithSponsor[],
  currentFiscalYearId: string | null,
  previousFiscalYearId: string | null
) {
  let totalActual = 0

  // Group donations by sponsor
  const donationsBySponsor = new Map<string, DonationWithSponsor[]>()
  for (const donation of donations) {
    const sponsorId = donation.sponsor.id
    if (!donationsBySponsor.has(sponsorId)) {
      donationsBySponsor.set(sponsorId, [])
    }
    donationsBySponsor.get(sponsorId)!.push(donation)
  }

  // Build unique sponsors list (from both assigned sponsors and donation sponsors)
  const sponsorMap = new Map<string, SponsorBasic>()
  for (const sponsor of sponsors) {
    sponsorMap.set(sponsor.id, sponsor)
  }
  for (const donation of donations) {
    if (!sponsorMap.has(donation.sponsor.id)) {
      sponsorMap.set(donation.sponsor.id, donation.sponsor)
    }
  }

  const sponsorsList = Array.from(sponsorMap.values()).map(sponsor => {
    const sponsorDonations = donationsBySponsor.get(sponsor.id) || []

    // Filter donations by fiscal year
    const currentYearDonations = sponsorDonations.filter(
      d => d.fiscalYearId === currentFiscalYearId
    )
    const previousYearDonations = sponsorDonations.filter(
      d => d.fiscalYearId === previousFiscalYearId
    )

    // Separate monetary and in-kind donations for current year
    const monetaryDonations = currentYearDonations.filter(d => d.type === 'MONETARY')
    const inKindDonations = currentYearDonations.filter(d => d.type === 'IN_KIND')

    // Calculate totals for current year monetary donations only
    const totalAmount = monetaryDonations.reduce((sum, d) => sum + (d.amount ?? 0), 0)
    const lastDonation = monetaryDonations[0]?.donationDate ?? null
    totalActual += totalAmount

    // LYBUNT detection: donated last year but not this year (any type counts)
    const donatedThisYear = currentYearDonations.length > 0
    const donatedLastYear = previousYearDonations.length > 0
    const isLYBUNT = donatedLastYear && !donatedThisYear

    // Build in-kind donations list
    const inKindList = inKindDonations.map(d => ({
      description: d.description ?? '',
      date: d.donationDate
    }))

    // Build full donation history across all fiscal years (most recent first)
    const history = sponsorDonations
      .map(d => ({
        date: d.donationDate,
        type: d.type,
        amount: d.amount ?? null,
        description: d.description ?? null,
        fiscalYearName: d.fiscalYear?.name ?? ''
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return {
      name: getSponsorDisplayName(sponsor),
      phone: sponsor.phone,
      email: sponsor.email,
      donated: donatedThisYear,
      donatedLastYear,
      isLYBUNT,
      totalAmount,
      lastDonation,
      inKindDonations: inKindList,
      history
    }
  })

  return {
    actual: totalActual,
    sponsors: sponsorsList
  }
}
