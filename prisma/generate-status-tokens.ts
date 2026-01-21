import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { generateStatusToken } from '../lib/tokens'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db'
}, {
  timestampFormat: 'unixepoch-ms'
})

const prisma = new PrismaClient({ adapter })

/**
 * Backfill script to generate status tokens for existing records
 * - All groups get tokens (TOKEN-01)
 * - Only members WITHOUT a group get tokens (TOKEN-02)
 */
async function main() {
  console.log('Generating status tokens for existing records...')

  // Generate tokens for all groups without one
  const groups = await prisma.group.findMany({
    where: { statusToken: null }
  })

  for (const group of groups) {
    await prisma.group.update({
      where: { id: group.id },
      data: { statusToken: generateStatusToken() }
    })
  }
  console.log(`Generated tokens for ${groups.length} groups`)

  // Generate tokens for members WITHOUT a group
  const members = await prisma.member.findMany({
    where: {
      statusToken: null,
      groupId: null  // Only ungrouped members get tokens
    }
  })

  for (const member of members) {
    await prisma.member.update({
      where: { id: member.id },
      data: { statusToken: generateStatusToken() }
    })
  }
  console.log(`Generated tokens for ${members.length} ungrouped members`)

  console.log('\nBackfill complete!')
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
