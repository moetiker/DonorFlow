/**
 * One-off migration: assign sponsors that lost their owner to the club pool.
 *
 * These sponsors were orphaned by member deletions — Sponsor.memberId uses
 * onDelete: SetNull, so deleting a member left the sponsor with no owner. An
 * orphaned sponsor appears on no status page, and its donations count towards no
 * target either, because donations are credited through their sponsor.
 *
 * Donations are deliberately NOT touched. Donation.memberId/groupId are optional
 * overrides; NULL means "credit to whoever owns the sponsor". 98 donations have
 * both fields null and only 3 of them belong to an orphaned sponsor — moving them
 * all would take CHF 6'555 away from 24 members and groups. Once the sponsor
 * belongs to the pool, its donations follow on their own.
 *
 * Run with: npm run db:migrate-orphans
 */
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db'
}, {
  timestampFormat: 'unixepoch-ms'
})

const prisma = new PrismaClient({ adapter })

async function main() {
  const pool = await prisma.group.findFirst({
    where: { isClubPool: true },
    select: { id: true, name: true }
  })

  if (!pool) {
    throw new Error('No group is marked as the club pool — set isClubPool first')
  }

  const orphanedSponsors = await prisma.sponsor.findMany({
    where: { memberId: null, groupId: null },
    select: {
      id: true, company: true, firstName: true, lastName: true,
      donations: { select: { amount: true } }
    }
  })

  const stranded = orphanedSponsors.flatMap((s) => s.donations)
  const total = stranded.reduce((sum, d) => sum + (d.amount ?? 0), 0)

  console.log(`Club pool: ${pool.name}`)
  console.log(`Orphaned sponsors: ${orphanedSponsors.length}`)
  for (const s of orphanedSponsors) {
    console.log(`  - ${s.company ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()}`)
  }
  console.log(`Their stranded donations: ${stranded.length} (CHF ${total}) — these start counting again once the sponsor has an owner; they are not modified.`)

  const sponsors = await prisma.sponsor.updateMany({
    where: { memberId: null, groupId: null },
    data: { groupId: pool.id }
  })

  console.log(`\nMoved ${sponsors.count} sponsors to ${pool.name}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
