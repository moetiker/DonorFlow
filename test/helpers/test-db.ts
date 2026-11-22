import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

type Prisma = typeof import('../../lib/db').prisma

const templates = new Map<string, string>()
let workDir: string | undefined

function getWorkDir(): string {
  if (!workDir) {
    const base = process.env.TMPDIR || tmpdir()
    mkdirSync(base, { recursive: true })
    workDir = mkdtempSync(join(base, 'donorflow-test-'))
  }
  return workDir
}

/** Creates (once per process and path) a database with the current schema pushed. */
function ensureTemplate(templatePath: string): string {
  if (!templates.has(templatePath) && !existsSync(templatePath)) {
    // prisma.config.ts is gitignored, so write a self-contained config instead
    const configPath = join(getWorkDir(), 'prisma.test.config.mjs')
    const schema = resolve(__dirname, '../../prisma/schema.prisma')
    writeFileSync(
      configPath,
      `export default { schema: ${JSON.stringify(schema)}, datasource: { url: process.env.DATABASE_URL } }\n`
    )
    execFileSync('npx', ['prisma', 'db', 'push', '--config', configPath], {
      env: { ...process.env, DATABASE_URL: 'file:' + templatePath },
      stdio: 'pipe'
    })
  }
  templates.set(templatePath, templatePath)
  return templatePath
}

/**
 * Gives the calling test file its own throw-away database. Call once per test
 * file: lib/db reads DATABASE_URL at import time, and node runs each test file
 * in its own process.
 */
export async function useTestDb(): Promise<Prisma> {
  const dir = getWorkDir()
  const template = ensureTemplate(join(dir, 'template.db'))
  const dbPath = join(dir, 'test.db')
  copyFileSync(template, dbPath)
  process.env.DATABASE_URL = 'file:' + dbPath
  const { prisma } = await import('../../lib/db')
  return prisma
}

/** Deletes all rows of all models, children before parents. */
export async function resetDb(prisma: Prisma): Promise<void> {
  await prisma.donation.deleteMany()
  await prisma.sponsorAssignment.deleteMany()
  await prisma.sponsor.deleteMany()
  await prisma.memberTarget.deleteMany()
  await prisma.donorLetter.deleteMany()
  await prisma.mailJob.deleteMany()
  await prisma.member.deleteMany()
  await prisma.group.deleteMany()
  await prisma.fiscalYear.deleteMany()
  await prisma.user.deleteMany()
  await prisma.setting.deleteMany()
}

/** Seeds a club pool, a group with two members, an ungrouped member and a current fiscal year. */
export async function seedBasics(prisma: Prisma) {
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const fy = await prisma.fiscalYear.create({
    data: {
      name: 'Test FY',
      startDate: new Date(now - 180 * day),
      endDate: new Date(now + 180 * day)
    }
  })
  const pool = await prisma.group.create({ data: { name: 'Club', isClubPool: true } })
  const groupA = await prisma.group.create({ data: { name: 'Group A' } })
  const memberA1 = await prisma.member.create({
    data: { firstName: 'Anna', lastName: 'Alpha', groupId: groupA.id }
  })
  const memberA2 = await prisma.member.create({
    data: { firstName: 'Armin', lastName: 'Alpha', groupId: groupA.id }
  })
  const memberSolo = await prisma.member.create({ data: { firstName: 'Sol', lastName: 'Solo' } })
  return { pool, groupA, memberA1, memberA2, memberSolo, fy }
}
