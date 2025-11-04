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

    const { id: sponsorId } = await params

    const donations = await prisma.donation.findMany({
      where: { sponsorId },
      orderBy: { donationDate: 'desc' }
    })

    // Convert dates to ISO strings
    const serializedDonations = donations.map(donation => ({
      ...donation,
      donationDate: donation.donationDate.toISOString()
    }))

    return NextResponse.json(serializedDonations)
  } catch (error) {
    console.error('Error fetching sponsor donations:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
