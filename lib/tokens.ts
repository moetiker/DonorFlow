import { randomBytes } from 'crypto'

/**
 * Generates a 32-character URL-safe token with 192 bits entropy
 * Uses base64url encoding (no +, /, or = characters)
 */
export function generateStatusToken(): string {
  return randomBytes(24).toString('base64url')
}
