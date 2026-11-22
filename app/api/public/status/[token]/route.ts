import { NextRequest, NextResponse } from 'next/server'
import { withPublicApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { STATUS_TOKEN_LENGTH } from '@/lib/status-export'
import { loadStatusData } from '@/lib/status-data'

interface RouteParams {
  params: Promise<{ token: string }>
}

const HEADERS = {
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, max-age=60'
}

/**
 * Public status endpoint - returns donation collection progress for a member or group
 * No authentication required - access is granted via capability URL token
 *
 * GET /api/public/status/[token]
 *
 * Only donations credited to the member or group (donation.memberId /
 * donation.groupId) are counted; see lib/status-data.ts.
 */
export const GET = withPublicApiRoute(async (request: NextRequest, { params }: RouteParams) => {
  const { token } = await params

  // Validate token format (must be exactly 32 characters)
  if (!token || token.length !== STATUS_TOKEN_LENGTH) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: HEADERS })
  }

  const data = await loadStatusData(token)
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: HEADERS })
  }

  return NextResponse.json(serializeDates(data), { headers: HEADERS })
})
