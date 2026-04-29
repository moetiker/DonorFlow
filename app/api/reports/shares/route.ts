import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
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

    // Get all members with their MONETARY donations and group info
    const members = await prisma.member.findMany({
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
        },
        group: {
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
            },
            members: true
          }
        }
      }
    })

    // Calculate shares for each member (MONETARY donations only)
    const memberShares = members.map(member => {
      let amount = 0

      // Add direct donations from member's sponsors
      amount += member.sponsors.reduce((sum, sponsor) => {
        return sum + sponsor.donations.reduce((dSum, d) => dSum + (d.amount || 0), 0)
      }, 0)

      // If member is in a group, add linear share of group donations
      if (member.group) {
        const groupDonations = member.group.sponsors.reduce((sum, sponsor) => {
          return sum + sponsor.donations.reduce((dSum, d) => dSum + (d.amount || 0), 0)
        }, 0)
        const memberCount = member.group.members.length
        if (memberCount > 0) {
          amount += groupDonations / memberCount
        }
      }

      return {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        type: 'member' as const,
        amount: amount,
        groupName: member.group?.name
      }
    }).filter(share => share.amount > 0)

    // Get unassigned MONETARY donations
    const unassignedDonations = await prisma.donation.findMany({
      where: {
        fiscalYearId: currentYear.id,
        type: 'MONETARY',
        sponsor: {
          memberId: null,
          groupId: null
        }
      }
    })

    const unassignedTotal = unassignedDonations.reduce((sum, d) => sum + (d.amount || 0), 0)

    if (unassignedTotal > 0) {
      memberShares.push({
        id: 'unassigned',
        name: 'Unassigned',
        type: 'member' as const,
        amount: unassignedTotal,
        groupName: undefined
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
  } catch (error) {
    console.error('Error fetching shares:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shares data' },
      { status: 500 }
    )
  }
}
