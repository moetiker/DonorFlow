import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./prisma/prod.db'
}, {
  timestampFormat: 'unixepoch-ms'
})

const prisma = new PrismaClient({ adapter })

interface CsvRow {
  lastName: string
  firstName: string
  phone: string
  email: string
}

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const rows: CsvRow[] = []

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parse semicolon-separated values with quotes
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ';' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())

    // Extract relevant columns (0=lastName, 1=firstName, 5=phone, 6=email)
    if (values.length > 6) {
      rows.push({
        lastName: values[0],
        firstName: values[1],
        phone: values[5],
        email: values[6]
      })
    }
  }

  return rows
}

async function main() {
  const csvPath = path.join(process.cwd(), 'address-infos.csv')

  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath)
    process.exit(1)
  }

  const contacts = parseCsv(csvPath)
  console.log(`Parsed ${contacts.length} contacts from CSV`)

  // Get all members from database
  const members = await prisma.member.findMany()
  console.log(`Found ${members.length} members in database`)

  let updated = 0
  let notFound = 0

  for (const contact of contacts) {
    // Skip if no email and no phone
    if (!contact.email && !contact.phone) continue

    // Find matching member by name
    const member = members.find(m =>
      m.firstName.toLowerCase() === contact.firstName.toLowerCase() &&
      m.lastName.toLowerCase() === contact.lastName.toLowerCase()
    )

    if (member) {
      // Update member with contact info
      await prisma.member.update({
        where: { id: member.id },
        data: {
          email: contact.email || null,
          phone: contact.phone || null
        }
      })
      console.log(`Updated: ${contact.firstName} ${contact.lastName} - ${contact.email || '-'} / ${contact.phone || '-'}`)
      updated++
    } else {
      console.log(`Not found: ${contact.firstName} ${contact.lastName}`)
      notFound++
    }
  }

  console.log(`\nSummary:`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Not found: ${notFound}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
