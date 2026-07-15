import { prisma } from './db'
import { getMemberDisplayName } from './utils'
import { SPONSOR_CSV_SELECT, buildSponsorCsv, type SponsorCsvRow } from './sponsor-csv'
import { generateStatusToken } from './tokens'

/**
 * Per-member data needed to compose a donor mailing. Resolves the member's
 * status entity: an ungrouped member reports on itself; a grouped member
 * reports on its group (matching the public status links). Progress and the
 * address CSV are scoped to the given fiscal year.
 */
export type MemberMailData = {
  memberId: string
  memberName: string
  email: string | null
  entityType: 'member' | 'group'
  displayName: string
  statusToken: string
  progress: { target: number; collected: number; remaining: number; percentage: number }
  csvContent: string
}

async function sumMonetary(where: object): Promise<number> {
  const agg = await prisma.donation.aggregate({
    where: { ...where, type: 'MONETARY' },
    _sum: { amount: true },
  })
  return agg._sum.amount ?? 0
}

function toProgress(target: number, collected: number) {
  return {
    target,
    collected,
    remaining: Math.max(0, target - collected),
    percentage: target > 0 ? Math.round((collected / target) * 100) : 0,
  }
}

export async function buildMemberMailData(
  memberId: string,
  fiscalYearId: string
): Promise<MemberMailData | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      groupId: true,
      statusToken: true,
      group: { select: { id: true, name: true, statusToken: true } },
    },
  })
  if (!member) return null
  const memberName = getMemberDisplayName(member)

  // --- Grouped member: report on the group ---
  if (member.groupId && member.group) {
    const groupId = member.group.id
    let token = member.group.statusToken
    if (!token) {
      token = generateStatusToken()
      await prisma.group.update({ where: { id: groupId }, data: { statusToken: token } })
    }

    const groupMembers = await prisma.member.findMany({
      where: { groupId },
      orderBy: { lastName: 'asc' },
      select: { id: true, firstName: true, lastName: true, sponsors: { orderBy: { lastName: 'asc' }, select: SPONSOR_CSV_SELECT } },
    })
    const groupSponsors = await prisma.sponsor.findMany({
      where: { groupId },
      orderBy: { lastName: 'asc' },
      select: SPONSOR_CSV_SELECT,
    })

    const targetAgg = await prisma.memberTarget.aggregate({
      where: { fiscalYearId, member: { groupId } },
      _sum: { targetAmount: true },
    })
    const target = targetAgg._sum.targetAmount ?? 0

    let collected = await sumMonetary({
      fiscalYearId,
      OR: [{ groupId }, { groupId: null, memberId: null, sponsor: { groupId } }],
    })
    for (const m of groupMembers) {
      collected += await sumMonetary({
        fiscalYearId,
        OR: [{ memberId: m.id }, { memberId: null, groupId: null, sponsor: { memberId: m.id } }],
      })
    }

    const entries: { sponsor: SponsorCsvRow; assignedTo: string }[] = []
    for (const s of groupSponsors) entries.push({ sponsor: s, assignedTo: `${member.group.name} (Gruppe)` })
    for (const m of groupMembers) {
      const mName = getMemberDisplayName(m)
      for (const s of m.sponsors) entries.push({ sponsor: s, assignedTo: mName })
    }

    return {
      memberId: member.id,
      memberName,
      email: member.email,
      entityType: 'group',
      displayName: member.group.name,
      statusToken: token,
      progress: toProgress(target, collected),
      csvContent: buildSponsorCsv(entries, fiscalYearId),
    }
  }

  // --- Ungrouped member: report on the member ---
  let token = member.statusToken
  if (!token) {
    token = generateStatusToken()
    await prisma.member.update({ where: { id: member.id }, data: { statusToken: token } })
  }

  const sponsors = await prisma.sponsor.findMany({
    where: { memberId: member.id },
    orderBy: { lastName: 'asc' },
    select: SPONSOR_CSV_SELECT,
  })
  const targetRow = await prisma.memberTarget.findFirst({
    where: { memberId: member.id, fiscalYearId },
    select: { targetAmount: true },
  })
  const target = targetRow?.targetAmount ?? 0
  const collected = await sumMonetary({
    fiscalYearId,
    OR: [{ memberId: member.id }, { memberId: null, sponsor: { memberId: member.id } }],
  })

  const entries = sponsors.map((s: SponsorCsvRow) => ({ sponsor: s, assignedTo: memberName }))

  return {
    memberId: member.id,
    memberName,
    email: member.email,
    entityType: 'member',
    displayName: memberName,
    statusToken: token,
    progress: toProgress(target, collected),
    csvContent: buildSponsorCsv(entries, fiscalYearId),
  }
}

export async function getOrgName(): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key: 'organizationName' }, select: { value: true } })
  return s?.value || 'Gönnerverwaltung'
}

export function mailCsvFilename(name: string): string {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const safe = name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'Export'
  return `Goenner_${safe}_${dateStr}.csv`
}

/** Members that can be selected as mailing recipients. */
export async function listMailRecipients() {
  const members = await prisma.member.findMany({
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      group: { select: { name: true } },
    },
  })
  return members.map((m) => ({
    id: m.id,
    name: getMemberDisplayName(m),
    email: m.email,
    groupName: m.group?.name ?? null,
  }))
}
