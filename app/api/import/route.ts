import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'

interface CsvRow {
  [key: string]: string
}

function parseCsv(content: string, delimiter: string = ';'): CsvRow[] {
  const lines = content.split('\n')
  if (lines.length < 2) return []

  // Parse header
  const headers = parseCsvLine(lines[0], delimiter)
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCsvLine(line, delimiter)
    const row: CsvRow = {}

    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = values[j]?.trim() || ''
    }

    rows.push(row)
  }

  return rows
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())

  return values
}

function normalizeString(str: string): string {
  return str.toLowerCase().trim()
}

async function importMembers(rows: CsvRow[]): Promise<{ created: number; updated: number }> {
  let created = 0
  let updated = 0

  // Get all existing members for matching
  const existingMembers = await prisma.member.findMany()

  for (const row of rows) {
    // Map CSV columns (German headers from the format shown in the UI)
    const lastName = row['Nachname'] || row['lastName'] || ''
    const firstName = row['Vorname'] || row['firstName'] || ''
    const phone = row['Telefon Mobil'] || row['Telefon'] || row['phone'] || ''
    const email = row['E-Mail'] || row['email'] || ''

    if (!firstName && !lastName) continue

    // Find existing member by name (case-insensitive)
    const existing = existingMembers.find(m =>
      normalizeString(m.firstName) === normalizeString(firstName) &&
      normalizeString(m.lastName) === normalizeString(lastName)
    )

    if (existing) {
      // Update existing member
      await prisma.member.update({
        where: { id: existing.id },
        data: {
          // Only update fields if they have values in CSV
          ...(email && { email }),
          ...(phone && { phone })
        }
      })
      updated++
    } else {
      // Create new member
      await prisma.member.create({
        data: {
          firstName,
          lastName,
          email: email || null,
          phone: phone || null
        }
      })
      created++
    }
  }

  return { created, updated }
}

async function importSponsors(rows: CsvRow[]): Promise<{ created: number; updated: number }> {
  let created = 0
  let updated = 0

  // Get all existing sponsors for matching
  const existingSponsors = await prisma.sponsor.findMany()

  for (const row of rows) {
    // Map CSV columns (German headers)
    const company = row['Firma'] || row['company'] || ''
    const salutation = row['Anrede'] || row['salutation'] || ''
    const firstName = row['Vorname'] || row['firstName'] || ''
    const lastName = row['Name'] || row['lastName'] || ''
    const street = row['Strasse'] || row['street'] || ''
    const postalCode = row['PLZ'] || row['postalCode'] || ''
    const city = row['Ort'] || row['city'] || ''
    const phone = row['Telefon'] || row['phone'] || ''
    const email = row['E-Mail'] || row['email'] || ''

    // Skip empty rows
    if (!lastName && !company) continue

    // Find existing sponsor by matching criteria:
    // - If company exists: match by company name
    // - Otherwise: match by firstName + lastName
    const existing = existingSponsors.find(s => {
      if (company && s.company) {
        return normalizeString(s.company) === normalizeString(company)
      }
      return normalizeString(s.firstName || '') === normalizeString(firstName) &&
             normalizeString(s.lastName || '') === normalizeString(lastName)
    })

    const sponsorData = {
      company: company || null,
      salutation: salutation || null,
      firstName: firstName || null,
      lastName: lastName || null,
      street: street || null,
      postalCode: postalCode || null,
      city: city || null,
      phone: phone || null,
      email: email || null
    }

    if (existing) {
      // Update existing sponsor - only update non-empty fields
      const updateData: Record<string, string | null> = {}
      for (const [key, value] of Object.entries(sponsorData)) {
        if (value) {
          updateData[key] = value
        }
      }

      await prisma.sponsor.update({
        where: { id: existing.id },
        data: updateData
      })
      updated++
    } else {
      // Create new sponsor
      await prisma.sponsor.create({
        data: sponsorData
      })
      created++
    }
  }

  return { created, updated }
}

export const POST = withApiRoute(async (request: NextRequest) => {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as string

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!['members', 'sponsors'].includes(type)) {
    return NextResponse.json({ error: 'Invalid import type' }, { status: 400 })
  }

  // Read file content
  const content = await file.text()

  // Detect delimiter (semicolon or comma)
  const firstLine = content.split('\n')[0]
  const delimiter = firstLine.includes(';') ? ';' : ','

  // Parse CSV
  const rows = parseCsv(content, delimiter)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data found in CSV' }, { status: 400 })
  }

  let result: { created: number; updated: number }

  if (type === 'members') {
    result = await importMembers(rows)
  } else {
    result = await importSponsors(rows)
  }

  return NextResponse.json({
    success: true,
    count: result.created + result.updated,
    created: result.created,
    updated: result.updated
  })
})
