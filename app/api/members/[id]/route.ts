import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { reassignToClubPool, NoClubPoolError } from '@/lib/club-pool'
import {
  DissolvedGroupError, isGroupDissolved, moveMemberSponsorsToGroup
} from '@/lib/sponsor-assignments'
import {
  updateMemberSchema, memberEmailSchema, validateRequestI18n, getLocaleFromRequest
} from '@/lib/validation'

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

  const current = await prisma.member.findUnique({
    where: { id: memberId },
    select: { groupId: true, email: true }
  })
  if (!current) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // The email format is only checked when the email changes: members stored
  // with an empty or malformed address (e.g. from an import) stay saveable.
  if (email && email !== current.email) {
    const emailValidation = await validateRequestI18n(memberEmailSchema, { email }, locale)
    if (!emailValidation.success) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 })
    }
  }

  // The group the member joins, if any (null when staying, leaving or ungrouped)
  const joinedGroupId = newGroupId !== null && newGroupId !== current.groupId ? newGroupId : null

  let updatedMember
  try {
    updatedMember = await prisma.$transaction(async (tx) => {
      // Checked inside the transaction so a concurrent dissolve cannot slip in
      if (joinedGroupId && (await isGroupDissolved(tx, joinedGroupId))) {
        throw new DissolvedGroupError()
      }

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
      if (joinedGroupId && moveSponsorsToGroup === true) {
        await moveMemberSponsorsToGroup(tx, memberId, joinedGroupId)
      }

      return member
    })
  } catch (error) {
    if (error instanceof DissolvedGroupError) {
      return NextResponse.json({ error: 'groupDissolved' }, { status: 400 })
    }
    throw error
  }

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
