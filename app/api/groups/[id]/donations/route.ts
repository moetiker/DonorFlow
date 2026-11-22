import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { groupTotalWhere } from '@/lib/report-figures'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: groupId } = await params
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')

    // The group's total: donations credited to the group and to its current members
    const credited = await groupTotalWhere(prisma, groupId)
    const whereClause: Prisma.DonationWhereInput = yearParam
      ? { AND: [credited, { fiscalYearId: yearParam }] }
      : credited

    const donations = await prisma.donation.findMany({
      where: whereClause,
      include: {
        sponsor: true
      },
      orderBy: {
        donationDate: 'desc'
      }
    })

    // Serialize dates
    const serializedDonations = donations.map(donation => ({
      ...donation,
      donationDate: donation.donationDate.toISOString(),
      createdAt: donation.createdAt.toISOString(),
      updatedAt: donation.updatedAt.toISOString(),
      sponsor: {
        ...donation.sponsor,
        createdAt: donation.sponsor.createdAt.toISOString(),
        updatedAt: donation.sponsor.updatedAt.toISOString()
      }
    }))

    return NextResponse.json(serializedDonations)
  } catch (error) {
    console.error('Error fetching group donations:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
