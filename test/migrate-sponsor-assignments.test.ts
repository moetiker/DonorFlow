import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useTestDb, resetDb, seedBasics } from './helpers/test-db'
import { compareTotals, migrateSponsorAssignments } from '../lib/migrate-sponsor-assignments'

type Prisma = Awaited<ReturnType<typeof useTestDb>>
let prisma: Prisma
let basics: Awaited<ReturnType<typeof seedBasics>>

before(async () => {
  prisma = await useTestDb()
})

beforeEach(async () => {
  await resetDb(prisma)
  basics = await seedBasics(prisma)
})

test('creates one assignment per legacy owner and fills recipient-less donations', async () => {
  const { memberSolo, fy } = basics
  const s = await prisma.sponsor.create({ data: { lastName: 'Legacy', memberId: memberSolo.id } })
  const d = await prisma.donation.create({
    data: { sponsorId: s.id, amount: 40, donationDate: new Date(), fiscalYearId: fy.id }
  })

  const result = await migrateSponsorAssignments(prisma)

  assert.equal(result.status, 'migrated')
  const assignments = await prisma.sponsorAssignment.findMany({ where: { sponsorId: s.id } })
  assert.equal(assignments.length, 1)
  assert.equal(assignments[0].memberId, memberSolo.id)
  assert.equal(assignments[0].groupId, null)
  const after = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })
  assert.equal(after.memberId, memberSolo.id)
  assert.equal(after.groupId, null)
})

test('keeps explicit donation recipients and adds no assignment for them', async () => {
  const { groupA, memberSolo, fy } = basics
  const s = await prisma.sponsor.create({ data: { lastName: 'Group', groupId: groupA.id } })
  const d = await prisma.donation.create({
    data: {
      sponsorId: s.id,
      amount: 25,
      donationDate: new Date(),
      fiscalYearId: fy.id,
      memberId: memberSolo.id
    }
  })

  const result = await migrateSponsorAssignments(prisma)

  assert.equal(result.status, 'migrated')
  const after = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })
  assert.equal(after.memberId, memberSolo.id)
  assert.equal(after.groupId, null)
  const assignments = await prisma.sponsorAssignment.findMany({ where: { sponsorId: s.id } })
  assert.equal(assignments.length, 1)
  assert.equal(assignments[0].groupId, groupA.id)
  assert.equal(assignments[0].memberId, null)
})

test('merges a duplicate pair into the kept record', async () => {
  const { groupA, memberSolo, fy } = basics
  const kept = await prisma.sponsor.create({
    data: { firstName: 'Berta', lastName: 'Muster1', city: 'Musterstadt', groupId: groupA.id }
  })
  const merged = await prisma.sponsor.create({
    data: { lastName: 'Muster2', street: 'Weg 1', notes: 'Testnotiz', memberId: memberSolo.id }
  })
  const base = { amount: 10, donationDate: new Date(), fiscalYearId: fy.id }
  const dKept = await prisma.donation.create({ data: { ...base, sponsorId: kept.id } })
  const dMerged = await prisma.donation.create({ data: { ...base, sponsorId: merged.id } })

  const result = await migrateSponsorAssignments(prisma, [{ keepId: kept.id, mergeId: merged.id }])

  assert.deepEqual(result, {
    status: 'migrated',
    assignmentsCreated: 2,
    donationsFilled: 2,
    sponsorsMerged: 1
  })
  const after = await prisma.sponsor.findUniqueOrThrow({
    where: { id: kept.id },
    include: { assignments: true, donations: true }
  })
  assert.equal(after.firstName, 'Berta')
  assert.equal(after.lastName, 'Muster')
  assert.equal(after.city, 'Musterstadt')
  assert.equal(after.street, 'Weg 1')
  assert.ok(after.notes?.includes('Testnotiz'))
  assert.equal(after.assignments.length, 2)
  assert.deepEqual(
    after.assignments.map(a => a.groupId ?? a.memberId).sort(),
    [groupA.id, memberSolo.id].sort()
  )
  assert.equal(after.donations.length, 2)
  const byId = new Map(after.donations.map(d => [d.id, d]))
  assert.equal(byId.get(dKept.id)?.groupId, groupA.id)
  assert.equal(byId.get(dKept.id)?.memberId, null)
  assert.equal(byId.get(dMerged.id)?.memberId, memberSolo.id)
  assert.equal(byId.get(dMerged.id)?.groupId, null)
  assert.equal(await prisma.sponsor.findUnique({ where: { id: merged.id } }), null)
})

test('second run is skipped', async () => {
  const { groupA, memberSolo } = basics
  const s = await prisma.sponsor.create({ data: { lastName: 'Twice', groupId: groupA.id } })
  await prisma.donation.create({ data: { sponsorId: s.id, amount: 5, donationDate: new Date() } })
  await prisma.donation.create({
    data: { sponsorId: s.id, amount: 7, donationDate: new Date(), memberId: memberSolo.id }
  })

  const first = await migrateSponsorAssignments(prisma)
  assert.equal(first.status, 'migrated')
  const second = await migrateSponsorAssignments(prisma)
  assert.deepEqual(second, { status: 'skipped' })
})

test('compareTotals reports a changed total', () => {
  assert.deepEqual(compareTotals(new Map([['member:a:fy', 50]]), new Map()), [
    { key: 'member:a:fy', before: 50, after: 0 }
  ])
  assert.deepEqual(
    compareTotals(new Map([['member:a:fy', 50]]), new Map([['member:a:fy', 50]])),
    []
  )
})
