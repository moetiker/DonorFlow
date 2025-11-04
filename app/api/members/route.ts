import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { createMemberSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'

export const GET = withApiRoute(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const includeAll = searchParams.get('include') === 'all'

  const members = await prisma.member.findMany({
    orderBy: { lastName: 'asc' },
    ...(includeAll && {
      include: {
        group: true,
        memberTargets: {
          include: {
            fiscalYear: true
          }
        },
        sponsors: {
          include: {
            donations: true
          }
        },
        _count: {
          select: { sponsors: true }
        }
      }
    })
  })

  return NextResponse.json(serializeDates(members))
})

export const POST = withApiRoute(async (request: NextRequest) => {
  const body = await request.json()

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Validate request body with i18n
  const validation = await validateRequestI18n(createMemberSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { firstName, lastName } = validation.data

  // Create member
  const member = await prisma.member.create({
    data: {
      firstName,
      lastName
    }
  })

  // Automatically create target for current fiscal year if exists
  const currentYear = await prisma.fiscalYear.findFirst({
    where: {
      startDate: { lte: new Date() },
      endDate: { gte: new Date() }
    }
  })

  if (currentYear) {
    // Get default target amount from settings
    const defaultTargetSetting = await prisma.setting.findUnique({
      where: { key: 'defaultTargetAmount' }
    })

    const defaultTarget = defaultTargetSetting ? parseFloat(defaultTargetSetting.value) : 1000

    await prisma.memberTarget.create({
      data: {
        memberId: member.id,
        fiscalYearId: currentYear.id,
        targetAmount: defaultTarget
      }
    })
  }

  return NextResponse.json(member, { status: 201 })
})
