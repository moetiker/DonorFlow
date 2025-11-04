import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as Papa from 'papaparse'

const prisma = new PrismaClient()

interface SponsorRow {
  Member: string
  Min: string
  Firma: string
  Anrede: string
  Vorname: string
  Name: string
  Strasse: string
  PLZ: string
  Ort: string
  Betrag: string
}

function parseCurrency(amount: string): number {
  if (!amount) return 0
  // Remove "CHF", spaces, apostrophes (thousands separator)
  const cleaned = amount.replace(/CHF|'|\s/g, '').replace(',', '.')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

async function importDonations() {
  console.log('💰 Importing donations from sponsors.csv...\n')

  const csvContent = fs.readFileSync('data/sponsors.csv', 'utf-8')
  const { data } = Papa.parse<SponsorRow>(csvContent, {
    header: true,
    skipEmptyLines: true
  })

  // Get current fiscal year
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: {
      startDate: { lte: new Date() },
      endDate: { gte: new Date() }
    }
  })

  if (!fiscalYear) {
    console.error('❌ No current fiscal year found')
    return
  }

  console.log(`📅 Using fiscal year: ${fiscalYear.name}`)

  let imported = 0
  let skipped = 0
  let notFound = 0

  for (const row of data) {
    // Skip if no amount
    const amount = parseCurrency(row.Betrag)
    if (amount <= 0) {
      skipped++
      continue
    }

    // Try to find the sponsor by matching name
    const searchName = row.Name?.trim()
    const searchFirstName = row.Vorname?.trim()
    const searchCompany = row.Firma?.trim()

    if (!searchName && !searchCompany) {
      skipped++
      continue
    }

    try {
      // Build search criteria
      const whereConditions: any = {
        OR: []
      }

      if (searchCompany) {
        whereConditions.OR.push({ company: searchCompany })
      }

      if (searchName) {
        whereConditions.OR.push({
          lastName: searchName,
          ...(searchFirstName && { firstName: searchFirstName })
        })
      }

      // Find matching sponsor
      const sponsor = await prisma.sponsor.findFirst({
        where: whereConditions
      })

      if (!sponsor) {
        console.log(`  ⚠ Sponsor not found: ${searchCompany || `${searchFirstName} ${searchName}`}`)
        notFound++
        continue
      }

      // Create donation
      await prisma.donation.create({
        data: {
          sponsorId: sponsor.id,
          amount: amount,
          donationDate: fiscalYear.startDate, // Use fiscal year start date as donation date
          fiscalYearId: fiscalYear.id, // Add fiscalYearId
          note: `Importiert aus CSV (${row.Member})`
        }
      })

      imported++
      const displayName = searchCompany || `${searchFirstName || ''} ${searchName}`.trim()
      console.log(`  ✓ CHF ${amount.toFixed(2)} → ${displayName}`)

    } catch (error) {
      console.error(`  ✗ Error importing donation for ${searchName}:`, error)
      skipped++
    }
  }

  console.log(`\n✅ Import completed!`)
  console.log(`   Imported: ${imported} donations`)
  console.log(`   Skipped (no amount): ${skipped}`)
  console.log(`   Not found: ${notFound}`)
}

async function main() {
  console.log('🚀 Starting donation import...\n')

  try {
    await importDonations()
  } catch (error) {
    console.error('\n❌ Import failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
