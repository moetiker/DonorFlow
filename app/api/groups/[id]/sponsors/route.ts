import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { sponsorsAssignedTo } from '@/lib/crediting'

export const GET = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: groupId } = await params

  const sponsors = await prisma.sponsor.findMany({
    where: sponsorsAssignedTo({ groupId }),
    orderBy: { lastName: 'asc' }
  })

  return NextResponse.json(serializeDates(sponsors))
})
