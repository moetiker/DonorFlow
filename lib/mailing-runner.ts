import { prisma } from './db'
import { buildMemberMailData, mailCsvFilename } from './mailing-data'
import { renderStatusEmail } from './email-template'
import { sendMail } from './mail'

// Throttling: send in batches with a pause between batches so the mail server
// is not hit too hard.
export const MAIL_BATCH_SIZE = 5
export const MAIL_BATCH_DELAY_MS = 2 * 60 * 1000 // 2 minutes

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type MailJobResult = {
  memberId: string
  name?: string
  email?: string | null
  status: 'sent' | 'skipped' | 'failed'
  error?: string
}

type LetterAttachment = { fileName: string; mimeType: string; data: Buffer }

/**
 * Runs a mail job in the background: sends one personalized email per member,
 * MAIL_BATCH_SIZE at a time, pausing MAIL_BATCH_DELAY_MS between batches.
 * Progress is written to the MailJob row so the UI can poll it. Intended to be
 * called fire-and-forget from the send route (the Node server stays alive).
 */
export async function runMailJob(opts: {
  jobId: string
  fiscalYearId: string
  fiscalYearName: string
  memberIds: string[]
  baseUrl: string
  orgName: string
  letter: LetterAttachment
}): Promise<void> {
  const { jobId, fiscalYearId, fiscalYearName, memberIds, baseUrl, orgName, letter } = opts
  const results: MailJobResult[] = []

  for (let i = 0; i < memberIds.length; i++) {
    results.push(await sendToMember(memberIds[i], { fiscalYearId, fiscalYearName, baseUrl, orgName, letter }))

    await prisma.mailJob.update({
      where: { id: jobId },
      data: { processed: results.length, results: JSON.stringify(results) },
    }).catch(() => {})

    // Pause after a full batch, unless there is nothing left to send
    const isBatchBoundary = (i + 1) % MAIL_BATCH_SIZE === 0
    if (isBatchBoundary && i + 1 < memberIds.length) {
      await sleep(MAIL_BATCH_DELAY_MS)
    }
  }

  await prisma.mailJob.update({
    where: { id: jobId },
    data: { status: 'done', processed: results.length, results: JSON.stringify(results) },
  }).catch(() => {})
}

async function sendToMember(
  memberId: string,
  ctx: { fiscalYearId: string; fiscalYearName: string; baseUrl: string; orgName: string; letter: LetterAttachment }
): Promise<MailJobResult> {
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

    await sendMail({
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
