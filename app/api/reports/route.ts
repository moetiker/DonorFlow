import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { memberFigures, groupFigures, unassignedFigures } from '@/lib/report-figures'

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
      return NextResponse.json({ currentYear: null })
    }

    // Members WITHOUT group membership (MONETARY donations credited to them)
    const members = await prisma.member.findMany({
      where: {
        groupId: null
      },
      include: {
        memberTargets: {
          where: {
            fiscalYearId: currentYear.id
          }
        }
      }
    })

    const memberStats = (await Promise.all(members.map(async member => {
      const { actual, donationCount } = await memberFigures(prisma, member.id, currentYear.id, 'MONETARY')

      // Get target if exists
      const target = member.memberTargets[0]?.targetAmount || 0
      const percentage = target > 0 ? (actual / target) * 100 : 100

      return {
        member: {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName
        },
        target,
        actual,
        difference: actual - target,
        percentage,
        donationCount
      }
    }))).filter(stat => stat.actual > 0 || stat.target > 0) // Only show members with donations or targets

    // Sort by percentage descending
    memberStats.sort((a, b) => b.percentage - a.percentage)

    // Groups, including dissolved ones: a dissolved group still shows the
    // donations credited to it in that year (it has no members, so no target).
    const groups = await prisma.group.findMany({
      include: {
        members: true
      }
    })

    // Group total = donations credited to the group and to its current members (MONETARY only)
    const groupStatsPromises = groups.map(async group => {
      const { actual, donationCount } = await groupFigures(prisma, group.id, currentYear.id, 'MONETARY')
      const memberCount = group.members.length

      // Get targets for all members in this group
      const memberTargets = await prisma.memberTarget.findMany({
        where: {
          fiscalYearId: currentYear.id,
          memberId: {
            in: group.members.map(m => m.id)
          }
        }
      })

      const target = memberTargets.reduce((sum, mt) => sum + mt.targetAmount, 0)
      const difference = actual - target
      const percentage = target > 0 ? (actual / target) * 100 : 100

      return {
        group: {
          id: group.id,
          name: group.name
        },
        dissolved: group.dissolvedAt !== null,
        target,
        actual,
        difference,
        percentage,
        memberCount,
        donationCount,
        members: group.members.map(m => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName
        }))
      }
    })

    const groupStats = (await Promise.all(groupStatsPromises))
      .filter(stat => stat.actual > 0 || stat.target > 0) // Only groups with donations or targets
      .sort((a, b) => b.percentage - a.percentage) // Sort by percentage descending

    // Donations without a recipient (safety bucket, MONETARY only)
    const unassigned = await unassignedFigures(prisma, currentYear.id, 'MONETARY')
    const unassignedTotal = unassigned.actual

    // Get ALL in-kind donations for current fiscal year
    const inKindDonations = await prisma.donation.findMany({
      where: {
        fiscalYearId: currentYear.id,
        type: 'IN_KIND'
      },
      include: {
        sponsor: {
          select: {
            id: true,
            company: true,
            firstName: true,
            lastName: true
          }
        },
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        group: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        donationDate: 'desc'
      }
    })

    // Format in-kind donations for response; "assigned to" is the donation's own recipient
    const formattedInKindDonations = inKindDonations.map(d => ({
      id: d.id,
      description: d.description || '',
      donationDate: d.donationDate,
      sponsorName: d.sponsor.company || `${d.sponsor.firstName || ''} ${d.sponsor.lastName || ''}`.trim(),
      assignedTo: d.member
        ? { type: 'member' as const, name: `${d.member.firstName} ${d.member.lastName}` }
        : d.group
          ? { type: 'group' as const, name: d.group.name }
          : null
    }))

    // Get ALL member targets (including those in groups) for total target calculation
    const allMemberTargets = await prisma.memberTarget.findMany({
      where: {
        fiscalYearId: currentYear.id
      }
    })

    const totalTarget = allMemberTargets.reduce((sum, mt) => sum + mt.targetAmount, 0)
    const memberActual = memberStats.reduce((sum, s) => sum + s.actual, 0)
    const groupActual = groupStats.reduce((sum, s) => sum + s.actual, 0)
    const totalActual = memberActual + groupActual + unassignedTotal
    const overallPercentage = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0

    return NextResponse.json({
      currentYear: {
        id: currentYear.id,
        name: currentYear.name,
        startDate: currentYear.startDate,
        endDate: currentYear.endDate
      },
      allYears: allYears.map(y => ({
        id: y.id,
        name: y.name,
        startDate: y.startDate,
        endDate: y.endDate
      })),
      memberStats,
      groupStats,
      unassignedTotal,
      unassignedCount: unassigned.donationCount,
      totalTarget,
      totalActual,
      memberActual,
      groupActual,
      overallPercentage,
      inKindDonations: formattedInKindDonations
    })
})
