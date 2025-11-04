import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'

export const GET = withApiRoute(async () => {

    const currentYear = await prisma.fiscalYear.findFirst({
      where: {
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      }
    })

    if (!currentYear) {
      return NextResponse.json({ currentYear: null })
    }

    // Get only members WITHOUT group membership
    const members = await prisma.member.findMany({
      where: {
        groupId: null
      },
      include: {
        sponsors: {
          include: {
            donations: {
              where: {
                fiscalYearId: currentYear.id
              }
            }
          }
        },
        memberTargets: {
          where: {
            fiscalYearId: currentYear.id
          }
        }
      }
    })

    // Calculate stats for each member (individual donations only)
    const memberStats = members.map(member => {
      // Get all donations from this member's direct sponsors
      const donations = member.sponsors.flatMap(sponsor => sponsor.donations)
      const actual = donations.reduce((sum, d) => sum + d.amount, 0)

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
        donationCount: donations.length
      }
    }).filter(stat => stat.actual > 0 || stat.target > 0) // Only show members with donations or targets

    // Sort by percentage descending
    memberStats.sort((a, b) => b.percentage - a.percentage)

    // Get group donations
    const groups = await prisma.group.findMany({
      include: {
        sponsors: {
          include: {
            donations: {
              where: {
                fiscalYearId: currentYear.id
              }
            }
          }
        },
        members: true
      }
    })

    // Get group stats with targets
    const groupStatsPromises = groups.map(async group => {
      const donations = group.sponsors.flatMap(sponsor => sponsor.donations)
      const actual = donations.reduce((sum, d) => sum + d.amount, 0)
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
        target,
        actual,
        difference,
        percentage,
        memberCount,
        donationCount: donations.length,
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

    // Get unassigned donations (sponsors with no member and no group)
    const unassignedSponsors = await prisma.sponsor.findMany({
      where: {
        memberId: null,
        groupId: null
      },
      include: {
        donations: {
          where: {
            fiscalYearId: currentYear.id
          }
        }
      }
    })

    const unassignedDonations = unassignedSponsors.flatMap(s => s.donations)
    const unassignedTotal = unassignedDonations.reduce((sum, d) => sum + d.amount, 0)

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
      memberStats,
      groupStats,
      unassignedTotal,
      unassignedCount: unassignedDonations.length,
      totalTarget,
      totalActual,
      memberActual,
      groupActual,
      overallPercentage
    })
})
