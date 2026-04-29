import { z } from 'zod'
import { type Locale, defaultLocale } from '@/lib/i18n/config'
import { getMessages, getLocaleFromRequest } from '@/lib/validation/i18n'
import { createZodI18nErrorMap } from '@/lib/validation/error-map'

// Re-export i18n utilities for API route convenience
export { getLocaleFromRequest, getMessages } from '@/lib/validation/i18n'

/**
 * Validation schemas for API routes using Zod
 * Provides type-safe validation and auto-generated TypeScript types
 *
 * Note: Error messages are now internationalized. Use validateRequestI18n()
 * in API routes to get locale-aware validation errors.
 */

// ============================================================================
// XOR Validation Helpers (Member OR Group, not both)
// ============================================================================

type MemberGroupFields = { memberId?: string | null; groupId?: string | null }

/** Validates that either memberId OR groupId is provided (for create operations) */
const requireMemberOrGroup = (data: MemberGroupFields) => data.memberId || data.groupId

/** Validates that both memberId AND groupId are not provided simultaneously */
const preventBothMemberAndGroup = (data: MemberGroupFields) => !(data.memberId && data.groupId)

/** For update operations: only validate if both fields are explicitly provided */
const requireMemberOrGroupOnUpdate = (data: MemberGroupFields) => {
  if (data.memberId !== undefined && data.groupId !== undefined) {
    return data.memberId || data.groupId
  }
  return true
}

const preventBothOnUpdate = (data: MemberGroupFields) => {
  if (data.memberId !== undefined && data.groupId !== undefined) {
    return !(data.memberId && data.groupId)
  }
  return true
}

// Reusable refinement configs
const memberOrGroupRequiredRefinement = {
  message: 'memberOrGroupRequired',
  path: ['memberId']
}

const cannotAssignBothRefinement = {
  message: 'cannotAssignBoth',
  path: ['groupId']
}

// ============================================================================
// Donation Schemas
// ============================================================================

export const donationTypeSchema = z.enum(['MONETARY', 'IN_KIND'])
export type DonationType = z.infer<typeof donationTypeSchema>

export const createDonationSchema = z.object({
  sponsorId: z.string().min(1),
  type: donationTypeSchema.default('MONETARY'),
  amount: z.number().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  donationDate: z.string().min(1),
  note: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable()
})
  .refine(requireMemberOrGroup, memberOrGroupRequiredRefinement)
  .refine(preventBothMemberAndGroup, cannotAssignBothRefinement)
  .refine(
    (data) => data.type === 'IN_KIND' || (data.amount !== null && data.amount !== undefined),
    { message: 'amountRequiredForMonetary', path: ['amount'] }
  )
  .refine(
    (data) => data.type === 'MONETARY' || (data.description && data.description.trim().length > 0),
    { message: 'descriptionRequiredForInKind', path: ['description'] }
  )

export const updateDonationSchema = z.object({
  sponsorId: z.string().min(1).optional(),
  type: donationTypeSchema.optional(),
  amount: z.number().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  donationDate: z.string().min(1).optional(),
  note: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable()
})
  .refine(preventBothOnUpdate, cannotAssignBothRefinement)
  .refine(requireMemberOrGroupOnUpdate, memberOrGroupRequiredRefinement)

export type CreateDonationInput = z.infer<typeof createDonationSchema>
export type UpdateDonationInput = z.infer<typeof updateDonationSchema>

// ============================================================================
// Sponsor Schemas
// ============================================================================

export const createSponsorSchema = z.object({
  company: z.string().optional().nullable(),
  salutation: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.email().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable()
})
  .refine(data => data.lastName || data.company, { message: 'nameOrCompanyRequired', path: ['lastName'] })
  .refine(requireMemberOrGroup, memberOrGroupRequiredRefinement)
  .refine(preventBothMemberAndGroup, cannotAssignBothRefinement)

export const updateSponsorSchema = z.object({
  company: z.string().optional().nullable(),
  salutation: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.email().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable()
})
  .refine(preventBothOnUpdate, cannotAssignBothRefinement)
  .refine(requireMemberOrGroupOnUpdate, memberOrGroupRequiredRefinement)

export type CreateSponsorInput = z.infer<typeof createSponsorSchema>
export type UpdateSponsorInput = z.infer<typeof updateSponsorSchema>

// ============================================================================
// Member Schemas
// ============================================================================

export const createMemberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable()
})

export const updateMemberSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  groupId: z.string().optional().nullable()
})

export type CreateMemberInput = z.infer<typeof createMemberSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>

// ============================================================================
// Group Schemas
// ============================================================================

export const createGroupSchema = z.object({
  name: z.string().min(1)
})

export const updateGroupSchema = z.object({
  name: z.string().min(1)
})

export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>

// ============================================================================
// User Schemas
// ============================================================================

export const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  name: z.string().optional().nullable()
})

export const updateUserSchema = z.object({
  username: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  name: z.string().optional().nullable()
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

// ============================================================================
// Target Schemas
// ============================================================================

export const updateTargetSchema = z.object({
  targetAmount: z.number().nonnegative()
})

export const bulkCreateTargetsSchema = z.object({
  fiscalYearId: z.string().min(1),
  defaultAmount: z.number().nonnegative()
})

export type UpdateTargetInput = z.infer<typeof updateTargetSchema>
export type BulkCreateTargetsInput = z.infer<typeof bulkCreateTargetsSchema>

// ============================================================================
// Fiscal Year Schemas
// ============================================================================

export const createFiscalYearSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  copyPreviousTargets: z.boolean().optional()
})

export type CreateFiscalYearInput = z.infer<typeof createFiscalYearSchema>

// ============================================================================
// Helper functions to validate and return typed data or error response
// ============================================================================

/**
 * Validate request data with internationalized error messages
 * This is the recommended function for API routes.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param locale - Locale for error messages (defaults to 'de')
 * @returns Validation result with localized error message
 *
 * @example
 * ```ts
 * const locale = getLocaleFromRequest(request)
 * const validation = await validateRequestI18n(createDonationSchema, body, locale)
 * if (!validation.success) {
 *   return NextResponse.json({ error: validation.error }, { status: 400 })
 * }
 * ```
 */
export async function validateRequestI18n<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  locale: Locale = defaultLocale
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    // Load translations for the locale
    const messages = await getMessages(locale)

    // Create locale-aware error map
    const errorMap = createZodI18nErrorMap(messages.validation)

    // Use safeParse and translate errors manually (Zod v4 API change)
    const result = schema.safeParse(data)

    if (result.success) {
      return { success: true, data: result.data }
    }

    // Translate the first error using our error map
    const firstIssue = result.error.issues[0]
    const translated = errorMap(firstIssue)
    return { success: false, error: translated.message }
  } catch (error) {
    // Fallback error message
    try {
      const messages = await getMessages(locale)
      return { success: false, error: messages.errors?.generic || 'Validation failed' }
    } catch {
      return { success: false, error: 'Validation failed' }
    }
  }
}
