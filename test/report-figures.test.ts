import { test } from 'node:test'
import assert from 'node:assert/strict'
import { useTestDb as openTestDb, resetDb, seedBasics } from './helpers/test-db'
import { memberActual, groupActual, unassignedActual, clubFigures } from '../lib/report-figures'

// Admin figures count donations by their own recipient, never by the
// sponsor's assignments.
const dbReady = openTestDb()

async function fresh() {
  const prisma = await dbReady
  await resetDb(prisma)
  return { prisma, ...(await seedBasics(prisma)) }
}

test('group actual includes member-credited donations', async () => {
  const { prisma, groupA, memberA1, memberSolo, fy } = await fresh()
  const s = await prisma.sponsor.create({ data: { lastName: 'Total' } })
  const base = { sponsorId: s.id, donationDate: new Date(), fiscalYearId: fy.id }
  await prisma.donation.create({ data: { ...base, amount: 50, groupId: groupA.id } })
  await prisma.donation.create({ data: { ...base, amount: 30, memberId: memberA1.id } })
  await prisma.donation.create({ data: { ...base, amount: 99, memberId: memberSolo.id } })
  assert.equal(await groupActual(prisma, groupA.id, fy.id), 80)
  assert.equal(await memberActual(prisma, memberSolo.id, fy.id), 99)
  assert.equal(await memberActual(prisma, memberA1.id, fy.id), 30)
})

test('a donation credited away from the sponsor\'s recipient counts for the credited one', async () => {
  const { prisma, groupA, memberSolo, fy } = await fresh()
  const s = await prisma.sponsor.create({ data: { lastName: 'Away' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, groupId: groupA.id } })
  await prisma.donation.create({
    data: { sponsorId: s.id, amount: 25, donationDate: new Date(), fiscalYearId: fy.id, memberId: memberSolo.id }
  })
  assert.equal(await memberActual(prisma, memberSolo.id, fy.id), 25)
  assert.equal(await groupActual(prisma, groupA.id, fy.id), 0)
})

test('type filter', async () => {
  const { prisma, groupA, memberSolo, fy } = await fresh()
  const s = await prisma.sponsor.create({ data: { lastName: 'Kind' } })
  const base = { sponsorId: s.id, donationDate: new Date(), fiscalYearId: fy.id }
  await prisma.donation.create({ data: { ...base, amount: 40, memberId: memberSolo.id } })
  await prisma.donation.create({
    data: { ...base, type: 'IN_KIND', amount: null, description: 'Cake', memberId: memberSolo.id }
  })
  await prisma.donation.create({
    data: { ...base, type: 'IN_KIND', amount: null, description: 'Wine', groupId: groupA.id }
  })
  assert.equal(await memberActual(prisma, memberSolo.id, fy.id, 'MONETARY'), 40)
  assert.equal(await groupActual(prisma, groupA.id, fy.id, 'MONETARY'), 0)
  assert.equal(await memberActual(prisma, memberSolo.id, fy.id), 40)
})

test('only donations of the given fiscal year count', async () => {
  const { prisma, memberSolo, fy } = await fresh()
  const other = await prisma.fiscalYear.create({
    data: { name: 'Old', startDate: new Date('2000-01-01'), endDate: new Date('2000-12-31') }
  })
  const s = await prisma.sponsor.create({ data: { lastName: 'Year' } })
  const base = { sponsorId: s.id, memberId: memberSolo.id }
  await prisma.donation.create({ data: { ...base, amount: 10, donationDate: new Date(), fiscalYearId: fy.id } })
  await prisma.donation.create({
    data: { ...base, amount: 70, donationDate: new Date('2000-06-01'), fiscalYearId: other.id }
  })
  assert.equal(await memberActual(prisma, memberSolo.id, fy.id), 10)
  assert.equal(await memberActual(prisma, memberSolo.id, other.id), 70)
})

test('unassigned actual counts only donations without a recipient', async () => {
  const { prisma, memberSolo, fy } = await fresh()
  const s = await prisma.sponsor.create({ data: { lastName: 'Lost' } })
  const base = { sponsorId: s.id, donationDate: new Date(), fiscalYearId: fy.id }
  await prisma.donation.create({ data: { ...base, amount: 15 } })
  await prisma.donation.create({ data: { ...base, amount: 5, memberId: memberSolo.id } })
  assert.equal(await unassignedActual(prisma, fy.id), 15)
  assert.equal(await unassignedActual(prisma, fy.id, 'IN_KIND'), 0)
})

test('a donation credited to a dissolved group still counts in the club-level actual', async () => {
  const { prisma, groupA, memberA1, memberSolo, fy } = await fresh()
  const s = await prisma.sponsor.create({ data: { lastName: 'Club' } })
  const base = { sponsorId: s.id, donationDate: new Date(), fiscalYearId: fy.id }
  await prisma.donation.create({ data: { ...base, amount: 60, groupId: groupA.id } })
  await prisma.donation.create({ data: { ...base, amount: 30, memberId: memberA1.id } })
  await prisma.donation.create({ data: { ...base, amount: 10, memberId: memberSolo.id } })
  await prisma.donation.create({ data: { ...base, amount: 5 } })
  const before = await clubFigures(prisma, fy.id, 'MONETARY')
  assert.deepEqual(before, { memberActual: 10, groupActual: 90, unassignedTotal: 5, totalActual: 105 })

  // Dissolve groupA: its members leave, its donations stay credited to it
  await prisma.member.updateMany({ where: { groupId: groupA.id }, data: { groupId: null } })
  await prisma.group.update({ where: { id: groupA.id }, data: { dissolvedAt: new Date() } })
  const after = await clubFigures(prisma, fy.id, 'MONETARY')
  assert.equal(after.totalActual, 105)
  assert.equal(after.groupActual, 60)
  assert.equal(after.memberActual, 40)
})
