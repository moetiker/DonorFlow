import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { isMailConfigured } from '@/lib/mail'

// Keys that hold plain values returned to the client (password is excluded).
const PUBLIC_MAIL_KEYS = [
  'mailSmtpHost',
  'mailSmtpPort',
  'mailSmtpUser',
  'mailFrom',
  'mailFromName',
  'mailReplyTo',
  'mailRatePerMinute',
] as const

/**
 * GET the mail configuration. The password is never returned; instead a
 * `passwordSet` flag indicates whether one is stored.
 */
export const GET = withApiRoute(async () => {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [...PUBLIC_MAIL_KEYS, 'mailSmtpPassword'] } },
    select: { key: true, value: true },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  const result: Record<string, string | boolean> = {}
  for (const key of PUBLIC_MAIL_KEYS) {
    result[key] = map[key] ?? ''
  }
  result.passwordSet = Boolean(map.mailSmtpPassword)
  result.configured = await isMailConfigured()

  return NextResponse.json(result)
})

/**
 * Save the mail configuration. The password is write-only: it is only updated
 * when a non-empty `mailSmtpPassword` is supplied, so leaving it blank keeps
 * the stored value.
 */
export const POST = withApiRoute(async (request: NextRequest) => {
  const body = await request.json()

  const updates: Array<[string, string]> = []
  for (const key of PUBLIC_MAIL_KEYS) {
    if (key in body) {
      updates.push([key, String(body[key] ?? '')])
    }
  }
  // Password only if a new non-empty value was provided
  if (typeof body.mailSmtpPassword === 'string' && body.mailSmtpPassword.length > 0) {
    updates.push(['mailSmtpPassword', body.mailSmtpPassword])
  }

  for (const [key, value] of updates) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  }

  return NextResponse.json({ success: true, configured: await isMailConfigured() })
})
