import type { Prisma } from '@prisma/client'
import { getMemberDisplayName } from '@/lib/utils'

/** A donation recipient or sponsor assignment target: exactly one member or one group. */
export type RecipientRef = { memberId: string } | { groupId: string }

/**
 * Donations credited to a recipient. Looks only at the donation's own
 * recipient, never at the sponsor's assignments.
 */
export function donationsCreditedTo(r: RecipientRef): Prisma.DonationWhereInput {
  return 'memberId' in r ? { memberId: r.memberId } : { groupId: r.groupId }
}

/** Donations credited to a group itself or to any of the given member ids (group total). */
export function donationsCreditedToGroupTotal(
  groupId: string,
  memberIds: string[]
): Prisma.DonationWhereInput {
  return { OR: [{ groupId }, { memberId: { in: memberIds } }] }
}

/** Sponsors that have an assignment to the given member or group. */
export function sponsorsAssignedTo(r: RecipientRef): Prisma.SponsorWhereInput {
  return { assignments: { some: r } }
}

/**
 * Sponsors listed for one recipient on its status page and status-link export:
 * those assigned to it plus everyone with a donation credited to it. For a
 * group this means donations credited to the group itself; sponsors assigned
 * only to a member of the group are not listed (their donations still count
 * in the group total).
 */
export function sponsorsListedFor(r: RecipientRef): Prisma.SponsorWhereInput {
  return { OR: [sponsorsAssignedTo(r), { donations: { some: donationsCreditedTo(r) } }] }
}

/** Display label of an assignment's recipient: the member name or "<group> (Gruppe)". */
export function recipientLabel(a: {
  member: { firstName: string; lastName: string } | null
  group: { name: string } | null
}): string {
  if (a.member) return getMemberDisplayName(a.member)
  return `${a.group?.name ?? ''} (Gruppe)`
}
