import { NextRequest, NextResponse } from 'next/server'
import { withPublicApiRoute } from '@/lib/api-helpers'
import { buildSponsorCsv } from '@/lib/sponsor-csv'
import { loadStatusExportData, STATUS_TOKEN_LENGTH } from '@/lib/status-export'

// exceljs and jspdf need Node APIs - keep this handler off the edge runtime
export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ token: string }>
}

// Security headers shared by all responses from this public endpoint
const SECURITY_HEADERS = {
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, no-cache'
}

const SUPPORTED_FORMATS = ['csv'] as const
type ExportFormat = (typeof SUPPORTED_FORMATS)[number]

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS })
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400, headers: SECURITY_HEADERS })
}

/** Builds "Goenner_<Name>_<YYYY-MM-DD>.<ext>" with a filesystem-safe name part. */
function exportFilename(name: string, extension: string): string {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const safeName = name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'Export'
  return `Goenner_${safeName}_${dateStr}.${extension}`
}

/**
 * Public export of the sponsor address list behind a status link.
 * No authentication - access is granted via the unguessable capability token
 * only. The format defaults to CSV so pre-existing links keep working.
 *
 * GET /api/public/status/[token]/export?format=csv
 */
export const GET = withPublicApiRoute(async (request: NextRequest, { params }: RouteParams) => {
  const { token } = await params

  if (!token || token.length !== STATUS_TOKEN_LENGTH) {
    return notFound()
  }

  const requestedFormat = request.nextUrl.searchParams.get('format') ?? 'csv'
  if (!SUPPORTED_FORMATS.includes(requestedFormat as ExportFormat)) {
    return badRequest(`Unsupported format: ${requestedFormat}`)
  }

  const data = await loadStatusExportData(token)
  if (!data) {
    return notFound()
  }

  return new NextResponse(buildSponsorCsv(data.entries, data.currentFiscalYearId), {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFilename(data.name, 'csv')}"`
    }
  })
})
