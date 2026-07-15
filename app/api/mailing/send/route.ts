import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { buildMemberMailData, getOrgName, mailCsvFilename } from '@/lib/mailing-data'
import { renderStatusEmail } from '@/lib/email-template'
import { isMailConfigured, sendMail } from '@/lib/mail'

function getBaseUrl(request: NextRequest): string {
  return process.env.NEXTAUTH_URL || request.nextUrl.origin
}

type SendResult = {
  memberId: string
  name?: string
  email?: string | null
  status: 'sent' | 'skipped' | 'failed'
  error?: string
}

/**
 * Send the donor mailing to the selected members. One personalized email per
 * member with the fiscal year's donor letter (PDF) and the member's address
 * CSV attached. Sequential best-effort; returns a per-recipient result list.
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
  const results: SendResult[] = []

  for (const memberId of memberIds as string[]) {
    const data = await buildMemberMailData(memberId, fiscalYearId)
    if (!data) {
      results.push({ memberId, status: 'failed', error: 'not_found' })
      continue
    }
    if (!data.email) {
      results.push({ memberId, name: data.memberName, status: 'skipped', error: 'no_email' })
      continue
    }

    try {
      const email = renderStatusEmail({
        firstName: data.memberFirstName,
        orgName,
        fiscalYearName: fiscalYear.name,
        statusUrl: `${baseUrl}/s/${data.statusToken}`,
        progress: data.progress,
        sponsors: data.sponsors,
        previousYearName: data.previousYearName,
        groupInfo: data.groupInfo,
        attachmentsNote: true,
        locale: 'de',
      })

      await sendMail({
        to: data.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: [
          { filename: letter.fileName, content: Buffer.from(letter.data), contentType: letter.mimeType },
          { filename: mailCsvFilename(data.displayName), content: Buffer.from(data.csvContent, 'utf-8'), contentType: 'text/csv; charset=utf-8' },
        ],
      })

      results.push({ memberId, name: data.memberName, email: data.email, status: 'sent' })
    } catch (error) {
      results.push({
        memberId,
        name: data.memberName,
        email: data.email,
        status: 'failed',
        error: error instanceof Error ? error.message : 'send_failed',
      })
    }
  }

  const summary = {
    total: results.length,
    sent: results.filter((r) => r.status === 'sent').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
  }

  return NextResponse.json({ results, summary })
})
