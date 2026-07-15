import { prisma } from './db'
import { generateStatusToken } from './tokens'

/**
 * Backfill status tokens for existing records that predate token generation.
 * - All groups get a token (TOKEN-01)
 * - Only members WITHOUT a group get a token (TOKEN-02)
 *
 * Runs on server startup (see instrumentation.ts). New records already receive
 * a token automatically via the Prisma query extension in lib/db, so this is a
 * one-time safety net for legacy data and a no-op once every record has one.
 */
export async function backfillStatusTokens(): Promise<void> {
  const groups = await prisma.group.findMany({
    where: { statusToken: null },
    select: { id: true },
  })
  for (const group of groups) {
    await prisma.group.update({
      where: { id: group.id },
      data: { statusToken: generateStatusToken() },
    })
  }

  const members = await prisma.member.findMany({
    where: { statusToken: null, groupId: null },
    select: { id: true },
  })
  for (const member of members) {
    await prisma.member.update({
      where: { id: member.id },
      data: { statusToken: generateStatusToken() },
    })
  }

  if (groups.length || members.length) {
    console.log(
      `Status token backfill: ${groups.length} groups, ${members.length} ungrouped members`
    )
  }
}
