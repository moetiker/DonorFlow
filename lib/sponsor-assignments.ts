import type { PrismaTx } from '@/lib/club-pool'
import type { RecipientRef } from '@/lib/crediting'

/** Thrown when a sponsor would be assigned to a dissolved group. */
export class DissolvedGroupError extends Error {
  constructor() {
    super('groupDissolved')
    this.name = 'DissolvedGroupError'
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
