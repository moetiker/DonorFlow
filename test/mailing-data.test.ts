import { test } from 'node:test'
import assert from 'node:assert/strict'
import { useTestDb as openTestDb, resetDb, seedBasics } from './helpers/test-db'

// lib/db reads DATABASE_URL at import time, so the module under test is
// imported only after openTestDb() has pointed it at the test database.
const dbReady = openTestDb()
const modules = dbReady.then(() => import('../lib/mailing-data'))

async function setup() {
  const prisma = await dbReady
  await resetDb(prisma)
  const basics = await seedBasics(prisma)
  return { prisma, ...basics, ...(await modules) }
}

test('a shared sponsor shows only this member\'s amount', async () => {
  const { prisma, memberSolo, memberA1, groupA, fy, buildMemberMailData } = await setup()
  const s = await prisma.sponsor.create({ data: { firstName: 'Berta', lastName: 'Both' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberSolo.id } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, groupId: groupA.id } })
  const base = { sponsorId: s.id, amount: 50, donationDate: new Date(), fiscalYearId: fy.id }
  await prisma.donation.create({ data: { ...base, memberId: memberSolo.id } })
  await prisma.donation.create({ data: { ...base, groupId: groupA.id } })

  const solo = await buildMemberMailData(memberSolo.id, fy.id)
  assert.ok(solo)
  assert.equal(solo.sponsors.length, 1)
  assert.equal(solo.sponsors[0].currentYearAmount, 50)
  assert.equal(solo.progress.collected, 50)

  const grouped = await buildMemberMailData(memberA1.id, fy.id)
  assert.ok(grouped)
  assert.equal(grouped.sponsors.length, 1)
  assert.equal(grouped.sponsors[0].currentYearAmount, 50)
  assert.equal(grouped.progress.collected, 50)
})

test('a grouped member\'s mail lists only group sponsors', async () => {
  const { prisma, memberA1, memberA2, fy, buildMemberMailData } = await setup()
  const s = await prisma.sponsor.create({ data: { firstName: 'Max', lastName: 'Only' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberA1.id } })

  const data = await buildMemberMailData(memberA2.id, fy.id)
  assert.ok(data)
  assert.equal(data.sponsors.length, 0)
})
