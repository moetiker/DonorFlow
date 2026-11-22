import { test } from 'node:test'
import assert from 'node:assert/strict'
import { useTestDb, seedBasics } from './helpers/test-db'
import {
  donationsCreditedTo,
  donationsCreditedToGroupTotal,
  sponsorsAssignedTo,
  recipientLabel
} from '../lib/crediting'

test('donations credited to a member ignore the sponsor\'s assignment', async () => {
  const prisma = await useTestDb()
  const { memberA1, memberSolo } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Muster' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberA1.id } })
  await prisma.donation.create({
    data: { sponsorId: s.id, amount: 10, donationDate: new Date(), memberId: memberSolo.id }
  })
  assert.deepEqual(await prisma.donation.findMany({ where: donationsCreditedTo({ memberId: memberA1.id }) }), [])
  assert.equal(
    (await prisma.donation.findMany({ where: donationsCreditedTo({ memberId: memberSolo.id }) })).length,
    1
  )
})

test('group total includes donations credited to its members', async () => {
  const prisma = await useTestDb()
  const { groupA, memberA1, memberA2, memberSolo } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Total' } })
  const base = { sponsorId: s.id, donationDate: new Date() }
  await prisma.donation.create({ data: { ...base, amount: 50, groupId: groupA.id } })
  await prisma.donation.create({ data: { ...base, amount: 30, memberId: memberA1.id } })
  await prisma.donation.create({ data: { ...base, amount: 99, memberId: memberSolo.id } })
  const agg = await prisma.donation.aggregate({
    where: donationsCreditedToGroupTotal(groupA.id, [memberA1.id, memberA2.id]),
    _sum: { amount: true }
  })
  assert.equal(agg._sum.amount, 80)
})

test('sponsorsAssignedTo finds a sponsor through any of its assignments', async () => {
  const prisma = await useTestDb()
  const { groupA, memberSolo, memberA2 } = await seedBasics(prisma)
  const s = await prisma.sponsor.create({ data: { lastName: 'Multi' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberSolo.id } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, groupId: groupA.id } })
  const ids = async (r: Parameters<typeof sponsorsAssignedTo>[0]) =>
    (await prisma.sponsor.findMany({ where: sponsorsAssignedTo(r) })).map(x => x.id)
  assert.deepEqual(await ids({ memberId: memberSolo.id }), [s.id])
  assert.deepEqual(await ids({ groupId: groupA.id }), [s.id])
  assert.deepEqual(await ids({ memberId: memberA2.id }), [])
})

test('recipientLabel names members and groups', () => {
  assert.equal(
    recipientLabel({ member: { firstName: 'Hans', lastName: 'Müller' }, group: null }),
    'Hans Müller'
  )
  assert.equal(recipientLabel({ member: null, group: { name: 'Team Nord' } }), 'Team Nord (Gruppe)')
})
