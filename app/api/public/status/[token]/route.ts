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
          donations: currentFiscalYear ? {
            where: {
              fiscalYearId: currentFiscalYear.id,
              type: 'MONETARY'
            },
            select: {
              id: true,
              amount: true,
              donationDate: true
            },
            orderBy: { donationDate: 'desc' }
          } : { take: 0 }
        }
      }
    }
  })

  if (member) {
    const response = buildMemberResponse(member, currentFiscalYear)
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
      sponsors: {
        select: {
          id: true,
          company: true,
          firstName: true,
          lastName: true,
          donations: currentFiscalYear ? {
            where: {
              fiscalYearId: currentFiscalYear.id,
              type: 'MONETARY'
            },
            select: {
              id: true,
              amount: true,
              donationDate: true
            },
            orderBy: { donationDate: 'desc' }
          } : { take: 0 }
        }
      }
    }
  })

  if (group) {
    const response = buildGroupResponse(group, currentFiscalYear)
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
  donations: { id: string; amount: number | null; donationDate: Date }[]
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

function buildMemberResponse(member: MemberWithSponsors, fiscalYear: FiscalYearInfo | null) {
  const target = member.memberTargets[0]?.targetAmount ?? 0
  const { actual, sponsors } = calculateSponsorsProgress(member.sponsors)
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

function buildGroupResponse(group: GroupWithSponsors, fiscalYear: FiscalYearInfo | null) {
  // Group target calculation deferred to Phase 4 (aggregate of member targets)
  const target = 0
  const { actual, sponsors } = calculateSponsorsProgress(group.sponsors)
  const percentage = 0 // No target yet

  return {
    type: 'group' as const,
    name: getGroupDisplayName(group),
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

function calculateSponsorsProgress(sponsors: SponsorWithDonations[]) {
  let totalActual = 0
  const sponsorsList = sponsors.map(sponsor => {
    const totalAmount = sponsor.donations.reduce((sum, d) => sum + (d.amount ?? 0), 0)
    const lastDonation = sponsor.donations[0]?.donationDate ?? null
    totalActual += totalAmount

    return {
      name: getSponsorDisplayName(sponsor),
      donated: sponsor.donations.length > 0,
      totalAmount,
      lastDonation
    }
  })

  return {
    actual: totalActual,
    sponsors: sponsorsList
  }
}
