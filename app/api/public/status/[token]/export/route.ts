import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withPublicApiRoute } from '@/lib/api-helpers'
import { buildCSV } from '@/lib/csv'
import { getMemberDisplayName } from '@/lib/utils'

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

const SPONSOR_SELECT = {
  company: true,
  salutation: true,
  firstName: true,
  lastName: true,
  street: true,
  postalCode: true,
  city: true,
  phone: true,
  email: true,
  notes: true,
  donations: { select: { amount: true, fiscalYearId: true } }
} as const

type SponsorRow = {
  company: string | null
  salutation: string | null
  firstName: string | null
  lastName: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  phone: string | null
  email: string | null
  notes: string | null
  donations: { amount: number | null; fiscalYearId: string | null }[]
}

const CSV_HEADERS = [
  'Firma',
  'Anrede',
  'Vorname',
  'Nachname',
  'Strasse',
  'PLZ',
  'Ort',
  'Telefon',
  'E-Mail',
  'Notizen',
  'Zugeordnet zu',
  'Anzahl Spenden (laufendes Jahr)',
  'Spendensumme (laufendes Jahr)'
]

function buildSponsorRow(
  sponsor: SponsorRow,
  assignedTo: string,
  currentFiscalYearId: string | null
): unknown[] {
  // Only count donations of the current fiscal year, matching the status page.
  const currentDonations = currentFiscalYearId
    ? sponsor.donations.filter(d => d.fiscalYearId === currentFiscalYearId)
    : []
  const donationCount = currentDonations.length
  const donationSum = currentDonations.reduce((sum, d) => sum + (d.amount || 0), 0)
  return [
    sponsor.company,
    sponsor.salutation,
    sponsor.firstName,
    sponsor.lastName,
    sponsor.street,
    sponsor.postalCode,
    sponsor.city,
    sponsor.phone,
    sponsor.email,
    sponsor.notes,
    assignedTo,
    donationCount,
    donationSum.toFixed(2)
  ]
}

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS })
}

function csvResponse(name: string, rows: unknown[][]): NextResponse {
  const csvContent = buildCSV(CSV_HEADERS, rows)

  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const safeName = name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'Export'
  const filename = `Goenner_${safeName}_${dateStr}.csv`

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
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
    where: {
      startDate: { lte: now },
      endDate: { gte: now }
    },
    select: { id: true }
  })
  const currentFiscalYearId = currentFiscalYear?.id ?? null

  // Member link: export the member's own sponsors
  const member = await prisma.member.findUnique({
    where: { statusToken: token },
    select: {
      firstName: true,
      lastName: true,
      sponsors: { orderBy: { lastName: 'asc' }, select: SPONSOR_SELECT }
    }
  })

  if (member) {
    const memberName = getMemberDisplayName(member)
    const rows = member.sponsors.map(sponsor => buildSponsorRow(sponsor, memberName, currentFiscalYearId))
    return csvResponse(memberName, rows)
  }

  // Group link: export group-level sponsors + every member's sponsors
  const group = await prisma.group.findUnique({
    where: { statusToken: token },
    select: {
      name: true,
      sponsors: { orderBy: { lastName: 'asc' }, select: SPONSOR_SELECT },
      members: {
        orderBy: { lastName: 'asc' },
        select: {
          firstName: true,
          lastName: true,
          sponsors: { orderBy: { lastName: 'asc' }, select: SPONSOR_SELECT }
        }
      }
    }
  })

  if (group) {
    const rows: unknown[][] = []
    // Group-level sponsors first
    for (const sponsor of group.sponsors) {
      rows.push(buildSponsorRow(sponsor, `${group.name} (Gruppe)`, currentFiscalYearId))
    }
    // Then each member's sponsors, labelled with the member name
    for (const groupMember of group.members) {
      const memberName = getMemberDisplayName(groupMember)
      for (const sponsor of groupMember.sponsors) {
        rows.push(buildSponsorRow(sponsor, memberName, currentFiscalYearId))
      }
    }
    return csvResponse(group.name, rows)
  }

  return notFound()
})
