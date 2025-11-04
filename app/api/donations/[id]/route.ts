import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'

export const DELETE = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: donationId } = await params

  // Delete donation
  await prisma.donation.delete({
    where: { id: donationId }
  })

  return NextResponse.json({ success: true })
})
