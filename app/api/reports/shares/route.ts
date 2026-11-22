import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { donationsCreditedTo } from '@/lib/crediting'
import { inFiscalYear, memberActual, unassignedActual } from '@/lib/report-figures'

export const GET = withApiRoute(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')

    // Get selected fiscal year or fall back to current
    let selectedYear
    if (yearParam) {
      selectedYear = await prisma.fiscalYear.findUnique({
        where: { id: yearParam }
      })
    }

    if (!selectedYear) {
      selectedYear = await prisma.fiscalYear.findFirst({
        where: {
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        }
      })
    }

    // Get all fiscal years for the dropdown
    const allYears = await prisma.fiscalYear.findMany({
      orderBy: { startDate: 'desc' }
    })

    const currentYear = selectedYear

    if (!currentYear) {
      return NextResponse.json({
        error: 'No active fiscal year found',
        shares: []
      })
    }

    // Each member's share = MONETARY donations credited to the member plus a
    // linear share of the donations credited to the member's group itself.
    const members = await prisma.member.findMany({
      include: {
        group: {
          include: {
            members: { select: { id: true } }
          }
        }
      }
    })

    // Donations credited to each group itself (MONETARY), keyed by group id
    const groups = await prisma.group.findMany({ include: { members: { select: { id: true } } } })
    const groupOwnTotals = new Map<string, number>()
    for (const group of groups) {
      const where = inFiscalYear(donationsCreditedTo({ groupId: group.id }), currentYear.id, 'MONETARY')
      const agg = await prisma.donation.aggregate({ where, _sum: { amount: true } })
      groupOwnTotals.set(group.id, agg._sum.amount ?? 0)
    }

    const memberShares = (await Promise.all(members.map(async member => {
      let amount = await memberActual(prisma, member.id, currentYear.id, 'MONETARY')

      // If member is in a group, add linear share of group donations
      if (member.group) {
        const groupDonations = groupOwnTotals.get(member.group.id) ?? 0
        const memberCount = member.group.members.length
        if (memberCount > 0) {
          amount += groupDonations / memberCount
        }
      }

      return {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        type: 'member' as 'member' | 'group',
        amount: amount,
        groupName: member.group?.name,
        dissolved: false
      }
    }))).filter(share => share.amount > 0)

    // Groups without members (e.g. dissolved ones) cannot pass their donations
    // on to members; list them on their own so the total stays complete.
    for (const group of groups) {
      const amount = groupOwnTotals.get(group.id) ?? 0
      if (group.members.length === 0 && amount > 0) {
        memberShares.push({
          id: group.id,
          name: group.name,
          type: 'group',
          amount,
          groupName: undefined,
          dissolved: group.dissolvedAt !== null
        })
      }
    }

    // Donations without a recipient (MONETARY)
    const unassignedTotal = await unassignedActual(prisma, currentYear.id, 'MONETARY')

    if (unassignedTotal > 0) {
      memberShares.push({
        id: 'unassigned',
        name: 'Unassigned',
        type: 'member',
        amount: unassignedTotal,
        groupName: undefined,
        dissolved: false
      })
    }

    // Calculate total
    const total = memberShares.reduce((sum, share) => sum + share.amount, 0)

    // Calculate percentages
    const sharesWithPercentage = memberShares.map(share => ({
      ...share,
      percentage: total > 0 ? (share.amount / total) * 100 : 0
    }))

    // Sort by amount descending
    sharesWithPercentage.sort((a, b) => b.amount - a.amount)

    return NextResponse.json({
      shares: sharesWithPercentage,
      total,
      fiscalYear: {
        id: currentYear.id,
        name: currentYear.name
      },
      allYears: allYears.map(y => ({
        id: y.id,
        name: y.name
      }))
    })
})
