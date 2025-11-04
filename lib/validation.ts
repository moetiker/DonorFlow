import { z } from 'zod'
import { type Locale, defaultLocale } from '@/lib/i18n/config'
import { getMessages, getLocaleFromRequest, interpolate } from '@/lib/validation/i18n'
import { createZodI18nErrorMap } from '@/lib/validation/error-map'

// Re-export i18n utilities for convenience
export { getLocaleFromRequest, getMessages, interpolate } from '@/lib/validation/i18n'
export { createZodI18nErrorMap } from '@/lib/validation/error-map'

/**
 * Validation schemas for API routes using Zod
 * Provides type-safe validation and auto-generated TypeScript types
 *
 * Note: Error messages are now internationalized. Use validateRequestI18n()
 * in API routes to get locale-aware validation errors.
 */

// ============================================================================
// Donation Schemas
// ============================================================================

export const createDonationSchema = z.object({
  sponsorId: z.string().min(1),
  amount: z.number().positive(),
  donationDate: z.string().min(1),
  note: z.string().optional().nullable()
})

export const updateDonationSchema = z.object({
  sponsorId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  donationDate: z.string().min(1).optional(),
  note: z.string().optional().nullable()
})

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
  email: z.string().email().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable()
}).refine(
  data => data.lastName || data.company,
  { message: 'nameOrCompanyRequired', path: ['lastName'] }
).refine(
  data => data.memberId || data.groupId,
  { message: 'memberOrGroupRequired', path: ['memberId'] }
).refine(
  data => !(data.memberId && data.groupId),
  { message: 'cannotAssignBoth', path: ['groupId'] }
)

export const updateSponsorSchema = z.object({
  company: z.string().optional().nullable(),
  salutation: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable()
}).refine(
  data => {
    // Only validate if both are provided
    if (data.memberId !== undefined && data.groupId !== undefined) {
      return !(data.memberId && data.groupId)
    }
    return true
  },
  { message: 'cannotAssignBoth', path: ['groupId'] }
).refine(
  data => {
    // Only validate if both are provided
    if (data.memberId !== undefined && data.groupId !== undefined) {
      return data.memberId || data.groupId
    }
    return true
  },
  { message: 'memberOrGroupRequired', path: ['memberId'] }
)

export type CreateSponsorInput = z.infer<typeof createSponsorSchema>
export type UpdateSponsorInput = z.infer<typeof updateSponsorSchema>

// ============================================================================
// Member Schemas
// ============================================================================

export const createMemberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1)
})

export const updateMemberSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
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

    // Parse with custom error map
    const validated = schema.parse(data, { errorMap })
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Return the first error message (already translated)
      const firstError = error.errors[0]
      return { success: false, error: firstError.message }
    }

    // Fallback error message
    try {
      const messages = await getMessages(locale)
      return { success: false, error: messages.errors?.generic || 'Validation failed' }
    } catch {
      return { success: false, error: 'Validation failed' }
    }
  }
}

/**
 * @deprecated Use validateRequestI18n() for internationalized error messages
 *
 * Legacy validation function with hardcoded German error messages.
 * Kept for backward compatibility during migration.
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Return the first error message
      const firstError = error.errors[0]
      return { success: false, error: firstError.message }
    }
    return { success: false, error: 'Validierung fehlgeschlagen' }
  }
}
