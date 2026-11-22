/**
 * One-off migration: assign sponsors without any recipient to the club pool.
 *
 * An orphaned sponsor appears on no status page. Its donations are not touched:
 * every donation keeps its own fixed recipient.
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
    where: { assignments: { none: {} } },
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
  console.log(`Their donations: ${stranded.length} (CHF ${total}) — they keep their own recipients and are not modified.`)

  const created = await prisma.sponsorAssignment.createMany({
    data: orphanedSponsors.map((s) => ({ sponsorId: s.id, groupId: pool.id }))
  })

  console.log(`\nMoved ${created.count} sponsors to ${pool.name}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
