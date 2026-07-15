import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Rename a fiscal year. Only the name is editable; dates are left untouched so
 * donation/target attribution is unaffected.
 */
export const PUT = withApiRoute(async (request: NextRequest, { params }: RouteContext) => {
  const { id } = await params
  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const existing = await prisma.fiscalYear.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const duplicate = await prisma.fiscalYear.findFirst({
    where: { name, id: { not: id } },
    select: { id: true },
  })
  if (duplicate) {
    return NextResponse.json({ error: 'nameExists' }, { status: 400 })
  }

  const updated = await prisma.fiscalYear.update({ where: { id }, data: { name } })
  return NextResponse.json(updated)
})
