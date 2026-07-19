import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { countOwnedRecords, getClubPool, NoClubPoolError } from '@/lib/club-pool'

/** Reports what a deletion would hand over, so the dialog can say it out loud. */
export const GET = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: groupId } = await params

  try {
    const pool = await getClubPool(prisma)
    const counts = await countOwnedRecords(prisma, { groupId })
    return NextResponse.json({ ...counts, poolName: pool.name })
  } catch (error) {
    if (error instanceof NoClubPoolError) {
      return NextResponse.json({ error: 'noClubPool' }, { status: 400 })
    }
    throw error
  }
})
