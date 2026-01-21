import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { generateStatusToken } from './tokens'

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createExtendedPrisma> | undefined
}

// Configure adapter with timestampFormat for backward compatibility
// The existing database stores timestamps as Unix epoch milliseconds
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db'
}, {
  timestampFormat: 'unixepoch-ms'
})

function createExtendedPrisma() {
  const basePrisma = new PrismaClient({ adapter })

  return basePrisma.$extends({
    query: {
      member: {
        async create({ args, query }) {
          // TOKEN-02: Only members WITHOUT a group get a statusToken
          if (!args.data.groupId && !args.data.statusToken) {
            args.data.statusToken = generateStatusToken()
          }
          return query(args)
        },
      },
      group: {
        async create({ args, query }) {
          // TOKEN-01: All groups get a statusToken
          if (!args.data.statusToken) {
            args.data.statusToken = generateStatusToken()
          }
          return query(args)
        },
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createExtendedPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
