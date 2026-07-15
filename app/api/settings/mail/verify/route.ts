import { NextResponse } from 'next/server'
import { withApiRoute } from '@/lib/api-helpers'
import { verifyMailConnection } from '@/lib/mail'

/**
 * Test the stored SMTP configuration without sending an email.
 */
export const POST = withApiRoute(async () => {
  const result = await verifyMailConnection()
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
})
