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

  // Get previous fiscal year (most recent one BEFORE current fiscal year)
  const previousFiscalYear = currentFiscalYear
    ? await prisma.fiscalYear.findFirst({
        where: {
          endDate: { lt: currentFiscalYear.startDate }
        },
        orderBy: {
          endDate: 'desc'
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
          firstName: true,
          lastName: true,
          donations: {
            where: {
              fiscalYearId: {
                in: [
                  currentFiscalYear?.id,
                  previousFiscalYear?.id
                ].filter((id): id is string => id !== undefined && id !== null)
              }
            },
            select: {
              id: true,
              type: true,
              amount: true,
              description: true,
              donationDate: true,
              fiscalYearId: true
            },
            orderBy: { donationDate: 'desc' }
          }
        }
      }
    }
  })

  if (member) {
    const response = buildMemberResponse(member, currentFiscalYear, previousFiscalYear?.id ?? null)
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
              firstName: true,
              lastName: true,
              donations: {
                where: {
                  fiscalYearId: {
                    in: [
                      currentFiscalYear?.id,
                      previousFiscalYear?.id
                    ].filter((id): id is string => id !== undefined && id !== null)
                  }
                },
                select: {
                  id: true,
                  type: true,
                  amount: true,
                  description: true,
                  donationDate: true,
                  fiscalYearId: true
                },
                orderBy: { donationDate: 'desc' }
              }
            }
          }
        }
      },
      sponsors: {
        select: {
          id: true,
          company: true,
          firstName: true,
          lastName: true,
          donations: {
            where: {
              fiscalYearId: {
                in: [
                  currentFiscalYear?.id,
                  previousFiscalYear?.id
                ].filter((id): id is string => id !== undefined && id !== null)
              }
            },
            select: {
              id: true,
              type: true,
              amount: true,
              description: true,
              donationDate: true,
              fiscalYearId: true
            },
            orderBy: { donationDate: 'desc' }
          }
        }
      }
    }
  })

  if (group) {
    const response = buildGroupResponse(group, currentFiscalYear, previousFiscalYear?.id ?? null)
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

interface MemberWithSponsors {
  id: string
  firstName: string
  lastName: string
  memberTargets: { targetAmount: number }[]
  sponsors: SponsorWithDonations[]
}

interface SponsorWithDonations {
  id: string
  company: string | null
  firstName: string | null
  lastName: string | null
  donations: { id: string; type: string; amount: number | null; description: string | null; donationDate: Date; fiscalYearId: string | null }[]
}

interface FiscalYearInfo {
  id: string
  name: string
  startDate: Date
  endDate: Date
}

interface GroupWithSponsors {
  id: string
  name: string
  sponsors: SponsorWithDonations[]
}

interface GroupWithMembersAndSponsors {
  id: string
  name: string
  members: MemberWithSponsors[]
  sponsors: SponsorWithDonations[]
}

function buildMemberResponse(member: MemberWithSponsors, fiscalYear: FiscalYearInfo | null, previousFiscalYearId: string | null) {
  const target = member.memberTargets[0]?.targetAmount ?? 0
  const { actual, sponsors } = calculateSponsorsProgress(member.sponsors, fiscalYear?.id ?? null, previousFiscalYearId)
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

function buildGroupResponse(group: GroupWithMembersAndSponsors, fiscalYear: FiscalYearInfo | null, previousFiscalYearId: string | null) {
  // Calculate aggregate target from all members
  const aggregateTarget = group.members.reduce((sum, member) => {
    const memberTarget = member.memberTargets[0]?.targetAmount ?? 0
    return sum + memberTarget
  }, 0)

  // Build member data with individual progress and sponsors
  const members = group.members.map(member => {
    const memberTarget = member.memberTargets[0]?.targetAmount ?? 0
    const { actual: memberActual, sponsors: memberSponsors } = calculateSponsorsProgress(
      member.sponsors,
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
  const { actual: groupSponsorsActual, sponsors: groupSponsors } = calculateSponsorsProgress(
    group.sponsors,
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

function calculateSponsorsProgress(
  sponsors: SponsorWithDonations[],
  currentFiscalYearId: string | null,
  previousFiscalYearId: string | null
) {
  let totalActual = 0
  const sponsorsList = sponsors.map(sponsor => {
    // Filter donations by fiscal year
    const currentYearDonations = sponsor.donations.filter(
      d => d.fiscalYearId === currentFiscalYearId
    )
    const previousYearDonations = sponsor.donations.filter(
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

    return {
      name: getSponsorDisplayName(sponsor),
      donated: donatedThisYear,
      donatedLastYear,
      isLYBUNT,
      totalAmount,
      lastDonation,
      inKindDonations: inKindList
    }
  })

  return {
    actual: totalActual,
    sponsors: sponsorsList
  }
}
