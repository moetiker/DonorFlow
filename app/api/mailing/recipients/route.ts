import { NextResponse } from 'next/server'
import { withApiRoute } from '@/lib/api-helpers'
import { listMailRecipients } from '@/lib/mailing-data'

/** List members selectable as donor-mailing recipients. */
export const GET = withApiRoute(async () => {
  const recipients = await listMailRecipients()
  return NextResponse.json(recipients)
})
