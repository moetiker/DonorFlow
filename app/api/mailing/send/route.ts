import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { isMailConfigured } from '@/lib/mail'
import { runMailJob } from '@/lib/mailing-runner'

function getBaseUrl(request: NextRequest): string {
  return process.env.NEXTAUTH_URL || request.nextUrl.origin
}

/**
 * Start a throttled donor mailing. Emails are sent in the background in batches
 * (see mailing-runner) so the request returns immediately with a job id the UI
 * can poll. Only one mailing job may run at a time (guards against duplicate
 * sends from double submits or reloads).
 */
export const POST = withApiRoute(async (request: NextRequest) => {
  const { fiscalYearId, memberIds } = await request.json()
  if (!fiscalYearId || !Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: 'fiscalYearId and memberIds are required' }, { status: 400 })
  }

  if (!(await isMailConfigured())) {
    return NextResponse.json({ error: 'mail_not_configured' }, { status: 400 })
  }

  // Only one mailing at a time — prevents duplicate emails from a second submit.
  const running = await prisma.mailJob.findFirst({ where: { status: 'running' }, select: { id: true } })
  if (running) {
    return NextResponse.json({ error: 'job_running', jobId: running.id }, { status: 409 })
  }

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: fiscalYearId },
    select: { name: true },
  })
  if (!fiscalYear) {
    return NextResponse.json({ error: 'Fiscal year not found' }, { status: 404 })
  }

  const letter = await prisma.donorLetter.findUnique({ where: { fiscalYearId }, select: { id: true } })
  if (!letter) {
    return NextResponse.json({ error: 'no_letter' }, { status: 400 })
  }

  const ids = memberIds.map((id: unknown) => String(id))
  const job = await prisma.mailJob.create({
    data: {
      fiscalYearId,
      status: 'running',
      total: ids.length,
      processed: 0,
      memberIds: JSON.stringify(ids),
      baseUrl: getBaseUrl(request),
      results: '[]',
    },
    select: { id: true },
  })

  // Fire-and-forget: the batched runner keeps going after the response is sent
  // (the app runs as a persistent Node server); it is also resumable on restart.
  void runMailJob(job.id).catch(async () => {
    await prisma.mailJob.update({ where: { id: job.id }, data: { status: 'failed' } }).catch(() => {})
  })

  return NextResponse.json({ jobId: job.id, total: ids.length })
})
