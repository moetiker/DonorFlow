import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'

export const GET = withApiRoute(async () => {
  const now = new Date()

  const currentYear = await prisma.fiscalYear.findFirst({
    where: {
      startDate: { lte: now },
      endDate: { gte: now }
    }
  })

  if (!currentYear) {
    return NextResponse.json({
      currentYear: null,
      inKindCount: 0,
      memberStats: [],
      groupStats: [],
      unassignedCount: 0,
      unassignedDonations: []
    })
  }

  // Get members with in-kind donations (members WITHOUT group membership)
  const members = await prisma.member.findMany({
    where: { groupId: null },
    include: {
      sponsors: {
        include: {
          donations: {
            where: {
              type: 'IN_KIND',
              fiscalYearId: currentYear.id
            }
          }
        }
      }
    }
  })

  const memberStats = members
    .map(member => {
      const donations = member.sponsors.flatMap(s => s.donations)
      return {
        member: {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName
        },
        count: donations.length,
        donations: donations.map(d => ({
          id: d.id,
          description: d.description,
          donationDate: d.donationDate,
          note: d.note
        }))
      }
    })
    .filter(stat => stat.count > 0)
    .sort((a, b) => b.count - a.count)

  // Get groups with in-kind donations
  const groups = await prisma.group.findMany({
    include: {
      sponsors: {
        include: {
          donations: {
            where: {
              type: 'IN_KIND',
              fiscalYearId: currentYear.id
            }
          }
        }
      },
      members: true
    }
  })

  const groupStats = groups
    .map(group => {
      const donations = group.sponsors.flatMap(s => s.donations)
      return {
        group: {
          id: group.id,
          name: group.name
        },
        count: donations.length,
        memberCount: group.members.length,
        donations: donations.map(d => ({
          id: d.id,
          description: d.description,
          donationDate: d.donationDate,
          note: d.note
        }))
      }
    })
    .filter(stat => stat.count > 0)
    .sort((a, b) => b.count - a.count)

  // Get unassigned in-kind donations
  const unassignedSponsors = await prisma.sponsor.findMany({
    where: {
      memberId: null,
      groupId: null
    },
    include: {
      donations: {
        where: {
          type: 'IN_KIND',
          fiscalYearId: currentYear.id
        }
      }
    }
  })

  const unassignedDonations = unassignedSponsors.flatMap(s => s.donations)

  return NextResponse.json(serializeDates({
    currentYear: {
      id: currentYear.id,
      name: currentYear.name,
      startDate: currentYear.startDate,
      endDate: currentYear.endDate
    },
    inKindCount: memberStats.reduce((sum, s) => sum + s.count, 0) +
                 groupStats.reduce((sum, s) => sum + s.count, 0) +
                 unassignedDonations.length,
    memberStats,
    groupStats,
    unassignedCount: unassignedDonations.length,
    unassignedDonations: unassignedDonations.map(d => ({
      id: d.id,
      description: d.description,
      donationDate: d.donationDate,
      note: d.note
    }))
  }))
})
