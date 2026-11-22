import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import {
  memberActual as memberActualFor,
  groupActual as groupActualFor,
  unassignedActual
} from '@/lib/report-figures'

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0)

export const GET = withApiRoute(async (_request: NextRequest) => {
  const now = new Date()

  const [memberCount, groupCount, sponsorCount, currentYear] = await Promise.all([
    prisma.member.count(),
    prisma.group.count({ where: { dissolvedAt: null } }),
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

    // Members WITHOUT group membership: MONETARY donations credited to them
    const fiscalYearId = currentYear.id
    const members = await prisma.member.findMany({
      where: { groupId: null },
      select: { id: true }
    })
    memberActual = sum(await Promise.all(
      members.map(m => memberActualFor(prisma, m.id, fiscalYearId, 'MONETARY'))
    ))

    // Groups (not dissolved): donations credited to the group and its members
    const groups = await prisma.group.findMany({
      where: { dissolvedAt: null },
      select: { id: true }
    })
    groupActual = sum(await Promise.all(
      groups.map(g => groupActualFor(prisma, g.id, fiscalYearId, 'MONETARY'))
    ))

    // Donations without a recipient (MONETARY only)
    unassignedTotal = await unassignedActual(prisma, fiscalYearId, 'MONETARY')

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
