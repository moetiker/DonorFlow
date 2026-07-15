import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'

type RouteContext = { params: Promise<{ id: string }> }

/** Progress of a running or finished mail job (for UI polling). */
export const GET = withApiRoute(async (_request: NextRequest, { params }: RouteContext) => {
  const { id } = await params
  const job = await prisma.mailJob.findUnique({ where: { id } })
  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let results: unknown = []
  try {
    results = JSON.parse(job.results)
  } catch {
    results = []
  }

  return NextResponse.json({
    status: job.status,
    total: job.total,
    processed: job.processed,
    results,
  })
})
