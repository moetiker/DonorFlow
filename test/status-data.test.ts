import { test } from 'node:test'
import assert from 'node:assert/strict'
import { useTestDb as openTestDb, resetDb, seedBasics } from './helpers/test-db'

// lib/db reads DATABASE_URL at import time, so the modules under test are
// imported only after openTestDb() has pointed it at the test database.
const dbReady = openTestDb()
const modules = dbReady.then(async () => ({
  ...(await import('../lib/status-data')),
  ...(await import('../lib/status-export'))
}))

/**
 * Public status page and status-link exports: every figure shown for one
 * member or group counts only the donations credited to that recipient.
 */

const MEMBER_TOKEN = 'm'.repeat(32)
const GROUP_TOKEN = 'g'.repeat(32)

async function setup() {
  const prisma = await dbReady
  await resetDb(prisma)
  const basics = await seedBasics(prisma)
  await prisma.member.update({ where: { id: basics.memberSolo.id }, data: { statusToken: MEMBER_TOKEN } })
  await prisma.group.update({ where: { id: basics.groupA.id }, data: { statusToken: GROUP_TOKEN } })
  return { prisma, ...basics, ...(await modules) }
}

test('a sponsor with two recipients shows only each recipient\'s own amount', async () => {
  const { prisma, memberSolo, groupA, fy, loadStatusData, loadStatusExportData } = await setup()
  const s = await prisma.sponsor.create({ data: { firstName: 'Berta', lastName: 'Both' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberSolo.id } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, groupId: groupA.id } })
  const base = { sponsorId: s.id, amount: 50, donationDate: new Date(), fiscalYearId: fy.id }
  await prisma.donation.create({ data: { ...base, memberId: memberSolo.id } })
  await prisma.donation.create({ data: { ...base, groupId: groupA.id } })

  const member = await loadStatusData(MEMBER_TOKEN)
  assert.ok(member && member.type === 'member')
  assert.equal(member.progress.actual, 50)
  const ms = member.sponsors.find(x => x.name === 'Berta Both')
  assert.ok(ms)
  assert.equal(ms.totalAmount, 50)

  const group = await loadStatusData(GROUP_TOKEN)
  assert.ok(group && group.type === 'group')
  assert.equal(group.progress.actual, 50)
  const gs = group.groupSponsors.find(x => x.name === 'Berta Both')
  assert.ok(gs)
  assert.equal(gs.totalAmount, 50)

  // Exports carry the same per-recipient amounts
  const memberExport = await loadStatusExportData(MEMBER_TOKEN)
  assert.ok(memberExport)
  assert.equal(memberExport.entries.length, 1)
  assert.equal(memberExport.entries[0].assignedTo, 'Sol Solo')
  assert.deepEqual(memberExport.entries[0].sponsor.donations.map(d => d.amount), [50])
  const groupExport = await loadStatusExportData(GROUP_TOKEN)
  assert.ok(groupExport)
  assert.equal(groupExport.entries.length, 1)
  assert.equal(groupExport.entries[0].assignedTo, 'Group A (Gruppe)')
  assert.deepEqual(groupExport.entries[0].sponsor.donations.map(d => d.amount), [50])
})

test('group page lists a group sponsor\'s donation credited to a member', async () => {
  const { prisma, groupA, memberA1, fy, loadStatusData, loadStatusExportData } = await setup()
  const s = await prisma.sponsor.create({ data: { firstName: 'Paul', lastName: 'Beispiel' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, groupId: groupA.id } })
  await prisma.donation.create({
    data: { sponsorId: s.id, amount: 50, donationDate: new Date(), fiscalYearId: fy.id, memberId: memberA1.id }
  })

  const group = await loadStatusData(GROUP_TOKEN)
  assert.ok(group && group.type === 'group')
  const gs = group.groupSponsors.find(x => x.name === 'Paul Beispiel')
  assert.ok(gs, 'group sponsor is listed')
  assert.equal(gs.totalAmount, 50)
  assert.equal(group.progress.actual, 50)

  const groupExport = await loadStatusExportData(GROUP_TOKEN)
  assert.ok(groupExport)
  assert.deepEqual(groupExport.entries[0].sponsor.donations.map(d => d.amount), [50])
})

test('group page does not list sponsors assigned only to a member of the group', async () => {
  const { prisma, memberA1, loadStatusData, loadStatusExportData } = await setup()
  const s = await prisma.sponsor.create({ data: { firstName: 'Only', lastName: 'Member' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberA1.id } })

  const group = await loadStatusData(GROUP_TOKEN)
  assert.ok(group && group.type === 'group')
  assert.equal(group.groupSponsors.find(x => x.name === 'Only Member'), undefined)
  assert.ok(!('members' in group), 'per-member sections are no longer served')

  const groupExport = await loadStatusExportData(GROUP_TOKEN)
  assert.ok(groupExport)
  assert.equal(groupExport.entries.length, 0)
})

test('a member-only sponsor\'s donation counts in the group total but is not listed', async () => {
  const { prisma, memberA1, fy, loadStatusData, loadStatusExportData } = await setup()
  const s = await prisma.sponsor.create({ data: { firstName: 'Member', lastName: 'Donor' } })
  await prisma.sponsorAssignment.create({ data: { sponsorId: s.id, memberId: memberA1.id } })
  await prisma.donation.create({
    data: { sponsorId: s.id, amount: 50, donationDate: new Date(), fiscalYearId: fy.id, memberId: memberA1.id }
  })

  const group = await loadStatusData(GROUP_TOKEN)
  assert.ok(group && group.type === 'group')
  assert.equal(group.groupSponsors.find(x => x.name === 'Member Donor'), undefined)
  assert.equal(group.progress.actual, 50)

  const groupExport = await loadStatusExportData(GROUP_TOKEN)
  assert.ok(groupExport)
  assert.equal(groupExport.entries.length, 0)
})

test('a one-off donor to the group itself is listed', async () => {
  const { prisma, groupA, fy, loadStatusData, loadStatusExportData } = await setup()
  const s = await prisma.sponsor.create({ data: { firstName: 'One', lastName: 'Off' } })
  await prisma.donation.create({
    data: { sponsorId: s.id, amount: 20, donationDate: new Date(), fiscalYearId: fy.id, groupId: groupA.id }
  })

  const group = await loadStatusData(GROUP_TOKEN)
  assert.ok(group && group.type === 'group')
  assert.equal(group.groupSponsors.find(x => x.name === 'One Off')?.totalAmount, 20)
  assert.equal(group.progress.actual, 20)

  const groupExport = await loadStatusExportData(GROUP_TOKEN)
  assert.ok(groupExport)
  assert.equal(groupExport.entries.length, 1)
})

test('dissolved group returns the dissolved variant', async () => {
  const { prisma, groupA, loadStatusData, loadStatusExportData } = await setup()
  await prisma.group.update({ where: { id: groupA.id }, data: { dissolvedAt: new Date() } })

  assert.deepEqual(await loadStatusData(GROUP_TOKEN), { type: 'dissolved', name: groupA.name })
  assert.equal(await loadStatusExportData(GROUP_TOKEN), null)
})

test('unknown token returns null', async () => {
  const { loadStatusData } = await setup()
  assert.equal(await loadStatusData('x'.repeat(32)), null)
})
