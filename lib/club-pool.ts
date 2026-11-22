import type { prisma } from '@/lib/db'
import { donationsCreditedTo, type RecipientRef } from '@/lib/crediting'

/** The interactive-transaction client the extended singleton's `$transaction()` callback receives. */
export type PrismaTx = Parameters<typeof prisma.$transaction> extends [infer Fn, ...unknown[]]
  ? Fn extends (client: infer C) => unknown
    ? C
    : never
  : never

export type PrismaClientOrTx = PrismaTx | typeof prisma

/** Identifies the entity whose sponsors and donations are being handed over. */
export type OwnerRef = { memberId: string } | { groupId: string }

/** Thrown when no group is marked as the club pool. */
export class NoClubPoolError extends Error {
  constructor() {
    super('No group is marked as the club pool')
    this.name = 'NoClubPoolError'
  }
}

/** Thrown when the club pool group itself is being deleted. */
export class ClubPoolLockedError extends Error {
  constructor() {
    super('The club pool group cannot be deleted while it carries the flag')
    this.name = 'ClubPoolLockedError'
  }
}

/** Returns the club pool group, the fallback for sponsors and donations. Throws if none is marked. */
export async function getClubPool(tx: PrismaClientOrTx) {
  const pool = await tx.group.findFirst({
    where: { isClubPool: true },
    select: { id: true, name: true }
  })
  if (!pool) throw new NoClubPoolError()
  return pool
}

/** What a deletion hands over: sponsors moved to the pool and where the deleted owner's donations go. */
export type HandOver = {
  sponsorsToPool: number
  donationsToPool: number
  donationsToOtherRecipient: number
}

type Plan = {
  poolId: string
  /** Sponsors that lose their last assignment and get one to the pool. */
  sponsorIdsToPool: string[]
  /** Donation ids grouped by their new recipient. */
  recredit: Map<string, { target: RecipientRef; donationIds: string[] }>
  counts: HandOver
}

function refKey(r: RecipientRef): string {
  return 'memberId' in r ? `m:${r.memberId}` : `g:${r.groupId}`
}

/**
 * Works out what deleting `owner` does, without writing anything. Shared by
 * countOwnedRecords (dialog) and reassignToClubPool (deletion) so both always
 * agree.
 */
async function planHandOver(tx: PrismaClientOrTx, owner: OwnerRef): Promise<Plan> {
  const pool = await getClubPool(tx)

  const donations = await tx.donation.findMany({
    where: donationsCreditedTo(owner),
    select: { id: true, sponsorId: true }
  })
  const assignedToOwner = await tx.sponsorAssignment.findMany({
    where: owner,
    select: { sponsorId: true }
  })

  const sponsorIds = [
    ...new Set([...donations.map(d => d.sponsorId), ...assignedToOwner.map(a => a.sponsorId)])
  ]
  // Filtered here, not with `NOT: owner`: SQL's NOT (memberId = x) also drops
  // the rows where memberId is NULL, i.e. every group assignment.
  const isOwner = (a: { memberId: string | null; groupId: string | null }) =>
    'memberId' in owner ? a.memberId === owner.memberId : a.groupId === owner.groupId
  const otherAssignments = (
    await tx.sponsorAssignment.findMany({
      where: { sponsorId: { in: sponsorIds } },
      select: { sponsorId: true, memberId: true, groupId: true }
    })
  ).filter(a => !isOwner(a))
  const othersBySponsor = new Map<string, RecipientRef[]>()
  for (const a of otherAssignments) {
    const ref: RecipientRef = a.memberId ? { memberId: a.memberId } : { groupId: a.groupId as string }
    const list = othersBySponsor.get(a.sponsorId) ?? []
    list.push(ref)
    othersBySponsor.set(a.sponsorId, list)
  }

  const poolRef: RecipientRef = { groupId: pool.id }
  const recredit = new Map<string, { target: RecipientRef; donationIds: string[] }>()
  let donationsToPool = 0
  let donationsToOtherRecipient = 0
  for (const d of donations) {
    const others = othersBySponsor.get(d.sponsorId) ?? []
    const target = others.length === 1 ? others[0] : poolRef
    // A sponsor whose only other recipient is the pool sends the donation to the pool.
    if (refKey(target) === refKey(poolRef)) donationsToPool++
    else donationsToOtherRecipient++
    const key = refKey(target)
    const entry = recredit.get(key) ?? { target, donationIds: [] }
    entry.donationIds.push(d.id)
    recredit.set(key, entry)
  }

  const sponsorIdsToPool = [...new Set(assignedToOwner.map(a => a.sponsorId))].filter(
    id => !othersBySponsor.has(id)
  )

  return {
    poolId: pool.id,
    sponsorIdsToPool,
    recredit,
    counts: { sponsorsToPool: sponsorIdsToPool.length, donationsToPool, donationsToOtherRecipient }
  }
}

/** Counts what deleting this owner would hand over (same rule as reassignToClubPool, no writes). */
export async function countOwnedRecords(tx: PrismaClientOrTx, owner: OwnerRef): Promise<HandOver> {
  return (await planHandOver(tx, owner)).counts
}

/**
 * Prepares the deletion of a member or group. Call inside the transaction that
 * deletes the owner, before the delete.
 *
 * Every donation has its own fixed recipient, so a donation credited to the
 * deleted owner must be re-credited explicitly; the FK's `onDelete: SetNull` is
 * only a safety net and would leave a donation without recipient. The rule
 * (spec "Deleting a member or group"):
 *
 * 1. Each donation credited to the owner goes to its sponsor's remaining
 *    recipient if the sponsor has exactly one assignment besides the owner,
 *    otherwise to the club pool.
 * 2. The sponsors' assignments to the owner are removed.
 * 3. Sponsors left without any assignment get one assignment to the club pool;
 *    sponsors that still have another recipient are left alone.
 *
 * Deleting a group does not touch its members' donations: those are credited
 * to the members, who only lose their group (SetNull).
 *
 * @throws NoClubPoolError if no group is marked as the club pool
 * @throws ClubPoolLockedError if the owner is the club pool itself
 */
export async function reassignToClubPool(tx: PrismaTx, owner: OwnerRef): Promise<HandOver> {
  const plan = await planHandOver(tx, owner)

  // Never re-assign the pool's own records to itself.
  if ('groupId' in owner && owner.groupId === plan.poolId) {
    throw new ClubPoolLockedError()
  }

  for (const { target, donationIds } of plan.recredit.values()) {
    await tx.donation.updateMany({
      where: { id: { in: donationIds } },
      data: 'memberId' in target
        ? { memberId: target.memberId, groupId: null }
        : { groupId: target.groupId, memberId: null }
    })
  }

  await tx.sponsorAssignment.deleteMany({ where: owner })

  if (plan.sponsorIdsToPool.length > 0) {
    await tx.sponsorAssignment.createMany({
      data: plan.sponsorIdsToPool.map(sponsorId => ({ sponsorId, groupId: plan.poolId }))
    })
  }

  return plan.counts
}
