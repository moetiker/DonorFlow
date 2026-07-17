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
      // Sponsors and donations belong to the club, not to the member who looked
      // after them. Hand them over before deleting, otherwise SetNull orphans
      // them and they vanish from every status page and every total.
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
