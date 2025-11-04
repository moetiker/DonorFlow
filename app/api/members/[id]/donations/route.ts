import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: memberId } = await params

    // Get all donations from sponsors assigned to this member
    const donations = await prisma.donation.findMany({
      where: {
        sponsor: {
          memberId: memberId
        }
      },
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
    console.error('Error fetching member donations:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
