import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { bulkCreateTargetsSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'

export const GET = withApiRoute(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const fiscalYearId = searchParams.get('year')

  // Get current or selected fiscal year
  let fiscalYear
  if (fiscalYearId) {
    fiscalYear = await prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId }
    })
  } else {
    fiscalYear = await prisma.fiscalYear.findFirst({
      where: {
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      }
    })
  }

  if (!fiscalYear) {
    return NextResponse.json(null)
  }

  const targets = await prisma.memberTarget.findMany({
    where: { fiscalYearId: fiscalYear.id },
    include: {
      member: true
    },
    orderBy: {
      member: { lastName: 'asc' }
    }
  })

  const allYears = await prisma.fiscalYear.findMany({
    orderBy: { startDate: 'desc' }
  })

  return NextResponse.json(serializeDates({
    fiscalYear,
    targets,
    allYears
  }))
})

export const POST = withApiRoute(async (request: NextRequest) => {
  const body = await request.json()

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Validate request body with i18n
  const validation = await validateRequestI18n(bulkCreateTargetsSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { fiscalYearId, defaultAmount } = validation.data

  // Get all members
  const members = await prisma.member.findMany()

  // Get existing targets for this fiscal year
  const existingTargets = await prisma.memberTarget.findMany({
    where: { fiscalYearId },
    select: { memberId: true }
  })

  const existingMemberIds = new Set(existingTargets.map(t => t.memberId))

  // Create targets for members without existing targets
  const targetsToCreate = members
    .filter(m => !existingMemberIds.has(m.id))
    .map(m => ({
      memberId: m.id,
      fiscalYearId,
      targetAmount: defaultAmount
    }))

  if (targetsToCreate.length === 0) {
    return NextResponse.json({
      message: 'All members already have targets for this fiscal year',
      created: 0
    })
  }

  // Bulk create targets
  await prisma.memberTarget.createMany({
    data: targetsToCreate
  })

  return NextResponse.json({
    message: `Created ${targetsToCreate.length} targets`,
    created: targetsToCreate.length
  })
})
