import { prisma } from './db'
import { buildMemberMailData, getOrgName, mailCsvFilename } from './mailing-data'
import { renderStatusEmail } from './email-template'
import { getMailSender, getMailRatePerMinute, type MailSender } from './mail'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type MailJobResult = {
  memberId: string
  name?: string
  email?: string | null
  status: 'sent' | 'skipped' | 'failed'
  error?: string
}

/**
 * Runs (or resumes) a mail job in the background. Loads all context from the
 * MailJob row, so it can be called both when the job is created and again on
 * server startup to resume an interrupted job — it continues from `processed`,
 * so already-sent recipients are never emailed twice.
 *
 * Throttled to the configured rate (emails per minute) over a single pooled
 * SMTP connection. Progress is written to the row after each recipient.
 * Fire-and-forget; the Node server stays alive.
 */
export async function runMailJob(jobId: string): Promise<void> {
  const job = await prisma.mailJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'running') return

  const memberIds = safeParse<string[]>(job.memberIds, [])
  const results = safeParse<MailJobResult[]>(job.results, [])
  const startIndex = results.length // = processed; resume point

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: job.fiscalYearId },
    select: { name: true },
  })
  const letter = await prisma.donorLetter.findUnique({ where: { fiscalYearId: job.fiscalYearId } })
  const sender = await getMailSender()

  if (!fiscalYear || !letter || !sender) {
    await setStatus(jobId, 'failed', results)
    sender?.close()
    return
  }

  const ctx = {
    fiscalYearId: job.fiscalYearId,
    fiscalYearName: fiscalYear.name,
    baseUrl: job.baseUrl || process.env.NEXTAUTH_URL || '',
    orgName: await getOrgName(),
    letter: { fileName: letter.fileName, mimeType: letter.mimeType, data: Buffer.from(letter.data) },
  }

  // Throttle: pause 60s / rate between consecutive emails
  const ratePerMinute = await getMailRatePerMinute()
  const delayMs = Math.max(0, Math.round(60_000 / ratePerMinute))

  try {
    for (let i = startIndex; i < memberIds.length; i++) {
      results.push(await sendToMember(sender, memberIds[i], ctx))
      await prisma.mailJob
        .update({ where: { id: jobId }, data: { processed: results.length, results: JSON.stringify(results) } })
        .catch(() => {})

      if (i + 1 < memberIds.length) {
        await sleep(delayMs)
      }
    }
    await setStatus(jobId, 'done', results)
  } catch {
    // Unexpected error (DB, transport) — mark failed, keep partial results
    await setStatus(jobId, 'failed', results)
  } finally {
    sender.close()
  }
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

async function setStatus(jobId: string, status: 'done' | 'failed', results: MailJobResult[]): Promise<void> {
  await prisma.mailJob
    .update({ where: { id: jobId }, data: { status, processed: results.length, results: JSON.stringify(results) } })
    .catch(() => {})
}

type SendCtx = {
  fiscalYearId: string
  fiscalYearName: string
  baseUrl: string
  orgName: string
  letter: { fileName: string; mimeType: string; data: Buffer }
}

async function sendToMember(sender: MailSender, memberId: string, ctx: SendCtx): Promise<MailJobResult> {
  const data = await buildMemberMailData(memberId, ctx.fiscalYearId)
  if (!data) return { memberId, status: 'failed', error: 'not_found' }
  if (!data.email) return { memberId, name: data.memberName, status: 'skipped', error: 'no_email' }

  try {
    const email = renderStatusEmail({
      firstName: data.memberFirstName,
      orgName: ctx.orgName,
      fiscalYearName: ctx.fiscalYearName,
      statusUrl: `${ctx.baseUrl}/s/${data.statusToken}`,
      progress: data.progress,
      sponsors: data.sponsors,
      previousYearName: data.previousYearName,
      groupInfo: data.groupInfo,
      attachmentsNote: true,
      locale: 'de',
    })

    await sender.send({
      to: data.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: [
        { filename: ctx.letter.fileName, content: ctx.letter.data, contentType: ctx.letter.mimeType },
        { filename: mailCsvFilename(data.displayName), content: Buffer.from(data.csvContent, 'utf-8'), contentType: 'text/csv; charset=utf-8' },
      ],
    })
    return { memberId, name: data.memberName, email: data.email, status: 'sent' }
  } catch (error) {
    return {
      memberId,
      name: data.memberName,
      email: data.email,
      status: 'failed',
      error: error instanceof Error ? error.message : 'send_failed',
    }
  }
}

/** Resume any job left in the "running" state (e.g. after a restart). */
export async function resumeRunningMailJobs(): Promise<void> {
  const running = await prisma.mailJob.findMany({ where: { status: 'running' }, select: { id: true } })
  for (const job of running) {
    void runMailJob(job.id).catch(() => {})
  }
}
