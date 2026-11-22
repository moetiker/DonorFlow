import type { Prisma } from '@prisma/client'
import type { PrismaClientOrTx } from '@/lib/club-pool'
import { donationsCreditedTo, donationsCreditedToGroupTotal } from '@/lib/crediting'

/**
 * Admin figures (reports, dashboard, lists) computed from the donations'
 * explicit recipients. A sponsor's assignments never decide where a donation
 * counts.
 */

export type DonationType = 'MONETARY' | 'IN_KIND'

/** Restricts a credited-donation filter to one fiscal year and optionally one type. */
export function inFiscalYear(
  where: Prisma.DonationWhereInput,
  fiscalYearId: string,
  type?: DonationType
): Prisma.DonationWhereInput {
  return { AND: [where, { fiscalYearId, ...(type ? { type } : {}) }] }
}

/** Donations without any recipient (none after the migration; kept as a safety bucket). */
export const donationsWithoutRecipient: Prisma.DonationWhereInput = { memberId: null, groupId: null }

/** Sum of amounts and number of the donations matching a filter. */
export type Figures = { actual: number; donationCount: number }

async function figures(client: PrismaClientOrTx, where: Prisma.DonationWhereInput): Promise<Figures> {
  const agg = await client.donation.aggregate({ where, _sum: { amount: true }, _count: { _all: true } })
  return { actual: agg._sum.amount ?? 0, donationCount: agg._count._all }
}

/** Sum and count of the donations credited to a member in a fiscal year. */
export async function memberFigures(
  client: PrismaClientOrTx,
  memberId: string,
  fiscalYearId: string,
  type?: DonationType
): Promise<Figures> {
  return figures(client, inFiscalYear(donationsCreditedTo({ memberId }), fiscalYearId, type))
}

/** Sum of the donations credited to a member in a fiscal year. */
export async function memberActual(
  client: PrismaClientOrTx,
  memberId: string,
  fiscalYearId: string,
  type?: DonationType
): Promise<number> {
  return (await memberFigures(client, memberId, fiscalYearId, type)).actual
}

/**
 * Filter for a group's total: donations credited to the group itself and to
 * its current members.
 */
export async function groupTotalWhere(
  client: PrismaClientOrTx,
  groupId: string
): Promise<Prisma.DonationWhereInput> {
  const members = await client.member.findMany({ where: { groupId }, select: { id: true } })
  return donationsCreditedToGroupTotal(groupId, members.map(m => m.id))
}

/** Sum and count of a group's total in a fiscal year (see groupTotalWhere). */
export async function groupFigures(
  client: PrismaClientOrTx,
  groupId: string,
  fiscalYearId: string,
  type?: DonationType
): Promise<Figures> {
  return figures(client, inFiscalYear(await groupTotalWhere(client, groupId), fiscalYearId, type))
}

/** Sum of a group's total in a fiscal year (see groupTotalWhere). */
export async function groupActual(
  client: PrismaClientOrTx,
  groupId: string,
  fiscalYearId: string,
  type?: DonationType
): Promise<number> {
  return (await groupFigures(client, groupId, fiscalYearId, type)).actual
}

/** Sum and count of the donations without a recipient in a fiscal year. */
export async function unassignedFigures(
  client: PrismaClientOrTx,
  fiscalYearId: string,
  type?: DonationType
): Promise<Figures> {
  return figures(client, inFiscalYear(donationsWithoutRecipient, fiscalYearId, type))
}

/** Sum of the donations without a recipient in a fiscal year. */
export async function unassignedActual(
  client: PrismaClientOrTx,
  fiscalYearId: string,
  type?: DonationType
): Promise<number> {
  return (await unassignedFigures(client, fiscalYearId, type)).actual
}

/** Club-level actuals of a fiscal year, split by where the donations are credited. */
export type ClubFigures = {
  memberActual: number
  groupActual: number
  unassignedTotal: number
  totalActual: number
}

/**
 * Club-level actuals of a fiscal year: members without a group, every group's
 * total (dissolved groups included: their history stays credited to them and
 * dissolving must not shrink the club's numbers) and donations without a
 * recipient. Each donation is counted exactly once.
 */
export async function clubFigures(
  client: PrismaClientOrTx,
  fiscalYearId: string,
  type?: DonationType
): Promise<ClubFigures> {
  const add = (values: number[]) => values.reduce((acc, v) => acc + v, 0)
  const members = await client.member.findMany({ where: { groupId: null }, select: { id: true } })
  const groups = await client.group.findMany({ select: { id: true } })
  const memberTotal = add(await Promise.all(members.map(m => memberActual(client, m.id, fiscalYearId, type))))
  const groupTotal = add(await Promise.all(groups.map(g => groupActual(client, g.id, fiscalYearId, type))))
  const unassignedTotal = await unassignedActual(client, fiscalYearId, type)
  return {
    memberActual: memberTotal,
    groupActual: groupTotal,
    unassignedTotal,
    totalActual: memberTotal + groupTotal + unassignedTotal
  }
}
