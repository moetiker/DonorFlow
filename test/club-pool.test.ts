import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useTestDb, resetDb, seedBasics } from './helpers/test-db'
import { ClubPoolLockedError, countOwnedRecords, reassignToClubPool } from '../lib/club-pool'

type Prisma = Awaited<ReturnType<typeof useTestDb>>
let prisma: Prisma

before(async () => {
  prisma = await useTestDb()
})

beforeEach(async () => {
  await resetDb(prisma)
})

async function deleteMember(memberId: string) {
  return prisma.$transaction(async tx => {
    const result = await reassignToClubPool(tx, { memberId })
    await tx.member.delete({ where: { id: memberId } })
    return result
  })
}

test("a donation goes to the sponsor's only other recipient", async () => {
  const { groupA, memberSolo } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Beispiel' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, groupId: groupA.id } })
  const d = await prisma.donation.create({
    data: { sponsorId: s.id, amount: 50, donationDate: new Date(), memberId: memberSolo.id }
  })

  const result = await deleteMember(memberSolo.id)

  const donation = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })
  assert.equal(donation.groupId, groupA.id)
  assert.equal(donation.memberId, null)
  assert.equal(result.donationsToOtherRecipient, 1)
  assert.equal(result.donationsToPool, 0)
  assert.equal(result.sponsorsToPool, 0)
})

test('a donation goes to the pool when the sponsor has several other recipients', async () => {
  const { pool, groupA, memberA1, memberSolo } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Many' } })
  await prisma.sponsorAssignment.createMany({
    data: [
      { sponsorId: s.id, memberId: memberSolo.id },
      { sponsorId: s.id, memberId: memberA1.id },
      { sponsorId: s.id, groupId: groupA.id }
    ]
  })
  const d = await prisma.donation.create({
    data: { sponsorId: s.id, amount: 30, donationDate: new Date(), memberId: memberSolo.id }
  })

  const result = await deleteMember(memberSolo.id)

  const donation = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })
  assert.equal(donation.groupId, pool.id)
  assert.equal(donation.memberId, null)
  assert.equal(result.donationsToPool, 1)
  assert.equal(result.donationsToOtherRecipient, 0)
  // The sponsor keeps its two other assignments and is not moved to the pool.
  const rows = await prisma.sponsorAssignment.findMany({ where: { sponsorId: s.id } })
  assert.equal(rows.length, 2)
  assert.ok(!rows.some(r => r.groupId === pool.id))
})

test('a sponsor without other recipients moves to the pool, one with another recipient stays', async () => {
  const { pool, groupA, memberSolo } = await seedBasics(prisma)
  const alone = await prisma.sponsor.create({ data: { lastName: 'Alone' } })
  const shared = await prisma.sponsor.create({ data: { lastName: 'Shared' } })
  await prisma.sponsorAssignment.createMany({
    data: [
      { sponsorId: alone.id, memberId: memberSolo.id },
      { sponsorId: shared.id, memberId: memberSolo.id },
      { sponsorId: shared.id, groupId: groupA.id }
    ]
  })
  const dAlone = await prisma.donation.create({
    data: { sponsorId: alone.id, amount: 10, donationDate: new Date(), memberId: memberSolo.id }
  })

  const result = await deleteMember(memberSolo.id)

  const aloneRows = await prisma.sponsorAssignment.findMany({ where: { sponsorId: alone.id } })
  assert.deepEqual(aloneRows.map(r => [r.memberId, r.groupId]), [[null, pool.id]])
  const sharedRows = await prisma.sponsorAssignment.findMany({ where: { sponsorId: shared.id } })
  assert.deepEqual(sharedRows.map(r => [r.memberId, r.groupId]), [[null, groupA.id]])
  const donation = await prisma.donation.findUniqueOrThrow({ where: { id: dAlone.id } })
  assert.equal(donation.groupId, pool.id)
  assert.deepEqual(result, { sponsorsToPool: 1, donationsToPool: 1, donationsToOtherRecipient: 0 })
})

test('deleting a group re-credits its donations and leaves its members alone', async () => {
  const { pool, groupA, memberA1 } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Group' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, groupId: groupA.id } })
  const dGroup = await prisma.donation.create({
    data: { sponsorId: s.id, amount: 40, donationDate: new Date(), groupId: groupA.id }
  })
  const dMember = await prisma.donation.create({
    data: { sponsorId: s.id, amount: 15, donationDate: new Date(), memberId: memberA1.id }
  })

  const result = await prisma.$transaction(async tx => {
    const r = await reassignToClubPool(tx, { groupId: groupA.id })
    await tx.group.delete({ where: { id: groupA.id } })
    return r
  })

  assert.deepEqual(result, { sponsorsToPool: 1, donationsToPool: 1, donationsToOtherRecipient: 0 })
  assert.equal((await prisma.donation.findUniqueOrThrow({ where: { id: dGroup.id } })).groupId, pool.id)
  assert.equal((await prisma.donation.findUniqueOrThrow({ where: { id: dMember.id } })).memberId, memberA1.id)
  assert.equal((await prisma.member.findUniqueOrThrow({ where: { id: memberA1.id } })).groupId, null)
})

test('count matches what reassign does', async () => {
  const { pool, groupA, memberA1, memberSolo } = await seedBasics(prisma)
  const alone = await prisma.sponsor.create({ data: { lastName: 'Alone' } })
  const other = await prisma.sponsor.create({ data: { lastName: 'Other' } })
  const many = await prisma.sponsor.create({ data: { lastName: 'Many' } })
  await prisma.sponsorAssignment.createMany({
    data: [
      { sponsorId: alone.id, memberId: memberSolo.id },
      { sponsorId: other.id, groupId: groupA.id },
      { sponsorId: many.id, memberId: memberSolo.id },
      { sponsorId: many.id, memberId: memberA1.id },
      { sponsorId: many.id, groupId: groupA.id }
    ]
  })
  const date = new Date()
  await prisma.donation.createMany({
    data: [
      { sponsorId: alone.id, amount: 1, donationDate: date, memberId: memberSolo.id },
      { sponsorId: alone.id, amount: 2, donationDate: date, memberId: memberSolo.id },
      { sponsorId: other.id, amount: 3, donationDate: date, memberId: memberSolo.id },
      { sponsorId: many.id, amount: 4, donationDate: date, memberId: memberSolo.id },
      { sponsorId: many.id, amount: 5, donationDate: date, memberId: memberA1.id }
    ]
  })

  const counted = await countOwnedRecords(prisma, { memberId: memberSolo.id })
  const done = await deleteMember(memberSolo.id)

  assert.deepEqual(counted, { sponsorsToPool: 1, donationsToPool: 3, donationsToOtherRecipient: 1 })
  assert.deepEqual(done, counted)
  const byAmount = new Map(
    (await prisma.donation.findMany()).map(d => [d.amount, d.memberId ?? d.groupId])
  )
  assert.equal(byAmount.get(1), pool.id)
  assert.equal(byAmount.get(2), pool.id)
  assert.equal(byAmount.get(3), groupA.id)
  assert.equal(byAmount.get(4), pool.id)
  assert.equal(byAmount.get(5), memberA1.id)
})

test('deleting the pool is refused', async () => {
  const { pool } = await seedBasics(prisma)
  await assert.rejects(
    prisma.$transaction(tx => reassignToClubPool(tx, { groupId: pool.id })),
    ClubPoolLockedError
  )
})
