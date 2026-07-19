import type { prisma } from '@/lib/db'

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

/** Returns the group that receives ownerless sponsors. Throws if none is marked. */
export async function getClubPool(tx: PrismaClientOrTx) {
  const pool = await tx.group.findFirst({
    where: { isClubPool: true },
    select: { id: true, name: true }
  })
  if (!pool) throw new NoClubPoolError()
  return pool
}

/** Counts what would move if this owner were deleted. Donations never move (see reassignToClubPool). */
export async function countOwnedRecords(
  tx: PrismaClientOrTx,
  owner: OwnerRef
) {
  const sponsors = await tx.sponsor.count({ where: owner })
  return { sponsors }
}

/**
 * Hands an owner's sponsors to the club pool.
 *
 * Donations are never touched here. `Donation.memberId`/`groupId` are optional
 * overrides, not a copy of the sponsor's assignment — NULL is the normal case
 * and means "credit this donation to whoever currently owns the sponsor" (see
 * the crediting logic in app/api/public/status/[token]/route.ts). The FK's
 * `onDelete: SetNull` already does the right thing: when the owner is deleted,
 * any override pointing at it is cleared, and the donation falls back to
 * inheriting its sponsor's owner — which, for sponsors reassigned here, is now
 * the pool. Re-assigning donations explicitly would be wrong: a donation whose
 * override pointed at the deleted owner while its sponsor belongs to someone
 * else would be yanked out of that owner's totals and forced into the pool.
 */
export async function reassignToClubPool(tx: PrismaTx, owner: OwnerRef) {
  const pool = await getClubPool(tx)

  // Never re-assign the pool's own records to itself.
  if ('groupId' in owner && owner.groupId === pool.id) {
    throw new ClubPoolLockedError()
  }

  const sponsors = await tx.sponsor.updateMany({
    where: owner,
    data: { memberId: null, groupId: pool.id }
  })

  return { sponsors: sponsors.count }
}
