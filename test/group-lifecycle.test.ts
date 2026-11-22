import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useTestDb, resetDb, seedBasics } from './helpers/test-db'
import { ClubPoolLockedError } from '../lib/club-pool'
import {
  dissolveGroup,
  moveMemberSponsorsToGroup,
  GroupAlreadyDissolvedError,
  NotAGroupMemberError,
  type DissolvePlan
} from '../lib/sponsor-assignments'

type Prisma = Awaited<ReturnType<typeof useTestDb>>
let prisma: Prisma

before(async () => {
  prisma = await useTestDb()
})

beforeEach(async () => {
  await resetDb(prisma)
})

function dissolve(groupId: string, plan: DissolvePlan) {
  return prisma.$transaction(tx => dissolveGroup(tx, groupId, plan))
}

async function assignmentsOf(sponsorId: string) {
  return prisma.sponsorAssignment.findMany({
    where: { sponsorId },
    select: { memberId: true, groupId: true }
  })
}

test("joining a group moves the member's sponsors when asked", async () => {
  const { groupA, memberSolo } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Beispiel' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberSolo.id } })
  const d = await prisma.donation.create({
    data: { sponsorId: s.id, amount: 40, donationDate: new Date(), memberId: memberSolo.id }
  })

  const moved = await prisma.$transaction(tx => moveMemberSponsorsToGroup(tx, memberSolo.id, groupA.id))

  assert.equal(moved, 1)
  assert.deepEqual(await assignmentsOf(s.id), [{ memberId: null, groupId: groupA.id }])
  const donation = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })
  assert.equal(donation.memberId, memberSolo.id)
  assert.equal(donation.groupId, null)
})

test('joining a group does not duplicate an existing group assignment', async () => {
  const { groupA, memberSolo } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Both' } })
  await prisma.sponsorAssignment.createMany({
    data: [
      { sponsorId: s.id, memberId: memberSolo.id },
      { sponsorId: s.id, groupId: groupA.id }
    ]
  })

  await prisma.$transaction(tx => moveMemberSponsorsToGroup(tx, memberSolo.id, groupA.id))

  assert.deepEqual(await assignmentsOf(s.id), [{ memberId: null, groupId: groupA.id }])
})

test('dissolving hands sponsors to the chosen members and keeps the history', async () => {
  const { pool, groupA, memberA1, memberA2 } = await seedBasics(prisma)
  const s1 = await prisma.sponsor.create({ data: { lastName: 'One' } })
  const s2 = await prisma.sponsor.create({ data: { lastName: 'Two' } })
  await prisma.sponsorAssignment.createMany({
    data: [
      { sponsorId: s1.id, groupId: groupA.id },
      { sponsorId: s2.id, groupId: groupA.id }
    ]
  })
  const d = await prisma.donation.create({
    data: { sponsorId: s1.id, amount: 50, donationDate: new Date(), groupId: groupA.id }
  })

  const result = await dissolve(groupA.id, [
    { sponsorId: s1.id, memberIds: [memberA1.id, memberA2.id] },
    { sponsorId: s2.id, memberIds: [] }
  ])

  assert.deepEqual(result, { assignmentsCreated: 2, sponsorsToPool: 1 })
  const s1Members = (await assignmentsOf(s1.id)).map(a => a.memberId).sort()
  assert.deepEqual(s1Members, [memberA1.id, memberA2.id].sort())
  assert.deepEqual(await assignmentsOf(s2.id), [{ memberId: null, groupId: pool.id }])
  assert.equal(await prisma.sponsorAssignment.count({ where: { groupId: groupA.id } }), 0)
  for (const m of [memberA1, memberA2]) {
    const member = await prisma.member.findUniqueOrThrow({ where: { id: m.id } })
    assert.equal(member.groupId, null)
  }
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupA.id } })
  assert.notEqual(group.dissolvedAt, null)
  const donation = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })
  assert.equal(donation.groupId, groupA.id)
  assert.equal(donation.amount, 50)
})

test('a sponsor missing from the plan goes to the pool', async () => {
  const { pool, groupA } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Forgotten' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, groupId: groupA.id } })

  const result = await dissolve(groupA.id, [])

  assert.deepEqual(result, { assignmentsCreated: 0, sponsorsToPool: 1 })
  assert.deepEqual(await assignmentsOf(s.id), [{ memberId: null, groupId: pool.id }])
})

test('an unticked sponsor that keeps another assignment does not go to the pool', async () => {
  const { groupA, memberA1, memberSolo } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Elsewhere' } })
  await prisma.sponsorAssignment.createMany({
    data: [
      { sponsorId: s.id, groupId: groupA.id },
      { sponsorId: s.id, memberId: memberSolo.id }
    ]
  })
  const s2 = await prisma.sponsor.create({ data: { lastName: 'Kept' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s2.id, groupId: groupA.id } })

  const result = await dissolve(groupA.id, [
    { sponsorId: s.id, memberIds: [] },
    { sponsorId: s2.id, memberIds: [memberA1.id] }
  ])

  assert.deepEqual(result, { assignmentsCreated: 1, sponsorsToPool: 0 })
  assert.deepEqual(await assignmentsOf(s.id), [{ memberId: memberSolo.id, groupId: null }])
})

test('a ticked member the sponsor already has is not duplicated', async () => {
  const { groupA, memberA1 } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Already' } })
  await prisma.sponsorAssignment.createMany({
    data: [
      { sponsorId: s.id, groupId: groupA.id },
      { sponsorId: s.id, memberId: memberA1.id }
    ]
  })

  const result = await dissolve(groupA.id, [{ sponsorId: s.id, memberIds: [memberA1.id] }])

  assert.deepEqual(result, { assignmentsCreated: 0, sponsorsToPool: 0 })
  assert.deepEqual(await assignmentsOf(s.id), [{ memberId: memberA1.id, groupId: null }])
})

test('dissolving twice fails', async () => {
  const { groupA } = await seedBasics(prisma)
  await dissolve(groupA.id, [])
  await assert.rejects(dissolve(groupA.id, []), GroupAlreadyDissolvedError)
})

test('dissolving the pool fails', async () => {
  const { pool } = await seedBasics(prisma)
  await assert.rejects(dissolve(pool.id, []), ClubPoolLockedError)
})

test('a memberId outside the group fails', async () => {
  const { groupA, memberSolo } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Stranger' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, groupId: groupA.id } })

  await assert.rejects(
    dissolve(groupA.id, [{ sponsorId: s.id, memberIds: [memberSolo.id] }]),
    NotAGroupMemberError
  )
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupA.id } })
  assert.equal(group.dissolvedAt, null)
})
