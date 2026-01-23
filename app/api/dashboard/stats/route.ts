import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'

// Helper to calculate donation totals from entities with sponsors
type EntityWithSponsorDonations = {
  sponsors: Array<{ donations: Array<{ amount: number | null }> }>
}

function calculateDonationTotal(entities: EntityWithSponsorDonations[]): number {
  return entities.reduce((sum, entity) => {
    const donations = entity.sponsors.flatMap(sponsor => sponsor.donations)
    return sum + donations.reduce((dSum, d) => dSum + (d.amount || 0), 0)
  }, 0)
}

// Helper for sponsors without nested sponsors structure
type SponsorWithDonations = {
  donations: Array<{ amount: number | null }>
}

function calculateSponsorDonationTotal(sponsors: SponsorWithDonations[]): number {
  return sponsors.reduce((sum, sponsor) => {
    return sum + sponsor.donations.reduce((dSum, d) => dSum + (d.amount || 0), 0)
  }, 0)
}

export const GET = withApiRoute(async (_request: NextRequest) => {
  const now = new Date()

  const [memberCount, groupCount, sponsorCount, currentYear] = await Promise.all([
    prisma.member.count(),
    prisma.group.count(),
    prisma.sponsor.count(),
    prisma.fiscalYear.findFirst({
      where: {
        startDate: { lte: now },
        endDate: { gte: now }
      },
      orderBy: { startDate: 'desc' }
    })
  ])

  let donationCount = 0
  let donationSum = 0
  let totalTarget = 0
  let totalActual = 0
  let memberActual = 0
  let groupActual = 0
  let unassignedTotal = 0

  if (currentYear) {
    // Only count MONETARY donations for statistics
    const donations = await prisma.donation.findMany({
      where: {
        type: 'MONETARY',
        donationDate: {
          gte: currentYear.startDate,
          lte: currentYear.endDate
        }
      }
    })
    donationCount = donations.length
    donationSum = donations.reduce((sum, d) => sum + (d.amount || 0), 0)

    // Get ALL member targets for total target
    const allMemberTargets = await prisma.memberTarget.findMany({
      where: { fiscalYearId: currentYear.id }
    })
    totalTarget = allMemberTargets.reduce((sum, mt) => sum + mt.targetAmount, 0)

    // Get members WITHOUT group membership (MONETARY donations only)
    const members = await prisma.member.findMany({
      where: { groupId: null },
      include: {
        sponsors: {
          include: {
            donations: {
              where: {
                fiscalYearId: currentYear.id,
                type: 'MONETARY'
              }
            }
          }
        }
      }
    })
    memberActual = calculateDonationTotal(members)

    // Get group donations (MONETARY only)
    const groups = await prisma.group.findMany({
      include: {
        sponsors: {
          include: {
            donations: {
              where: {
                fiscalYearId: currentYear.id,
                type: 'MONETARY'
              }
            }
          }
        }
      }
    })
    groupActual = calculateDonationTotal(groups)

    // Get unassigned donations (MONETARY only)
    const unassignedSponsors = await prisma.sponsor.findMany({
      where: {
        memberId: null,
        groupId: null
      },
      include: {
        donations: {
          where: {
            fiscalYearId: currentYear.id,
            type: 'MONETARY'
          }
        }
      }
    })
    unassignedTotal = calculateSponsorDonationTotal(unassignedSponsors)

    totalActual = memberActual + groupActual + unassignedTotal
  }

  const response = {
    memberCount,
    groupCount,
    sponsorCount,
    donationCount,
    donationSum,
    currentYear,
    performance: {
      totalTarget,
      totalActual,
      memberActual,
      groupActual,
      unassignedTotal,
      difference: totalActual - totalTarget,
      percentage: totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0
    }
  }

  return NextResponse.json(serializeDates(response))
})
