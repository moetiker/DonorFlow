import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { buildMemberMailData, getMailBaseUrl, getOrgName } from '@/lib/mailing-data'
import { renderStatusEmail } from '@/lib/email-template'

/** Render one member's email for preview, without sending. */
export const POST = withApiRoute(async (request: NextRequest) => {
  const { memberId, fiscalYearId, mode } = await request.json()
  const variant = mode === 'reminder' ? 'reminder' : 'letter'
  if (!memberId || !fiscalYearId) {
    return NextResponse.json({ error: 'memberId and fiscalYearId are required' }, { status: 400 })
  }

  // Same rule as the send route: the status link comes from the configured
  // base URL, never from the request.
  const baseUrl = getMailBaseUrl()
  if (!baseUrl) {
    return NextResponse.json({ error: 'base_url_not_configured' }, { status: 500 })
  }

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: fiscalYearId },
    select: { name: true },
  })
  if (!fiscalYear) {
    return NextResponse.json({ error: 'Fiscal year not found' }, { status: 404 })
  }

  const data = await buildMemberMailData(memberId, fiscalYearId)
  if (!data) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  const letter = await prisma.donorLetter.findUnique({
    where: { fiscalYearId },
    select: { fileName: true },
  })

  const email = renderStatusEmail({
    firstName: data.memberFirstName,
    orgName: await getOrgName(),
    fiscalYearName: fiscalYear.name,
    statusUrl: `${baseUrl}/s/${data.statusToken}`,
    progress: data.progress,
    sponsors: data.sponsors,
    previousYearName: data.previousYearName,
    groupInfo: data.groupInfo,
    attachmentsNote: variant === 'letter' && Boolean(letter),
    locale: 'de',
    variant,
  })

  return NextResponse.json({
    subject: email.subject,
    html: email.html,
    to: data.email,
    hasEmail: Boolean(data.email),
    hasLetter: Boolean(letter),
  })
})
