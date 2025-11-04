import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { updateGroupSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'

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

  const { name } = validation.data

  const updatedGroup = await prisma.group.update({
    where: { id: groupId },
    data: { name }
  })

  return NextResponse.json(serializeDates(updatedGroup))
})

export const DELETE = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: groupId } = await params

  // Delete group - SetNull will handle:
  // - Members (onDelete: SetNull - will set groupId to null)
  // - Sponsors (onDelete: SetNull - will set groupId to null)
  await prisma.group.delete({
    where: { id: groupId }
  })

  return NextResponse.json({ success: true })
})