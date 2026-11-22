import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { donationsCreditedTo, donationsCreditedToGroupTotal } from '@/lib/crediting'
import { donationsWithoutRecipient, inFiscalYear } from '@/lib/report-figures'

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

  const inKind = (where: Prisma.DonationWhereInput) =>
    prisma.donation.findMany({
      where: inFiscalYear(where, currentYear.id, 'IN_KIND'),
      select: { id: true, description: true, donationDate: true, note: true }
    })

  // In-kind donations credited to members WITHOUT group membership
  const members = await prisma.member.findMany({ where: { groupId: null } })

  const memberStats = (await Promise.all(members.map(async member => {
    const donations = await inKind(donationsCreditedTo({ memberId: member.id }))
    return {
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName
      },
      count: donations.length,
      donations
    }
  })))
    .filter(stat => stat.count > 0)
    .sort((a, b) => b.count - a.count)

  // In-kind donations credited to groups (not dissolved) and their members
  const groups = await prisma.group.findMany({
    where: { dissolvedAt: null },
    include: { members: true }
  })

  const groupStats = (await Promise.all(groups.map(async group => {
    const donations = await inKind(
      donationsCreditedToGroupTotal(group.id, group.members.map(m => m.id))
    )
    return {
      group: {
        id: group.id,
        name: group.name
      },
      count: donations.length,
      memberCount: group.members.length,
      donations
    }
  })))
    .filter(stat => stat.count > 0)
    .sort((a, b) => b.count - a.count)

  // In-kind donations without a recipient
  const unassignedDonations = await inKind(donationsWithoutRecipient)

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
    unassignedDonations
  }))
})
