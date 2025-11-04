import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { createFiscalYearSchema, validateRequestI18n, getLocaleFromRequest, getMessages } from '@/lib/validation'

export const GET = withApiRoute(async () => {
  const fiscalYears = await prisma.fiscalYear.findMany({
    orderBy: { startDate: 'desc' },
    include: {
      _count: {
        select: { memberTargets: true }
      }
    }
  })

  return NextResponse.json(fiscalYears)
})

export const POST = withApiRoute(async (request: NextRequest) => {
  const body = await request.json()

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Validate request body with i18n
  const validation = await validateRequestI18n(createFiscalYearSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { name, startDate, endDate, copyPreviousTargets } = validation.data

  // Check if name already exists
  const existing = await prisma.fiscalYear.findFirst({
    where: { name }
  })

  if (existing) {
    const messages = await getMessages(locale)
    return NextResponse.json({ error: messages.fiscalYears?.nameAlreadyExists || 'A fiscal year with this name already exists' }, { status: 400 })
  }

  // Create fiscal year
  const fiscalYear = await prisma.fiscalYear.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    }
  })

  // Copy targets from previous year if requested
  if (copyPreviousTargets) {
    const previousYear = await prisma.fiscalYear.findFirst({
      where: {
        startDate: { lt: new Date(startDate) }
      },
      orderBy: { startDate: 'desc' },
      include: {
        memberTargets: true
      }
    })

    if (previousYear && previousYear.memberTargets.length > 0) {
      await prisma.memberTarget.createMany({
        data: previousYear.memberTargets.map(target => ({
          memberId: target.memberId,
          fiscalYearId: fiscalYear.id,
          targetAmount: target.targetAmount
        }))
      })
    }
  }

  return NextResponse.json(fiscalYear, { status: 201 })
})
