import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export type PrismaTx = Prisma.TransactionClient

/** Identifies the entity whose sponsors and donations are being handed over. */
export type OwnerRef = { memberId: string } | { groupId: string }

/** Thrown when no group is marked as the club pool. */
export class NoClubPoolError extends Error {
  constructor() {
    super('No group is marked as the club pool')
    this.name = 'NoClubPoolError'
  }
}

/** Returns the group that receives ownerless sponsors. Throws if none is marked. */
export async function getClubPool(tx: PrismaTx | typeof prisma = prisma) {
  const pool = await tx.group.findFirst({
    where: { isClubPool: true },
    select: { id: true, name: true }
  })
  if (!pool) throw new NoClubPoolError()
  return pool
}

/** Counts what would move if this owner were deleted. */
export async function countOwnedRecords(
  tx: PrismaTx | typeof prisma = prisma,
  owner: OwnerRef
) {
  const [sponsors, donations] = await Promise.all([
    tx.sponsor.count({ where: owner }),
    tx.donation.count({ where: owner })
  ])
  return { sponsors, donations }
}

/**
 * Hands an owner's sponsors and donations to the club pool.
 *
 * Donations carry their own memberId/groupId and the totals are computed from
 * those fields, so they must move together with the sponsor — otherwise the
 * sponsor lands in the pool and the money counts towards no target at all.
 */
export async function reassignToClubPool(tx: PrismaTx, owner: OwnerRef) {
  const pool = await getClubPool(tx)

  // Never re-assign the pool's own records to itself.
  if ('groupId' in owner && owner.groupId === pool.id) {
    throw new Error('Cannot re-assign the club pool to itself')
  }

  const sponsors = await tx.sponsor.updateMany({
    where: owner,
    data: { memberId: null, groupId: pool.id }
  })
  const donations = await tx.donation.updateMany({
    where: owner,
    data: { memberId: null, groupId: pool.id }
  })

  return { sponsors: sponsors.count, donations: donations.count }
}
