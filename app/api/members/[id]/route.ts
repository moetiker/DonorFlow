import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { reassignToClubPool, NoClubPoolError } from '@/lib/club-pool'
import { isGroupDissolved, moveMemberSponsorsToGroup } from '@/lib/sponsor-assignments'
import { updateMemberSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'

export const PUT = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const body = await request.json()
  const { id: memberId } = await params

  const locale = getLocaleFromRequest(request)
  const validation = await validateRequestI18n(updateMemberSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { firstName, lastName, email, phone, groupId, moveSponsorsToGroup } = validation.data
  const newGroupId = groupId || null // Empty string or null = no group

  const current = await prisma.member.findUnique({ where: { id: memberId }, select: { groupId: true } })
  if (!current) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  if (newGroupId && newGroupId !== current.groupId && (await isGroupDissolved(prisma, newGroupId))) {
    return NextResponse.json({ error: 'groupDissolved' }, { status: 400 })
  }

  const updatedMember = await prisma.$transaction(async (tx) => {
    const member = await tx.member.update({
      where: { id: memberId },
      data: {
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        groupId: newGroupId
      }
    })

    // Joining a group may take the member's sponsors along (spec "Joining a
    // group"). Leaving or switching groups never moves the group's sponsors.
    if (newGroupId && newGroupId !== current.groupId && moveSponsorsToGroup === true) {
      await moveMemberSponsorsToGroup(tx, memberId, newGroupId)
    }

    return member
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
