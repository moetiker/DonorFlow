import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'
import { updateDonationSchema, validateRequestI18n, getLocaleFromRequest } from '@/lib/validation'

export const PUT = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: donationId } = await params
  const body = await request.json()

  // Extract locale from Accept-Language header
  const locale = getLocaleFromRequest(request)

  // Fetch existing donation to validate XOR constraint with merged values
  const existingDonation = await prisma.donation.findUnique({
    where: { id: donationId }
  })

  if (!existingDonation) {
    return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
  }

  // Validate request body with i18n (includes XOR validation for memberId/groupId)
  const validation = await validateRequestI18n(updateDonationSchema, body, locale)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { sponsorId, amount, donationDate, note, memberId, groupId } = validation.data

  // Merge with existing values to validate XOR constraint
  const mergedMemberId = memberId !== undefined ? memberId : existingDonation.memberId
  const mergedGroupId = groupId !== undefined ? groupId : existingDonation.groupId

  // Validate XOR constraint: exactly one must be set
  if (!mergedMemberId && !mergedGroupId) {
    const messages = await import(`@/messages/${locale}.json`)
    return NextResponse.json({
      error: messages.default.validation.errors.memberOrGroupRequired
    }, { status: 400 })
  }

  if (mergedMemberId && mergedGroupId) {
    const messages = await import(`@/messages/${locale}.json`)
    return NextResponse.json({
      error: messages.default.validation.errors.cannotAssignBoth
    }, { status: 400 })
  }

  // Build update data object (only include provided fields)
  const updateData: any = {}
  if (sponsorId !== undefined) updateData.sponsorId = sponsorId
  if (amount !== undefined) updateData.amount = amount
  if (note !== undefined) updateData.note = note || null
  if (memberId !== undefined) updateData.memberId = memberId || null
  if (groupId !== undefined) updateData.groupId = groupId || null

  // Re-calculate fiscal year if date changed
  if (donationDate !== undefined) {
    const parsedDate = new Date(donationDate)
    updateData.donationDate = parsedDate

    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: {
        startDate: { lte: parsedDate },
        endDate: { gte: parsedDate }
      }
    })
    updateData.fiscalYearId = fiscalYear?.id || null
  }

  // Update donation
  const donation = await prisma.donation.update({
    where: { id: donationId },
    data: updateData
  })

  return NextResponse.json(serializeDates(donation))
})

export const DELETE = withApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: donationId } = await params

  // Delete donation
  await prisma.donation.delete({
    where: { id: donationId }
  })

  return NextResponse.json({ success: true })
})
