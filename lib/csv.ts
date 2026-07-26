/**
 * CSV helpers shared across export routes.
 */

// Characters that make a spreadsheet treat a cell as a formula rather than as
// text. A sponsor's company or notes field is attacker-controlled in the sense
// that whoever fills in the address list decides what it says, and the export is
// handed to members who open it in Excel or LibreOffice.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r']

// Values a spreadsheet should keep interpreting as numbers, e.g. "-12.50".
// Without this, negative amounts would be neutralised into text.
// A leading "+" is deliberately NOT accepted here: "+41 79 …" is a phone number,
// and letting it through unprefixed makes Excel evaluate it as a number.
const NUMERIC = /^-?\d+(\.\d+)?$/

/**
 * Prefixes a value with an apostrophe when a spreadsheet would otherwise
 * evaluate it as a formula. Numbers are left alone so they stay numeric.
 */
function neutralizeFormula(str: string): string {
  if (NUMERIC.test(str)) return str
  if (FORMULA_TRIGGERS.some((trigger) => str.startsWith(trigger))) {
    return `'${str}`
  }
  return str
}

/**
 * Escapes a single CSV field value.
 * Neutralises spreadsheet formulas, then wraps the value in double quotes and
 * doubles inner quotes when it contains a comma, quote, or newline.
 */
export function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'number' ? String(value) : neutralizeFormula(String(value))
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
