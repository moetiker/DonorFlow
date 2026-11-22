import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { dissolveGroupSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'
import { NoClubPoolError, ClubPoolLockedError } from '@/lib/club-pool'
import {
  dissolveGroup,
  GroupAlreadyDissolvedError,
  NotAGroupMemberError
} from '@/lib/sponsor-assignments'

/**
 * Dissolves a group: hands its sponsors to the chosen members (or the club
 * pool), removes its members and marks it dissolved. Its donations stay
 * credited to it.
 */
export const POST = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const body = await request.json()
  const { id: groupId } = await params

  const locale = getLocaleFromRequest(request)
  const validation = await validateRequestI18n(dissolveGroupSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const exists = await prisma.group.count({ where: { id: groupId } })
  if (exists === 0) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  try {
    const result = await prisma.$transaction(tx =>
      dissolveGroup(tx, groupId, validation.data.assignments)
    )
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ClubPoolLockedError) {
      return NextResponse.json({ error: 'clubPoolLocked' }, { status: 400 })
    }
    if (error instanceof GroupAlreadyDissolvedError) {
      return NextResponse.json({ error: 'groupAlreadyDissolved' }, { status: 400 })
    }
    if (error instanceof NotAGroupMemberError) {
      return NextResponse.json({ error: 'notAGroupMember' }, { status: 400 })
    }
    if (error instanceof NoClubPoolError) {
      return NextResponse.json({ error: 'noClubPool' }, { status: 400 })
    }
    throw error
  }
})
