import { test } from 'node:test'
import assert from 'node:assert/strict'
import { useTestDb, seedBasics } from './helpers/test-db'

test('a sponsor can be assigned to a member and a group, but not twice to the same member', async () => {
  const prisma = await useTestDb()
  const { groupA, memberSolo } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Muster' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberSolo.id } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, groupId: groupA.id } })
  await assert.rejects(prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberSolo.id } }))
  assert.equal(await prisma.sponsorAssignment.count({ where: { sponsorId: s.id } }), 2)
})
