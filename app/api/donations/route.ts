import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { createDonationSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'

export const GET = withApiRoute(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const includeAll = searchParams.get('include') === 'all'

  const donations = await prisma.donation.findMany({
    orderBy: { donationDate: 'desc' },
    take: 100,
    ...(includeAll && {
      include: {
        sponsor: {
          include: {
            member: true,
            group: true
          }
        },
        member: true,  // Include donation's assigned member
        group: true    // Include donation's assigned group
      }
    })
  })

  return NextResponse.json(serializeDates(donations))
})

export const POST = withApiRoute(async (request: NextRequest) => {
  const body = await request.json()

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Validate request body with i18n (includes XOR validation for memberId/groupId)
  const validation = await validateRequestI18n(createDonationSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { sponsorId, amount, donationDate, note, memberId, groupId } = validation.data

  // Determine the fiscal year based on donation date
  const parsedDate = new Date(donationDate)
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: {
      startDate: { lte: parsedDate },
      endDate: { gte: parsedDate }
    }
  })

  const donation = await prisma.donation.create({
    data: {
      sponsorId,
      amount,
      donationDate: parsedDate,
      fiscalYearId: fiscalYear?.id || null,
      note: note || null,
      memberId: memberId || null,
      groupId: groupId || null
    }
  })

  return NextResponse.json(donation, { status: 201 })
})
