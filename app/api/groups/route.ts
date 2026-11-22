import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { createGroupSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'

const donationFields = { amount: true, fiscalYearId: true, type: true } as const

type GroupWithDonations = Prisma.GroupGetPayload<{
  include: {
    members: {
      include: {
        memberTargets: { include: { fiscalYear: true } }
        donations: { select: typeof donationFields }
      }
    }
    donations: { select: typeof donationFields }
    _count: { select: { sponsorAssignments: true; members: true } }
  }
}>

export const GET = withApiRoute(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  // `include` may be repeated or comma-separated, e.g. include=all,dissolved
  const includes = new Set(searchParams.getAll('include').flatMap(v => v.split(',')))
  const includeAll = includes.has('all')
  const includeDissolved = includes.has('dissolved')

  const groups = await prisma.group.findMany({
    // Dissolved groups are hidden unless asked for; they carry dissolvedAt
    where: includeDissolved ? undefined : { dissolvedAt: null },
    orderBy: { name: 'asc' },
    ...(includeAll && {
      include: {
        members: {
          include: {
            memberTargets: {
              include: {
                fiscalYear: true
              }
            },
            donations: { select: donationFields }
          }
        },
        donations: { select: donationFields },
        _count: {
          select: { sponsorAssignments: true, members: true }
        }
      }
    })
  })

  if (!includeAll) {
    return NextResponse.json(serializeDates(groups))
  }

  // `donations` of a group = its total: donations credited to the group itself
  // and to its current members.
  const withTotals = (groups as GroupWithDonations[]).map(({ members, donations, ...group }) => ({
    ...group,
    members: members.map(({ donations: _memberDonations, ...member }) => member),
    donations: [...donations, ...members.flatMap(m => m.donations)]
  }))

  return NextResponse.json(serializeDates(withTotals))
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
