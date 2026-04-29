import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'

interface CsvRow {
  [key: string]: string
}

function parseCsv(content: string, delimiter: string = ';'): CsvRow[] {
  // Parse CSV properly handling multi-line quoted fields
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"'
          i++
        } else {
          // End of quoted field
          inQuotes = false
        }
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === delimiter) {
        currentRow.push(currentField.trim())
        currentField = ''
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField.trim())
        if (currentRow.length > 1 || currentRow[0] !== '') {
          rows.push(currentRow)
        }
        currentRow = []
        currentField = ''
        if (char === '\r') i++ // Skip \n after \r
      } else if (char !== '\r') {
        currentField += char
      }
    }
  }

  // Don't forget the last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow)
    }
  }

  if (rows.length < 2) return []

  // First row is headers
  const headers = rows[0]
  const result: CsvRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i]
    const row: CsvRow = {}

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || ''
    }

    result.push(row)
  }

  return result
}

function normalizeString(str: string): string {
  // Normalize for comparison: lowercase, trim, and normalize umlauts
  return str
    .toLowerCase()
    .trim()
    // Normalize common umlaut variations
    .replace(/ä|ae|à|á|â/g, 'a')
    .replace(/ö|oe|ò|ó|ô/g, 'o')
    .replace(/ü|ue|ù|ú|û/g, 'u')
    .replace(/ë|è|é|ê/g, 'e')
    .replace(/ï|ì|í|î/g, 'i')
    .replace(/ß/g, 'ss')
    // Remove diacritics that might cause issues
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
      // Update existing member - only update if we have new data
      const updateData: { email?: string; phone?: string } = {}
      if (email) updateData.email = email
      if (phone) updateData.phone = phone

      if (Object.keys(updateData).length > 0) {
        await prisma.member.update({
          where: { id: existing.id },
          data: updateData
        })
      }
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

  // Read file content - try to detect encoding
  const buffer = await file.arrayBuffer()
  let content: string

  // Try UTF-8 first, then Latin-1 (ISO-8859-1) for Swiss/German files
  try {
    const utf8Content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    content = utf8Content
  } catch {
    // Fallback to Latin-1 (common for Swiss exports)
    content = new TextDecoder('iso-8859-1').decode(buffer)
  }

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
