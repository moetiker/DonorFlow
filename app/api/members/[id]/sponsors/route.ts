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

    const sponsors = await prisma.sponsor.findMany({
      where: {
        memberId: memberId
      },
      orderBy: {
        lastName: 'asc'
      }
    })

    // Serialize dates
    const serializedSponsors = sponsors.map(sponsor => ({
      ...sponsor,
      createdAt: sponsor.createdAt.toISOString(),
      updatedAt: sponsor.updatedAt.toISOString()
    }))

    return NextResponse.json(serializedSponsors)
  } catch (error) {
    console.error('Error fetching member sponsors:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
