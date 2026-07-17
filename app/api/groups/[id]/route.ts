import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { updateGroupSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'
import { reassignToClubPool, getClubPool, NoClubPoolError, ClubPoolLockedError } from '@/lib/club-pool'

export const PUT = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const body = await request.json()
  const { id: groupId } = await params

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Validate request body with i18n
  const validation = await validateRequestI18n(updateGroupSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { name, isClubPool } = validation.data

  const updatedGroup = await prisma.$transaction(async (tx) => {
    // Exactly one group may be the pool. SQLite has no partial unique index, so
    // the invariant lives here: claiming the flag takes it from everyone else.
    if (isClubPool === true) {
      await tx.group.updateMany({
        where: { isClubPool: true, id: { not: groupId } },
        data: { isClubPool: false }
      })
    }

    return tx.group.update({
      where: { id: groupId },
      data: { name, ...(isClubPool === undefined ? {} : { isClubPool }) }
    })
  })

  return NextResponse.json(serializeDates(updatedGroup))
})

export const DELETE = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: groupId } = await params

  try {
    await prisma.$transaction(async (tx) => {
      const pool = await getClubPool(tx)

      // The pool is the fallback for every other deletion; deleting it would
      // leave that fallback pointing at nothing. Move the flag first.
      if (pool.id === groupId) {
        throw new ClubPoolLockedError()
      }

      await reassignToClubPool(tx, { groupId })

      // Members lose their group via onDelete: SetNull, which is intended —
      // a member without a group keeps their own sponsors.
      await tx.group.delete({ where: { id: groupId } })
    })
  } catch (error) {
    if (error instanceof NoClubPoolError) {
      return NextResponse.json({ error: 'noClubPool' }, { status: 400 })
    }
    if (error instanceof ClubPoolLockedError) {
      return NextResponse.json({ error: 'clubPoolLocked' }, { status: 400 })
    }
    throw error
  }

  return NextResponse.json({ success: true })
})