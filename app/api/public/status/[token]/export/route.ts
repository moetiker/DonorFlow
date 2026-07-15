import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withPublicApiRoute } from '@/lib/api-helpers'
import { getMemberDisplayName } from '@/lib/utils'
import { SPONSOR_CSV_SELECT, buildSponsorCsv, type SponsorCsvRow } from '@/lib/sponsor-csv'

// Token format: 32 characters (base64url, 192 bits entropy)
const TOKEN_LENGTH = 32

interface RouteParams {
  params: Promise<{ token: string }>
}

// Security headers shared by all responses from this public endpoint
const SECURITY_HEADERS = {
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, no-cache'
}

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS })
}

function csvFilename(name: string): string {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const safeName = name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'Export'
  return `Goenner_${safeName}_${dateStr}.csv`
}

function csvResponse(name: string, csvContent: string): NextResponse {
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename(name)}"`
    }
  })
}

/**
 * Public CSV export for a status link.
 * Returns the address list of the sponsors shown on the status page for the
 * given member or group token. No authentication - access is granted via the
 * unguessable capability token only.
 *
 * GET /api/public/status/[token]/export
 */
export const GET = withPublicApiRoute(async (_request: NextRequest, { params }: RouteParams) => {
  const { token } = await params

  if (!token || token.length !== TOKEN_LENGTH) {
    return notFound()
  }

  // Current fiscal year - donation totals are scoped to it (matches status page)
  const now = new Date()
  const currentFiscalYear = await prisma.fiscalYear.findFirst({
    where: { startDate: { lte: now }, endDate: { gte: now } },
    select: { id: true }
  })
  const currentFiscalYearId = currentFiscalYear?.id ?? null

  // Member link: export the member's own sponsors
  const member = await prisma.member.findUnique({
    where: { statusToken: token },
    select: {
      firstName: true,
      lastName: true,
      sponsors: { orderBy: { lastName: 'asc' }, select: SPONSOR_CSV_SELECT }
    }
  })

  if (member) {
    const memberName = getMemberDisplayName(member)
    const entries = member.sponsors.map((sponsor: SponsorCsvRow) => ({ sponsor, assignedTo: memberName }))
    return csvResponse(memberName, buildSponsorCsv(entries, currentFiscalYearId))
  }

  // Group link: export group-level sponsors + every member's sponsors
  const group = await prisma.group.findUnique({
    where: { statusToken: token },
    select: {
      name: true,
      sponsors: { orderBy: { lastName: 'asc' }, select: SPONSOR_CSV_SELECT },
      members: {
        orderBy: { lastName: 'asc' },
        select: {
          firstName: true,
          lastName: true,
          sponsors: { orderBy: { lastName: 'asc' }, select: SPONSOR_CSV_SELECT }
        }
      }
    }
  })

  if (group) {
    const entries: { sponsor: SponsorCsvRow; assignedTo: string }[] = []
    for (const sponsor of group.sponsors) {
      entries.push({ sponsor, assignedTo: `${group.name} (Gruppe)` })
    }
    for (const groupMember of group.members) {
      const memberName = getMemberDisplayName(groupMember)
      for (const sponsor of groupMember.sponsors) {
        entries.push({ sponsor, assignedTo: memberName })
      }
    }
    return csvResponse(group.name, buildSponsorCsv(entries, currentFiscalYearId))
  }

  return notFound()
})
