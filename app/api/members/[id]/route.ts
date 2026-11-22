import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { reassignToClubPool, NoClubPoolError } from '@/lib/club-pool'

export const PUT = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { firstName, lastName, email, phone, groupId } = await request.json()
  const { id: memberId } = await params

  // Update member with group assignment and contact info
  const updatedMember = await prisma.member.update({
    where: { id: memberId },
    data: {
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      groupId: groupId || null // Empty string or null = no group
    }
  })

  return NextResponse.json(serializeDates(updatedMember))
})

export const DELETE = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: memberId } = await params

  try {
    await prisma.$transaction(async (tx) => {
      // Re-credit the member's donations and hand sponsors left without a
      // recipient to the club pool before deleting (see lib/club-pool.ts).
      await reassignToClubPool(tx, { memberId })

      // MemberTargets are removed by onDelete: Cascade.
      await tx.member.delete({ where: { id: memberId } })
    })
  } catch (error) {
    if (error instanceof NoClubPoolError) {
      return NextResponse.json({ error: 'noClubPool' }, { status: 400 })
    }
    throw error
  }

  return NextResponse.json({ success: true })
})
