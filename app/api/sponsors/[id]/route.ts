import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { updateSponsorSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'

export const PUT = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: sponsorId } = await params
  const body = await request.json()

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Validate request body with i18n
  const validation = await validateRequestI18n(updateSponsorSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const sponsor = await prisma.sponsor.update({
    where: { id: sponsorId },
    data: {
      company: body.company,
      salutation: body.salutation,
      firstName: body.firstName,
      lastName: body.lastName,
      street: body.street,
      postalCode: body.postalCode,
      city: body.city,
      phone: body.phone,
      email: body.email,
      notes: body.notes,
      memberId: body.memberId,
      groupId: body.groupId
    }
  })

  return NextResponse.json(sponsor)
})

export const DELETE = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: sponsorId } = await params

  // Delete sponsor - cascading deletes will handle:
  // - Donations (onDelete: Cascade)
  await prisma.sponsor.delete({
    where: { id: sponsorId }
  })

  return NextResponse.json({ success: true })
})
