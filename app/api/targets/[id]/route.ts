import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { updateTargetSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'

export const PUT = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const body = await request.json()

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Validate request body with i18n
  const validation = await validateRequestI18n(updateTargetSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { targetAmount } = validation.data

  const target = await prisma.memberTarget.update({
    where: { id },
    data: { targetAmount }
  })

  return NextResponse.json(target)
})
