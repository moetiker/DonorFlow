import nodemailer from 'nodemailer'
import { prisma } from './db'

/**
 * SMTP / sender configuration is stored in the Setting key-value table
 * (not in .env) so it can be managed from the app's settings page.
 * The password is write-only: it is never returned by the settings API.
 */
export const MAIL_SETTING_KEYS = [
  'mailSmtpHost',
  'mailSmtpPort',
  'mailSmtpUser',
  'mailSmtpPassword',
  'mailFrom',
  'mailFromName',
  'mailReplyTo',
] as const

export type MailConfig = {
  host: string
  port: number
  user: string
  password: string
  from: string
  fromName?: string
  replyTo?: string
}

export type MailAttachment = {
  filename: string
  content: Buffer
  contentType?: string
}

async function loadMailSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [...MAIL_SETTING_KEYS] } },
    select: { key: true, value: true },
  })
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

/** Returns the full mail config (incl. password) or null if incomplete. */
export async function getMailConfig(): Promise<MailConfig | null> {
  const s = await loadMailSettings()
  if (!s.mailSmtpHost || !s.mailSmtpUser || !s.mailSmtpPassword || !s.mailFrom) {
    return null
  }
  return {
    host: s.mailSmtpHost,
    port: parseInt(s.mailSmtpPort || '587', 10),
    user: s.mailSmtpUser,
    password: s.mailSmtpPassword,
    from: s.mailFrom,
    fromName: s.mailFromName || undefined,
    replyTo: s.mailReplyTo || undefined,
  }
}

export async function isMailConfigured(): Promise<boolean> {
  return (await getMailConfig()) !== null
}

// Default throttle if unset/invalid: emails per minute
export const DEFAULT_MAIL_RATE_PER_MINUTE = 20

/** Configurable sending rate (emails per minute), stored in settings. */
export async function getMailRatePerMinute(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'mailRatePerMinute' }, select: { value: true } })
  const n = parseInt(s?.value ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAIL_RATE_PER_MINUTE
}

function createTransport(cfg: MailConfig, opts?: { pool?: boolean }) {
  // Port 465 → implicit TLS; 587 (and others) → STARTTLS
  const secure = cfg.port === 465
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure,
    requireTLS: !secure,
    auth: { user: cfg.user, pass: cfg.password },
    // Pooled: reuse a single SMTP connection across a batch mailing
    ...(opts?.pool ? { pool: true, maxConnections: 1 } : {}),
  })
}

function formatFrom(cfg: MailConfig): string {
  return cfg.fromName ? `"${cfg.fromName}" <${cfg.from}>` : cfg.from
}

/**
 * A reusable sender for a batch mailing: one pooled SMTP connection plus the
 * resolved from/reply-to. Call {@link MailSender.send} per message and
 * {@link MailSender.close} when the batch is done. Returns null if unconfigured.
 */
export type MailSender = {
  send: (opts: { to: string; subject: string; html: string; text?: string; attachments?: MailAttachment[] }) => Promise<void>
  close: () => void
}

export async function getMailSender(): Promise<MailSender | null> {
  const cfg = await getMailConfig()
  if (!cfg) return null
  const transport = createTransport(cfg, { pool: true })
  const from = formatFrom(cfg)
  return {
    send: async (opts) => {
      await transport.sendMail({
        from,
        to: opts.to,
        replyTo: cfg.replyTo,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        attachments: opts.attachments,
      })
    },
    close: () => transport.close(),
  }
}

/** Verifies the SMTP connection/credentials without sending anything. */
export async function verifyMailConnection(): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getMailConfig()
  if (!cfg) return { ok: false, error: 'not_configured' }
  try {
    await createTransport(cfg).verify()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'verify_failed' }
  }
}

export async function sendMail(opts: {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: MailAttachment[]
}): Promise<void> {
  const cfg = await getMailConfig()
  if (!cfg) throw new Error('Mail is not configured')

  await createTransport(cfg).sendMail({
    from: formatFrom(cfg),
    to: opts.to,
    replyTo: cfg.replyTo,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments,
  })
}
