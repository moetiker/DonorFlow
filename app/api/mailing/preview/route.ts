import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { buildMemberMailData, getOrgName } from '@/lib/mailing-data'
import { renderStatusEmail } from '@/lib/email-template'

function getBaseUrl(request: NextRequest): string {
  return process.env.NEXTAUTH_URL || request.nextUrl.origin
}

/** Render one member's email for preview, without sending. */
export const POST = withApiRoute(async (request: NextRequest) => {
  const { memberId, fiscalYearId } = await request.json()
  if (!memberId || !fiscalYearId) {
    return NextResponse.json({ error: 'memberId and fiscalYearId are required' }, { status: 400 })
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
    memberName: data.memberName,
    orgName: await getOrgName(),
    fiscalYearName: fiscalYear.name,
    statusUrl: `${getBaseUrl(request)}/s/${data.statusToken}`,
    progress: data.progress,
    attachmentsNote: Boolean(letter),
    locale: 'de',
  })

  return NextResponse.json({
    subject: email.subject,
    html: email.html,
    to: data.email,
    hasEmail: Boolean(data.email),
    hasLetter: Boolean(letter),
  })
})
