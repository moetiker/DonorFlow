import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { createSponsorSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'

export const GET = withApiRoute(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const includeAll = searchParams.get('include') === 'all'

  const sponsors = await prisma.sponsor.findMany({
    orderBy: { lastName: 'asc' },
    ...(includeAll && {
      include: {
        member: true,
        group: true,
        _count: {
          select: { donations: true }
        }
      }
    })
  })

  return NextResponse.json(serializeDates(sponsors))
})

export const POST = withApiRoute(async (request: NextRequest) => {
  const body = await request.json()

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Validate request body with i18n
  const validation = await validateRequestI18n(createSponsorSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const {
    company, salutation, firstName, lastName,
    street, postalCode, city, phone, email, notes,
    memberId, groupId
  } = validation.data

  const sponsor = await prisma.sponsor.create({
    data: {
      company: company || null,
      salutation: salutation || null,
      firstName: firstName || null,
      lastName: lastName || null,
      street: street || null,
      postalCode: postalCode || null,
      city: city || null,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
      memberId: memberId || null,
      groupId: groupId || null
    }
  })

  return NextResponse.json(sponsor, { status: 201 })
})
