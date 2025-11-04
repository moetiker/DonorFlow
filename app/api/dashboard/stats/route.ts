import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    console.log('🔍 Current date for fiscal year query:', now.toISOString())

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

    console.log('📅 Found fiscal year:', currentYear ? `${currentYear.name} (${currentYear.startDate} - ${currentYear.endDate})` : 'None')

    let donationCount = 0
    let donationSum = 0
    let totalTarget = 0
    let totalActual = 0
    let memberActual = 0
    let groupActual = 0
    let unassignedTotal = 0

    if (currentYear) {
      const donations = await prisma.donation.findMany({
        where: {
          donationDate: {
            gte: currentYear.startDate,
            lte: currentYear.endDate
          }
        }
      })
      donationCount = donations.length
      donationSum = donations.reduce((sum, d) => sum + d.amount, 0)

      // Get performance report data
      // Get ALL member targets for total target
      const allMemberTargets = await prisma.memberTarget.findMany({
        where: {
          fiscalYearId: currentYear.id
        }
      })
      totalTarget = allMemberTargets.reduce((sum, mt) => sum + mt.targetAmount, 0)

      // Get members WITHOUT group membership
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
          }
        }
      })

      // Calculate member donations
      memberActual = members.reduce((sum, member) => {
        const donations = member.sponsors.flatMap(sponsor => sponsor.donations)
        return sum + donations.reduce((dSum, d) => dSum + d.amount, 0)
      }, 0)

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
          }
        }
      })

      groupActual = groups.reduce((sum, group) => {
        const donations = group.sponsors.flatMap(sponsor => sponsor.donations)
        return sum + donations.reduce((dSum, d) => dSum + d.amount, 0)
      }, 0)

      // Get unassigned donations
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

      unassignedTotal = unassignedSponsors.reduce((sum, sponsor) => {
        return sum + sponsor.donations.reduce((dSum, d) => dSum + d.amount, 0)
      }, 0)

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

    console.log('📊 Dashboard stats response:', JSON.stringify(response, null, 2))

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
