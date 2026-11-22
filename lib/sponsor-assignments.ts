import { getClubPool, ClubPoolLockedError, type PrismaTx } from '@/lib/club-pool'
import type { RecipientRef } from '@/lib/crediting'

/** Thrown when a sponsor would be assigned to a dissolved group. */
export class DissolvedGroupError extends Error {
  constructor() {
    super('groupDissolved')
    this.name = 'DissolvedGroupError'
  }
}

/** Thrown when a group that is already dissolved is dissolved again. */
export class GroupAlreadyDissolvedError extends Error {
  constructor() {
    super('groupAlreadyDissolved')
    this.name = 'GroupAlreadyDissolvedError'
  }
}

/** Thrown when a dissolve plan hands a sponsor to someone who is not a member of the group. */
export class NotAGroupMemberError extends Error {
  constructor() {
    super('notAGroupMember')
    this.name = 'NotAGroupMemberError'
  }
}

/**
 * Makes the sponsor's assignments equal to the given list: removes the ones not
 * in it and creates the missing ones. Donations are never touched; they stay
 * credited to the recipient they were booked on.
 *
 * @throws DissolvedGroupError if any listed group has been dissolved
 */
export async function replaceSponsorAssignments(
  tx: PrismaTx,
  sponsorId: string,
  assignments: RecipientRef[]
): Promise<void> {
  const groupIds = assignments.flatMap(a => ('groupId' in a ? [a.groupId] : []))
  if (groupIds.length > 0) {
    const dissolved = await tx.group.count({
      where: { id: { in: groupIds }, dissolvedAt: { not: null } }
    })
    if (dissolved > 0) throw new DissolvedGroupError()
  }

  const wantedMembers = new Set(assignments.flatMap(a => ('memberId' in a ? [a.memberId] : [])))
  const wantedGroups = new Set(groupIds)

  const existing = await tx.sponsorAssignment.findMany({ where: { sponsorId } })
  const stale = existing.filter(e =>
    e.memberId ? !wantedMembers.has(e.memberId) : !(e.groupId && wantedGroups.has(e.groupId))
  )
  if (stale.length > 0) {
    await tx.sponsorAssignment.deleteMany({ where: { id: { in: stale.map(e => e.id) } } })
  }

  const hasMember = new Set(existing.map(e => e.memberId).filter((x): x is string => !!x))
  const hasGroup = new Set(existing.map(e => e.groupId).filter((x): x is string => !!x))

  for (const a of assignments) {
    if ('memberId' in a) {
      if (!hasMember.has(a.memberId)) {
        await tx.sponsorAssignment.create({ data: { sponsorId, memberId: a.memberId } })
      }
    } else if (!hasGroup.has(a.groupId)) {
      await tx.sponsorAssignment.create({ data: { sponsorId, groupId: a.groupId } })
    }
  }
}

/** True when the group exists and has been dissolved. */
export async function isGroupDissolved(tx: PrismaTx, groupId: string): Promise<boolean> {
  const group = await tx.group.findUnique({ where: { id: groupId }, select: { dissolvedAt: true } })
  return Boolean(group?.dissolvedAt)
}

/**
 * True when a donation may be credited to the given group. A dissolved group is
 * refused unless it is the donation's existing recipient (past donations stay
 * editable).
 */
export async function isGroupAllowedForDonation(
  tx: PrismaTx,
  groupId: string,
  currentGroupId: string | null
): Promise<boolean> {
  if (groupId === currentGroupId) return true
  return !(await isGroupDissolved(tx, groupId))
}

/** Include clause that adds a sponsor's assignments with member and group names. */
export const sponsorAssignmentsInclude = {
  assignments: {
    select: {
      id: true,
      memberId: true,
      groupId: true,
      member: { select: { id: true, firstName: true, lastName: true } },
      group: { select: { id: true, name: true } }
    }
  }
} as const

/** Converts validated API input entries (exactly one id each) to recipient refs. */
export function toRecipientRefs(
  entries: { memberId?: string | null; groupId?: string | null }[]
): RecipientRef[] {
  return entries.map(e => (e.memberId ? { memberId: e.memberId } : { groupId: e.groupId as string }))
}

/**
 * Moves a member's sponsors to the group the member joins (spec "Joining a
 * group"): each of the member's assignments is replaced by one to the group,
 * without creating a duplicate when the sponsor is already assigned to it.
 * Donations stay credited to the member.
 *
 * @returns the number of sponsors moved
 * @throws DissolvedGroupError if the group has been dissolved
 */
export async function moveMemberSponsorsToGroup(
  tx: PrismaTx,
  memberId: string,
  groupId: string
): Promise<number> {
  if (await isGroupDissolved(tx, groupId)) throw new DissolvedGroupError()

  const memberAssignments = await tx.sponsorAssignment.findMany({
    where: { memberId },
    select: { id: true, sponsorId: true }
  })
  if (memberAssignments.length === 0) return 0

  const sponsorIds = memberAssignments.map(a => a.sponsorId)
  const alreadyInGroup = new Set(
    (
      await tx.sponsorAssignment.findMany({
        where: { groupId, sponsorId: { in: sponsorIds } },
        select: { sponsorId: true }
      })
    ).map(a => a.sponsorId)
  )

  await tx.sponsorAssignment.deleteMany({ where: { id: { in: memberAssignments.map(a => a.id) } } })
  const toCreate = sponsorIds.filter(id => !alreadyInGroup.has(id))
  if (toCreate.length > 0) {
    await tx.sponsorAssignment.createMany({ data: toCreate.map(sponsorId => ({ sponsorId, groupId })) })
  }
  return sponsorIds.length
}

/** For each of the group's sponsors, the members that take it over. */
export type DissolvePlan = { sponsorId: string; memberIds: string[] }[]

/**
 * Dissolves a group (spec "Dissolving a group"), in the caller's transaction:
 *
 * 1. Each sponsor assigned to the group gets an assignment to the members the
 *    plan lists for it (existing member assignments are not duplicated).
 * 2. A group sponsor with no member in the plan (missing or empty memberIds)
 *    gets an assignment to the club pool, but only if it has no other
 *    assignment left once the group's is gone.
 * 3. All assignments to the group are removed, its members lose the group and
 *    the group is marked dissolved.
 *
 * Donations credited to the group stay credited to it. Plan entries for
 * sponsors not assigned to the group are ignored.
 *
 * @throws ClubPoolLockedError if the group is the club pool
 * @throws GroupAlreadyDissolvedError if the group is already dissolved
 * @throws NotAGroupMemberError if the plan names someone outside the group
 * @throws NoClubPoolError if no group is marked as the club pool
 */
export async function dissolveGroup(
  tx: PrismaTx,
  groupId: string,
  plan: DissolvePlan
): Promise<{ assignmentsCreated: number; sponsorsToPool: number }> {
  const group = await tx.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { isClubPool: true, dissolvedAt: true, members: { select: { id: true } } }
  })
  if (group.isClubPool) throw new ClubPoolLockedError()
  if (group.dissolvedAt) throw new GroupAlreadyDissolvedError()

  const memberIds = new Set(group.members.map(m => m.id))
  for (const entry of plan) {
    if (entry.memberIds.some(id => !memberIds.has(id))) throw new NotAGroupMemberError()
  }

  const pool = await getClubPool(tx)

  const groupSponsorIds = (
    await tx.sponsorAssignment.findMany({ where: { groupId }, select: { sponsorId: true } })
  ).map(a => a.sponsorId)
  // Every assignment of those sponsors except the one to the group. Filtered
  // in code: SQL's NOT (groupId = x) would also drop the member assignments,
  // whose groupId is NULL.
  const otherAssignments = (
    await tx.sponsorAssignment.findMany({
      where: { sponsorId: { in: groupSponsorIds } },
      select: { sponsorId: true, memberId: true, groupId: true }
    })
  ).filter(a => a.groupId !== groupId)

  const chosen = new Map<string, Set<string>>()
  for (const entry of plan) {
    const set = chosen.get(entry.sponsorId) ?? new Set<string>()
    entry.memberIds.forEach(id => set.add(id))
    chosen.set(entry.sponsorId, set)
  }

  const toCreate: { sponsorId: string; memberId?: string; groupId?: string }[] = []
  let assignmentsCreated = 0
  let sponsorsToPool = 0
  for (const sponsorId of groupSponsorIds) {
    const others = otherAssignments.filter(a => a.sponsorId === sponsorId)
    const members = chosen.get(sponsorId) ?? new Set<string>()
    if (members.size > 0) {
      const hasMember = new Set(others.map(a => a.memberId))
      for (const memberId of members) {
        if (!hasMember.has(memberId)) {
          toCreate.push({ sponsorId, memberId })
          assignmentsCreated++
        }
      }
    } else if (others.length === 0) {
      toCreate.push({ sponsorId, groupId: pool.id })
      sponsorsToPool++
    }
  }

  await tx.sponsorAssignment.deleteMany({ where: { groupId } })
  if (toCreate.length > 0) {
    await tx.sponsorAssignment.createMany({ data: toCreate })
  }
  await tx.member.updateMany({ where: { groupId }, data: { groupId: null } })
  await tx.group.update({ where: { id: groupId }, data: { dissolvedAt: new Date() } })

  return { assignmentsCreated, sponsorsToPool }
}
