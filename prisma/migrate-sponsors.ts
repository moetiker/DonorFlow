import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Migration script to convert old Sponsor schema to new schema
 * Old: name, address
 * New: company, salutation, firstName, lastName, street, postalCode, city, phone, email, notes
 */

function parseAddress(address: string | null): { street?: string; postalCode?: string; city?: string } {
  if (!address) return {}

  // Address format: "Street Nr, Postal City" or "Street Nr\nPostal City"
  // Examples:
  // - "Street 20, 1234 City"
  // - "Street 1\n1000 City"

  const result: { street?: string; postalCode?: string; city?: string } = {}

  // Replace newlines with comma for uniform parsing
  const normalized = address.replace(/\n/g, ', ').trim()

  // Pattern: street, PLZ city
  const match = normalized.match(/^(.+?),\s*(\d{4})\s+(.+)$/)

  if (match) {
    result.street = match[1].trim()
    result.postalCode = match[2].trim()
    result.city = match[3].trim()
  } else {
    // If parsing fails, put everything into street field
    result.street = normalized
  }

  return result
}

async function main() {
  console.log('🔄 Starting sponsor data migration...')

  // Get all existing sponsors
  const sponsors = await prisma.$queryRaw<Array<{
    id: string
    name: string | null
    address: string | null
  }>>`SELECT id, name, address FROM Sponsor`

  console.log(`📊 Found ${sponsors.length} sponsors to migrate`)

  let migrated = 0
  let skipped = 0

  for (const sponsor of sponsors) {
    try {
      const { street, postalCode, city } = parseAddress(sponsor.address)

      // Parse name - could be "Firma", "Vorname Name", "Fam. Vorname + Name", etc.
      let lastName = sponsor.name || 'Unbekannt'
      let firstName: string | undefined
      let salutation: string | undefined
      let company: string | undefined

      // Check for family patterns like "Fam. Irene + René"
      const famMatch = lastName.match(/^(Fam\.|Familie)\s*(.+)$/i)
      if (famMatch) {
        salutation = 'Familie'
        lastName = famMatch[2].trim()
      }

      // For migration: keep it simple - use the name as lastName
      // Manual editing can refine this later

      await prisma.$executeRaw`
        UPDATE Sponsor
        SET
          lastName = ${lastName},
          firstName = ${firstName || null},
          salutation = ${salutation || null},
          company = ${company || null},
          street = ${street || null},
          postalCode = ${postalCode || null},
          city = ${city || null},
          notes = NULL
        WHERE id = ${sponsor.id}
      `

      migrated++
      console.log(`✅ Migrated: ${sponsor.name || 'unnamed'} (${street || ''}, ${postalCode || ''} ${city || ''})`)
    } catch (error) {
      console.error(`❌ Error migrating sponsor ${sponsor.id}:`, error)
      skipped++
    }
  }

  console.log(`\n✨ Migration complete!`)
  console.log(`   Migrated: ${migrated}`)
  console.log(`   Skipped: ${skipped}`)
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
