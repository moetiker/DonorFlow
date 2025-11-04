import { z } from 'zod'
import { interpolate } from './i18n'

/**
 * Create Zod error map with i18n support
 * Maps Zod error codes to translated messages with parameter interpolation
 *
 * This is the industry-standard approach for internationalizing Zod validation errors.
 * It uses Zod's built-in errorMap feature to provide custom, localized error messages.
 *
 * @param translations - The validation namespace from messages/{locale}.json
 * @returns A Zod error map function
 *
 * @example
 * const messages = await getMessages('de')
 * const errorMap = createZodI18nErrorMap(messages.validation)
 * const result = schema.safeParse(data, { errorMap })
 */
export function createZodI18nErrorMap(
  translations: Record<string, string>
): z.ZodErrorMap {
  return (issue, ctx) => {
    let message: string

    switch (issue.code) {
      case z.ZodIssueCode.invalid_type:
        if (issue.received === z.ZodParsedType.undefined) {
          message = translations.required || 'Required'
        } else {
          message = translations.invalidType || 'Invalid type'
        }
        break

      case z.ZodIssueCode.invalid_literal:
        message = translations.invalidLiteral || 'Invalid literal value'
        break

      case z.ZodIssueCode.unrecognized_keys:
        message = translations.unrecognizedKeys || 'Unrecognized keys'
        break

      case z.ZodIssueCode.invalid_union:
        message = translations.invalidUnion || 'Invalid input'
        break

      case z.ZodIssueCode.invalid_union_discriminator:
        message = translations.invalidUnionDiscriminator || 'Invalid discriminator value'
        break

      case z.ZodIssueCode.invalid_enum_value:
        message = translations.invalidEnumValue || 'Invalid enum value'
        break

      case z.ZodIssueCode.invalid_arguments:
        message = translations.invalidArguments || 'Invalid function arguments'
        break

      case z.ZodIssueCode.invalid_return_type:
        message = translations.invalidReturnType || 'Invalid function return type'
        break

      case z.ZodIssueCode.invalid_date:
        message = translations.invalidDate || 'Invalid date'
        break

      case z.ZodIssueCode.invalid_string:
        if (issue.validation === 'email') {
          message = translations.email || 'Invalid email address'
        } else if (issue.validation === 'url') {
          message = translations.invalidUrl || 'Invalid URL'
        } else if (issue.validation === 'uuid') {
          message = translations.invalidUuid || 'Invalid UUID'
        } else if (issue.validation === 'cuid') {
          message = translations.invalidCuid || 'Invalid CUID'
        } else if (issue.validation === 'regex') {
          message = translations.invalidRegex || 'Invalid format'
        } else {
          message = translations.invalidString || 'Invalid string'
        }
        break

      case z.ZodIssueCode.too_small:
        if (issue.type === 'string') {
          if (issue.minimum === 1) {
            // Special case: min(1) typically means "required"
            message = translations.required || 'Required'
          } else {
            message = interpolate(
              translations.minLength || 'Must be at least {min} characters',
              { min: Number(issue.minimum) }
            )
          }
        } else if (issue.type === 'number') {
          if (issue.minimum === 0 && !issue.inclusive) {
            // positive() - must be greater than 0
            message = translations.positive || 'Must be greater than 0'
          } else if (issue.minimum === 0 && issue.inclusive) {
            // nonnegative() - must be >= 0
            message = translations.nonnegative || 'Must be positive'
          } else {
            message = interpolate(
              translations.minValue || 'Must be at least {min}',
              { min: Number(issue.minimum) }
            )
          }
        } else if (issue.type === 'array') {
          message = interpolate(
            translations.minItems || 'Must contain at least {min} items',
            { min: Number(issue.minimum) }
          )
        } else if (issue.type === 'date') {
          message = interpolate(
            translations.minDate || 'Date must be after {min}',
            { min: new Date(issue.minimum as number).toLocaleDateString() }
          )
        } else {
          message = translations.tooSmall || 'Too small'
        }
        break

      case z.ZodIssueCode.too_big:
        if (issue.type === 'string') {
          message = interpolate(
            translations.maxLength || 'Must be at most {max} characters',
            { max: Number(issue.maximum) }
          )
        } else if (issue.type === 'number') {
          message = interpolate(
            translations.maxValue || 'Must be at most {max}',
            { max: Number(issue.maximum) }
          )
        } else if (issue.type === 'array') {
          message = interpolate(
            translations.maxItems || 'Must contain at most {max} items',
            { max: Number(issue.maximum) }
          )
        } else if (issue.type === 'date') {
          message = interpolate(
            translations.maxDate || 'Date must be before {max}',
            { max: new Date(issue.maximum as number).toLocaleDateString() }
          )
        } else {
          message = translations.tooBig || 'Too big'
        }
        break

      case z.ZodIssueCode.custom:
        // For custom error messages (like refine())
        // Check if message is a translation key
        const customMessage = issue.message || ctx.defaultError

        // If it's a known validation key, translate it
        if (customMessage && translations[customMessage]) {
          message = translations[customMessage]
        } else {
          message = customMessage
        }
        break

      case z.ZodIssueCode.invalid_intersection_types:
        message = translations.invalidIntersectionTypes || 'Intersection results could not be merged'
        break

      case z.ZodIssueCode.not_multiple_of:
        message = interpolate(
          translations.notMultipleOf || 'Must be a multiple of {multipleOf}',
          { multipleOf: Number(issue.multipleOf) }
        )
        break

      case z.ZodIssueCode.not_finite:
        message = translations.notFinite || 'Number must be finite'
        break

      default:
        message = ctx.defaultError
    }

    return { message }
  }
}
