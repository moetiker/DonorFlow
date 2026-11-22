import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useTestDb, resetDb, seedBasics } from './helpers/test-db'
import {
  compareTotals,
  migrateSponsorAssignments,
  MIGRATION_MARKER_KEY
} from '../lib/migrate-sponsor-assignments'

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
  const s = await prisma.sponsor.create({ data: { lastName: 'Legacy', legacyMemberId: memberSolo.id } })
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
  const s = await prisma.sponsor.create({ data: { lastName: 'Group', legacyGroupId: groupA.id } })
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
    data: { firstName: 'Berta', lastName: 'Muster1', city: 'Musterstadt', legacyGroupId: groupA.id }
  })
  const merged = await prisma.sponsor.create({
    data: { lastName: 'Muster2', street: 'Weg 1', notes: 'Testnotiz', legacyMemberId: memberSolo.id }
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
  const s = await prisma.sponsor.create({ data: { lastName: 'Twice', legacyGroupId: groupA.id } })
  await prisma.donation.create({ data: { sponsorId: s.id, amount: 5, donationDate: new Date() } })
  await prisma.donation.create({
    data: { sponsorId: s.id, amount: 7, donationDate: new Date(), memberId: memberSolo.id }
  })

  const first = await migrateSponsorAssignments(prisma)
  assert.equal(first.status, 'migrated')
  const second = await migrateSponsorAssignments(prisma)
  assert.deepEqual(second, { status: 'skipped' })
})

test('a removed assignment is not re-created on the next run', async () => {
  const { groupA } = basics
  const s = await prisma.sponsor.create({ data: { lastName: 'Removed', legacyGroupId: groupA.id } })
  await prisma.donation.create({ data: { sponsorId: s.id, amount: 5, donationDate: new Date() } })

  assert.equal((await migrateSponsorAssignments(prisma)).status, 'migrated')
  assert.ok(await prisma.setting.findUnique({ where: { key: MIGRATION_MARKER_KEY } }))

  // The legacy column still points at groupA, as it does during deployment 1.
  await prisma.sponsorAssignment.deleteMany({ where: { sponsorId: s.id } })
  const second = await migrateSponsorAssignments(prisma)

  assert.deepEqual(second, { status: 'skipped' })
  assert.equal(await prisma.sponsorAssignment.count({ where: { sponsorId: s.id } }), 0)
})

test('a recipient-less donation of an owner-less sponsor goes to the club pool', async t => {
  const { pool, fy } = basics
  const warn = t.mock.method(console, 'warn', () => {})
  const s = await prisma.sponsor.create({ data: { lastName: 'Ownerless' } })
  const d = await prisma.donation.create({
    data: { sponsorId: s.id, amount: 15, donationDate: new Date(), fiscalYearId: fy.id }
  })

  const result = await migrateSponsorAssignments(prisma)

  assert.equal(result.status, 'migrated')
  const after = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })
  assert.equal(after.groupId, pool.id)
  assert.equal(after.memberId, null)
  assert.equal(await prisma.sponsorAssignment.count({ where: { sponsorId: s.id } }), 0)
  assert.equal(warn.mock.callCount(), 1)
  assert.match(String(warn.mock.calls[0].arguments[0]), new RegExp(d.id))
})

test('a changed total rolls everything back and writes no marker', async () => {
  const { groupA, fy } = basics
  const s = await prisma.sponsor.create({ data: { lastName: 'Rollback', legacyGroupId: groupA.id } })
  const d = await prisma.donation.create({
    data: { sponsorId: s.id, amount: 20, donationDate: new Date(), fiscalYearId: fy.id }
  })
  // Fault injection: filling the recipient also bumps the amount.
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER bump_amount AFTER UPDATE OF groupId ON Donation ' +
      'BEGIN UPDATE Donation SET amount = amount + 1 WHERE id = NEW.id; END'
  )
  try {
    const result = await migrateSponsorAssignments(prisma)

    assert.deepEqual(result, {
      status: 'rolledBack',
      diffs: [{ key: `group:${groupA.id}:${fy.id}`, before: 20, after: 21 }]
    })
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER bump_amount')
  }
  const after = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })
  assert.equal(after.amount, 20)
  assert.equal(after.groupId, null)
  assert.equal(await prisma.sponsorAssignment.count(), 0)
  assert.equal(await prisma.setting.findUnique({ where: { key: MIGRATION_MARKER_KEY } }), null)
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
