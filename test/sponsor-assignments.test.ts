import { test } from 'node:test'
import assert from 'node:assert/strict'
import { useTestDb, seedBasics } from './helpers/test-db'
import { DissolvedGroupError, replaceSponsorAssignments } from '../lib/sponsor-assignments'
import { createSponsorSchema } from '../lib/validation'

test('replacing assignments keeps donations where they were credited', async () => {
  const prisma = await useTestDb()
  const { memberA1, memberSolo } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Keeper' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberA1.id } })
  const d = await prisma.donation.create({
    data: { sponsorId: s.id, amount: 20, donationDate: new Date(), memberId: memberA1.id }
  })

  await prisma.$transaction(tx =>
    replaceSponsorAssignments(tx, s.id, [{ memberId: memberSolo.id }])
  )

  const assignments = await prisma.sponsorAssignment.findMany({ where: { sponsorId: s.id } })
  assert.equal(assignments.length, 1)
  assert.equal(assignments[0].memberId, memberSolo.id)
  const donation = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })
  assert.equal(donation.memberId, memberA1.id)
})

test('replacing assignments keeps unchanged rows and adds new ones', async () => {
  const prisma = await useTestDb()
  const { groupA, memberA1, memberSolo } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Multi' } })
  const kept = await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberA1.id } })

  await prisma.$transaction(tx =>
    replaceSponsorAssignments(tx, s.id, [
      { memberId: memberA1.id },
      { memberId: memberSolo.id },
      { groupId: groupA.id }
    ])
  )

  const rows = await prisma.sponsorAssignment.findMany({ where: { sponsorId: s.id } })
  assert.equal(rows.length, 3)
  assert.ok(rows.some(r => r.id === kept.id))
})

test('assigning to a dissolved group is refused', async () => {
  const prisma = await useTestDb()
  const { groupA } = await seedBasics(prisma)
  await prisma.group.update({ where: { id: groupA.id }, data: { dissolvedAt: new Date() } })
  const s = await prisma.sponsor.create({ data: { lastName: 'Late' } })

  await assert.rejects(
    prisma.$transaction(tx => replaceSponsorAssignments(tx, s.id, [{ groupId: groupA.id }])),
    DissolvedGroupError
  )
  assert.equal(await prisma.sponsorAssignment.count({ where: { sponsorId: s.id } }), 0)
})

test('createSponsorSchema rejects an empty list and duplicates', () => {
  assert.equal(createSponsorSchema.safeParse({ lastName: 'X', assignments: [] }).success, false)
  assert.equal(createSponsorSchema.safeParse({ lastName: 'X' }).success, false)

  const dup = createSponsorSchema.safeParse({
    lastName: 'X',
    assignments: [{ memberId: 'm1' }, { memberId: 'm1' }]
  })
  assert.equal(dup.success, false)
  if (!dup.success) assert.equal(dup.error.issues[0].message, 'duplicateAssignment')

  const both = createSponsorSchema.safeParse({
    lastName: 'X',
    assignments: [{ memberId: 'm1', groupId: 'g1' }]
  })
  assert.equal(both.success, false)

  assert.equal(
    createSponsorSchema.safeParse({
      lastName: 'X',
      assignments: [{ memberId: 'm1' }, { groupId: 'g1' }]
    }).success,
    true
  )
})
