import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'

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

  // Delete member - cascading deletes will handle:
  // - Sponsors (onDelete: SetNull - will set memberId to null)
  // - MemberTargets (onDelete: Cascade)
  await prisma.member.delete({
    where: { id: memberId }
  })

  return NextResponse.json({ success: true })
})
