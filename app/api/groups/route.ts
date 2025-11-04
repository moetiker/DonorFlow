import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { createGroupSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'

export const GET = withApiRoute(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const includeAll = searchParams.get('include') === 'all'

  const groups = await prisma.group.findMany({
    orderBy: { name: 'asc' },
    ...(includeAll && {
      include: {
        members: {
          include: {
            memberTargets: {
              include: {
                fiscalYear: true
              }
            }
          }
        },
        sponsors: {
          include: {
            donations: true
          }
        },
        _count: {
          select: { sponsors: true, members: true }
        }
      }
    })
  })

  return NextResponse.json(serializeDates(groups))
})

export const POST = withApiRoute(async (request: NextRequest) => {
  const body = await request.json()

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Validate request body with i18n
  const validation = await validateRequestI18n(createGroupSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { name } = validation.data

  const group = await prisma.group.create({
    data: { name }
  })

  return NextResponse.json(group, { status: 201 })
})
