import type { prisma } from '@/lib/db'
import { getClubPool, type PrismaClientOrTx } from '@/lib/club-pool'

/**
 * Known duplicate sponsor records in the production data. The first id is kept,
 * the second is merged into it and deleted.
 */
export const DUPLICATE_MERGES: { keepId: string; mergeId: string }[] = [
  { keepId: 'cmtrb4lfn000ia1umgsrhgfr3', mergeId: 'cmtrb7ed1000ka1umgzzigj40' }, // duplicate sponsor record, case 1
  { keepId: 'cmhhxstgt008zqq7i6xupwh4q', mergeId: 'cmilvdqw4000626fq5t83wsv0' }, // duplicate sponsor record, case 2
]

/**
 * `Setting` key written when the migration succeeded. The legacy sponsor
 * columns stay populated until they are dropped, so without this marker an
 * assignment removed later (or a dissolved group) would be re-created from
 * them at the next start.
 */
export const MIGRATION_MARKER_KEY = 'sponsorAssignmentsMigrated'

export type TotalsDiff = { key: string; before: number; after: number }

export type MigrationResult =
  | { status: 'skipped' }
  | { status: 'migrated'; assignmentsCreated: number; donationsFilled: number; sponsorsMerged: number }
  | { status: 'rolledBack'; diffs: TotalsDiff[] }

/** Contact fields copied from a merged duplicate when they are empty on the kept record. */
const CONTACT_FIELDS = [
  'company',
  'salutation',
  'firstName',
  'lastName',
  'street',
  'postalCode',
  'city',
  'phone',
  'email'
] as const

type Owner = { memberId: string | null; groupId: string | null }

/** Thrown inside the transaction to roll it back when the credited totals changed. */
class TotalsChangedError extends Error {
  constructor(readonly diffs: TotalsDiff[]) {
    super('Credited totals changed during sponsor assignment migration')
    this.name = 'TotalsChangedError'
  }
}

function totalsKey(owner: Owner, fiscalYearId: string | null): string | null {
  if (owner.memberId) return `member:${owner.memberId}:${fiscalYearId ?? 'none'}`
  if (owner.groupId) return `group:${owner.groupId}:${fiscalYearId ?? 'none'}`
  return null
}

/**
 * Sums donation amounts per credited member/group and fiscal year.
 *
 * Before the migration (`legacy = true`) a donation without a recipient is
 * credited to its sponsor's legacy owner, and a donation whose sponsor has no
 * owner either to the club pool, which is where step 2 puts it on purpose.
 * After the migration only the donation's own recipient counts.
 */
async function computeTotals(
  tx: PrismaClientOrTx,
  legacy: boolean,
  poolId: string
): Promise<Map<string, number>> {
  const donations = await tx.donation.findMany({
    select: {
      amount: true,
      fiscalYearId: true,
      memberId: true,
      groupId: true,
      sponsor: { select: { legacyMemberId: true, legacyGroupId: true } }
    }
  })
  const totals = new Map<string, number>()
  for (const d of donations) {
    let owner: Owner = { memberId: d.memberId, groupId: d.groupId }
    if (legacy && !owner.memberId && !owner.groupId) {
      owner = d.sponsor.legacyMemberId || d.sponsor.legacyGroupId
        ? { memberId: d.sponsor.legacyMemberId, groupId: d.sponsor.legacyGroupId }
        : { memberId: null, groupId: poolId }
    }
    const key = totalsKey(owner, d.fiscalYearId)
    if (!key) continue
    totals.set(key, (totals.get(key) ?? 0) + (d.amount ?? 0))
  }
  return totals
}

/** Lists every key whose total differs between the two maps (missing keys count as 0). */
export function compareTotals(
  before: Map<string, number>,
  after: Map<string, number>
): TotalsDiff[] {
  const keys = new Set([...before.keys(), ...after.keys()])
  const diffs: TotalsDiff[] = []
  for (const key of [...keys].sort()) {
    const b = before.get(key) ?? 0
    const a = after.get(key) ?? 0
    // Amounts are CHF with at most two decimals; ignore float summation noise.
    if (Math.abs(a - b) > 0.005) diffs.push({ key, before: b, after: a })
  }
  return diffs
}

/**
 * False once the migration marker exists. Otherwise true when some sponsor's
 * legacy owner has no matching assignment or a donation has no recipient.
 */
async function needsMigration(client: PrismaClientOrTx): Promise<boolean> {
  const marker = await client.setting.findUnique({ where: { key: MIGRATION_MARKER_KEY } })
  if (marker) return false
  const unassigned = await findUnassignedOwners(client)
  if (unassigned.length > 0) return true
  const recipientless = await client.donation.count({ where: { memberId: null, groupId: null } })
  return recipientless > 0
}

/** Sponsors whose legacy `memberId`/`groupId` columns have no matching `SponsorAssignment` yet. */
async function findUnassignedOwners(client: PrismaClientOrTx) {
  const sponsors = await client.sponsor.findMany({
    where: { OR: [{ legacyMemberId: { not: null } }, { legacyGroupId: { not: null } }] },
    select: {
      id: true,
      legacyMemberId: true,
      legacyGroupId: true,
      assignments: { select: { memberId: true, groupId: true } }
    }
  })
  const missing: { sponsorId: string; memberId: string | null; groupId: string | null }[] = []
  for (const s of sponsors) {
    if (s.legacyMemberId && !s.assignments.some(a => a.memberId === s.legacyMemberId)) {
      missing.push({ sponsorId: s.id, memberId: s.legacyMemberId, groupId: null })
    }
    if (s.legacyGroupId && !s.assignments.some(a => a.groupId === s.legacyGroupId)) {
      missing.push({ sponsorId: s.id, memberId: null, groupId: s.legacyGroupId })
    }
  }
  return missing
}

/** Merges one duplicate sponsor into the kept one. Returns false if either record is missing. */
async function mergeDuplicate(tx: PrismaClientOrTx, keepId: string, mergeId: string): Promise<boolean> {
  if (keepId === mergeId) return false
  const kept = await tx.sponsor.findUnique({ where: { id: keepId }, include: { assignments: true } })
  const merged = await tx.sponsor.findUnique({ where: { id: mergeId }, include: { assignments: true } })
  if (!kept || !merged) return false

  await tx.donation.updateMany({ where: { sponsorId: mergeId }, data: { sponsorId: keepId } })

  for (const a of merged.assignments) {
    const duplicate = kept.assignments.some(
      k => (a.memberId && k.memberId === a.memberId) || (a.groupId && k.groupId === a.groupId)
    )
    if (duplicate) {
      await tx.sponsorAssignment.delete({ where: { id: a.id } })
    } else {
      await tx.sponsorAssignment.update({ where: { id: a.id }, data: { sponsorId: keepId } })
    }
  }

  const data: Partial<Record<(typeof CONTACT_FIELDS)[number] | 'notes', string | null>> = {}
  for (const field of CONTACT_FIELDS) {
    if (!kept[field] && merged[field]) data[field] = merged[field]
  }
  if (merged.notes) {
    data.notes = kept.notes ? `${kept.notes}\n${merged.notes}` : merged.notes
  }
  const lastName = data.lastName ?? kept.lastName
  if (lastName) {
    const stripped = lastName.replace(/\d+$/, '').trimEnd()
    if (stripped && stripped !== kept.lastName) data.lastName = stripped
  }

  await tx.sponsor.delete({ where: { id: mergeId } })
  if (Object.keys(data).length > 0) {
    await tx.sponsor.update({ where: { id: keepId }, data })
  }
  return true
}

/**
 * One-time data migration to the sponsor-assignment model (runs at server start).
 *
 * 1. Creates a `SponsorAssignment` for every legacy `Sponsor.memberId`/`groupId`.
 * 2. Gives every donation without a recipient its sponsor's legacy owner, or the
 *    club pool when the sponsor has none.
 * 3. Merges known duplicate sponsors.
 * 4. Compares credited totals per member/group and fiscal year before and after,
 *    and rolls everything back on any difference.
 *
 * On success it writes the `MIGRATION_MARKER_KEY` setting in the same
 * transaction; every later run returns `skipped`. Before that, it also returns
 * `skipped` when nothing is left to migrate.
 */
export async function migrateSponsorAssignments(
  client: typeof prisma,
  merges: { keepId: string; mergeId: string }[] = DUPLICATE_MERGES
): Promise<MigrationResult> {
  if (!(await needsMigration(client))) return { status: 'skipped' }

  try {
    return await client.$transaction(
      async tx => {
        const pool = await getClubPool(tx)
        const before = await computeTotals(tx, true, pool.id)

        // 1. Assignments from the legacy owner columns. A sponsor with both a
        //    legacy member and group gets both assignments; its inherited
        //    donations go to the member (step 2), matching the legacy crediting.
        const missing = await findUnassignedOwners(tx)
        for (const m of missing) {
          await tx.sponsorAssignment.create({ data: m })
        }

        // 2. Fixed recipients for donations that inherited their sponsor's owner
        const recipientless = await tx.donation.findMany({
          where: { memberId: null, groupId: null },
          select: { id: true, sponsor: { select: { legacyMemberId: true, legacyGroupId: true } } }
        })
        for (const d of recipientless) {
          let data: Owner
          if (d.sponsor.legacyMemberId) {
            data = { memberId: d.sponsor.legacyMemberId, groupId: null }
          } else if (d.sponsor.legacyGroupId) {
            data = { memberId: null, groupId: d.sponsor.legacyGroupId }
          } else {
            console.warn(
              `Sponsor assignment migration: donation ${d.id} has no recipient and its sponsor no owner - credited to the club pool`
            )
            data = { memberId: null, groupId: pool.id }
          }
          await tx.donation.update({ where: { id: d.id }, data })
        }

        // 3. Known duplicates
        let sponsorsMerged = 0
        for (const { keepId, mergeId } of merges) {
          if (await mergeDuplicate(tx, keepId, mergeId)) sponsorsMerged++
        }

        // 4. Safety net: no member's or group's total may change
        const after = await computeTotals(tx, false, pool.id)
        const diffs = compareTotals(before, after)
        if (diffs.length > 0) throw new TotalsChangedError(diffs)

        const migratedAt = new Date().toISOString()
        await tx.setting.upsert({
          where: { key: MIGRATION_MARKER_KEY },
          create: {
            key: MIGRATION_MARKER_KEY,
            value: migratedAt,
            description: 'Sponsor assignment migration completed'
          },
          update: { value: migratedAt }
        })

        return {
          status: 'migrated' as const,
          assignmentsCreated: missing.length,
          donationsFilled: recipientless.length,
          sponsorsMerged
        }
      },
      { timeout: 120_000 }
    )
  } catch (error) {
    if (error instanceof TotalsChangedError) return { status: 'rolledBack', diffs: error.diffs }
    throw error
  }
}
