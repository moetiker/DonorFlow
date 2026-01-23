import { z } from 'zod'
import { interpolate } from './i18n'

/**
 * Create Zod error map with i18n support
 * Maps Zod error codes to translated messages with parameter interpolation
 *
 * Updated for Zod v4 compatibility.
 *
 * @param translations - The validation namespace from messages/{locale}.json
 * @returns A Zod error map function
 */
export function createZodI18nErrorMap(
  translations: Record<string, string>
): (issue: z.ZodIssue) => { message: string } {
  return (issue) => {
    let message: string

    // Use string comparison for issue codes to handle Zod v4 changes
    const code = issue.code as string

    switch (code) {
      case 'invalid_type': {
        // Check if this is a "required" error (value is undefined/missing)
        // Zod v4 uses 'received' property, fallback to checking 'input'
        const typeIssue = issue as { received?: string; input?: unknown }
        const isUndefined = typeIssue.received === 'undefined' ||
                           typeIssue.input === undefined
        if (isUndefined) {
          message = translations.required || 'Required'
        } else {
          message = translations.invalidType || 'Invalid type'
        }
        break
      }

      case 'invalid_literal':
      case 'invalid_value':
        message = translations.invalidLiteral || 'Invalid value'
        break

      case 'unrecognized_keys':
        message = translations.unrecognizedKeys || 'Unrecognized keys'
        break

      case 'invalid_union':
        message = translations.invalidUnion || 'Invalid input'
        break

      case 'invalid_union_discriminator':
        message = translations.invalidUnionDiscriminator || 'Invalid discriminator value'
        break

      case 'invalid_enum_value':
        message = translations.invalidEnumValue || 'Invalid enum value'
        break

      case 'invalid_arguments':
        message = translations.invalidArguments || 'Invalid function arguments'
        break

      case 'invalid_return_type':
        message = translations.invalidReturnType || 'Invalid function return type'
        break

      case 'invalid_date':
        message = translations.invalidDate || 'Invalid date'
        break

      case 'invalid_string':
      case 'invalid_format': {
        // Handle string format validation (Zod v4 uses invalid_format)
        const validation = (issue as { format?: string }).format ||
                          (issue as { validation?: string }).validation
        if (validation === 'email') {
          message = translations.email || 'Invalid email address'
        } else if (validation === 'url') {
          message = translations.invalidUrl || 'Invalid URL'
        } else if (validation === 'uuid') {
          message = translations.invalidUuid || 'Invalid UUID'
        } else if (validation === 'cuid') {
          message = translations.invalidCuid || 'Invalid CUID'
        } else if (validation === 'regex') {
          message = translations.invalidRegex || 'Invalid format'
        } else {
          message = translations.invalidString || 'Invalid string'
        }
        break
      }

      case 'too_small': {
        const smallIssue = issue as {
          origin?: string
          type?: string
          minimum?: number | bigint
          min?: number | bigint
          inclusive?: boolean
        }
        const type = smallIssue.origin || smallIssue.type
        const minimum = smallIssue.minimum ?? smallIssue.min ?? 0

        if (type === 'string') {
          if (minimum === 1 || minimum === BigInt(1)) {
            message = translations.required || 'Required'
          } else {
            message = interpolate(
              translations.minLength || 'Must be at least {min} characters',
              { min: Number(minimum) }
            )
          }
        } else if (type === 'number') {
          if ((minimum === 0 || minimum === BigInt(0)) && !smallIssue.inclusive) {
            message = translations.positive || 'Must be greater than 0'
          } else if ((minimum === 0 || minimum === BigInt(0)) && smallIssue.inclusive) {
            message = translations.nonnegative || 'Must be positive'
          } else {
            message = interpolate(
              translations.minValue || 'Must be at least {min}',
              { min: Number(minimum) }
            )
          }
        } else if (type === 'array') {
          message = interpolate(
            translations.minItems || 'Must contain at least {min} items',
            { min: Number(minimum) }
          )
        } else {
          message = translations.tooSmall || 'Too small'
        }
        break
      }

      case 'too_big': {
        const bigIssue = issue as {
          origin?: string
          type?: string
          maximum?: number | bigint
          max?: number | bigint
        }
        const type = bigIssue.origin || bigIssue.type
        const maximum = bigIssue.maximum ?? bigIssue.max ?? 0

        if (type === 'string') {
          message = interpolate(
            translations.maxLength || 'Must be at most {max} characters',
            { max: Number(maximum) }
          )
        } else if (type === 'number') {
          message = interpolate(
            translations.maxValue || 'Must be at most {max}',
            { max: Number(maximum) }
          )
        } else if (type === 'array') {
          message = interpolate(
            translations.maxItems || 'Must contain at most {max} items',
            { max: Number(maximum) }
          )
        } else {
          message = translations.tooBig || 'Too big'
        }
        break
      }

      case 'custom':
        // For custom error messages (like refine())
        const customMessage = issue.message || 'Validation failed'
        if (customMessage && translations[customMessage]) {
          message = translations[customMessage]
        } else {
          message = customMessage
        }
        break

      case 'invalid_intersection_types':
        message = translations.invalidIntersectionTypes || 'Intersection results could not be merged'
        break

      case 'not_multiple_of': {
        const multipleOfIssue = issue as { multipleOf?: number }
        message = interpolate(
          translations.notMultipleOf || 'Must be a multiple of {multipleOf}',
          { multipleOf: Number(multipleOfIssue.multipleOf || 0) }
        )
        break
      }

      case 'not_finite':
        message = translations.notFinite || 'Number must be finite'
        break

      default:
        message = issue.message || 'Validation failed'
    }

    return { message }
  }
}
