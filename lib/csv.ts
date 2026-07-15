/**
 * CSV helpers shared across export routes.
 */

/**
 * Escapes a single CSV field value.
 * Wraps the value in double quotes and doubles inner quotes when it contains
 * a comma, quote, or newline.
 */
export function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Builds a CSV document from a header row and data rows.
 * Each cell is escaped via {@link escapeCSV}.
 */
export function buildCSV(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n')
}
