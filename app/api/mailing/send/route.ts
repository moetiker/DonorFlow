import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { getOrgName } from '@/lib/mailing-data'
import { isMailConfigured } from '@/lib/mail'
import { runMailJob } from '@/lib/mailing-runner'

function getBaseUrl(request: NextRequest): string {
  return process.env.NEXTAUTH_URL || request.nextUrl.origin
}

/**
 * Start a throttled donor mailing. Emails are sent in the background in batches
 * (see mailing-runner) so the request returns immediately with a job id the UI
 * can poll. Each recipient gets a personalized email with the fiscal year's
 * donor letter and their address CSV attached.
 */
export const POST = withApiRoute(async (request: NextRequest) => {
  const { fiscalYearId, memberIds } = await request.json()
  if (!fiscalYearId || !Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: 'fiscalYearId and memberIds are required' }, { status: 400 })
  }

  if (!(await isMailConfigured())) {
    return NextResponse.json({ error: 'mail_not_configured' }, { status: 400 })
  }

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: fiscalYearId },
    select: { name: true },
  })
  if (!fiscalYear) {
    return NextResponse.json({ error: 'Fiscal year not found' }, { status: 404 })
  }

  const letter = await prisma.donorLetter.findUnique({ where: { fiscalYearId } })
  if (!letter) {
    return NextResponse.json({ error: 'no_letter' }, { status: 400 })
  }

  const orgName = await getOrgName()
  const baseUrl = getBaseUrl(request)
  const ids = memberIds as string[]

  const job = await prisma.mailJob.create({
    data: { fiscalYearId, status: 'running', total: ids.length, processed: 0, results: '[]' },
    select: { id: true },
  })

  // Fire-and-forget: the batched runner keeps going after the response is sent
  // (the app runs as a persistent Node server).
  void runMailJob({
    jobId: job.id,
    fiscalYearId,
    fiscalYearName: fiscalYear.name,
    memberIds: ids,
    baseUrl,
    orgName,
    letter: { fileName: letter.fileName, mimeType: letter.mimeType, data: Buffer.from(letter.data) },
  }).catch(async () => {
    await prisma.mailJob.update({ where: { id: job.id }, data: { status: 'done' } }).catch(() => {})
  })

  return NextResponse.json({ jobId: job.id, total: ids.length })
})
