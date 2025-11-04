/**
 * Validation utilities with i18n support
 *
 * This module provides internationalized validation for Zod schemas.
 * It follows the industry-standard approach of using Zod's error map feature.
 *
 * @see https://zod.dev/error-customization
 */

export { getLocaleFromRequest, getMessages, interpolate } from './i18n'
export { createZodI18nErrorMap } from './error-map'

// Re-export everything from main validation file
export * from '../validation'
