import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as Papa from 'papaparse'

const prisma = new PrismaClient()

interface MemberRow {
  Nachname: string
  Vorname: string
  Adresse: string
  PLZ: string
  Ort: string
  'Telefon Mobil': string
  'E-Mail': string
  Geburtsdatum: string
}

interface SponsorRow {
  Member: string  // Member assignment
  Min: string   // Minimum/Target amount
  Firma: string
  Anrede: string
  Vorname: string
  Name: string
  Strasse: string
  PLZ: string
  Ort: string
  Betrag: string
}

async function clearAllData() {
  console.log('🗑️  Clearing all existing data...')

  // Delete in correct order due to foreign keys
  await prisma.donation.deleteMany()
  await prisma.sponsor.deleteMany()
  await prisma.memberTarget.deleteMany()
  await prisma.group.deleteMany()
  await prisma.member.deleteMany()
  await prisma.fiscalYear.deleteMany()
  await prisma.setting.deleteMany()

  console.log('✅ All data cleared')
}

async function importMembers() {
  console.log('\n📥 Importing members from members.csv...')

  const csvContent = fs.readFileSync('data/members.csv', 'utf-8')
  const { data } = Papa.parse<MemberRow>(csvContent, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true
  })

  let imported = 0
  const memberMap = new Map<string, string>() // firstName+lastName -> id

  for (const row of data) {
    if (!row.Nachname || !row.Vorname) continue

    try {
      const member = await prisma.member.create({
        data: {
          firstName: row.Vorname.trim(),
          lastName: row.Nachname.trim()
        }
      })

      memberMap.set(`${row.Vorname.trim()} ${row.Nachname.trim()}`, member.id)
      imported++
      console.log(`  ✓ ${row.Vorname} ${row.Nachname}`)
    } catch (error) {
      console.error(`  ✗ Error importing ${row.Vorname} ${row.Nachname}:`, error)
    }
  }

  console.log(`✅ Imported ${imported} members`)
  return memberMap
}

async function createGroups(memberMap: Map<string, string>) {
  console.log('\n👥 Creating groups...')

  // Parse group assignments from sponsor CSV
  const csvContent = fs.readFileSync('data/sponsors.csv', 'utf-8')
  const { data } = Papa.parse<SponsorRow>(csvContent, {
    header: true,
    skipEmptyLines: true
  })

  const groupMembers = new Map<string, Set<string>>() // groupName -> Set of member names

  for (const row of data) {
    const memberAssignment = row.Member?.trim()
    if (!memberAssignment) continue

    // Check if it's a group (contains multiple names or + sign)
    if (memberAssignment.includes('+') || memberAssignment.includes(' ')) {
      if (!groupMembers.has(memberAssignment)) {
        groupMembers.set(memberAssignment, new Set())
      }
    }
  }

  const groupMap = new Map<string, string>() // groupName -> groupId

  for (const [groupName, _] of groupMembers) {
    try {
      const group = await prisma.group.create({
        data: { name: groupName }
      })
      groupMap.set(groupName, group.id)
      console.log(`  ✓ Group: ${groupName}`)
    } catch (error) {
      console.error(`  ✗ Error creating group ${groupName}:`, error)
    }
  }

  console.log(`✅ Created ${groupMap.size} groups`)
  return groupMap
}

function parseCurrency(amount: string): number {
  if (!amount) return 0
  // Remove "CHF", spaces, apostrophes (thousands separator)
  const cleaned = amount.replace(/CHF|'|\s/g, '').replace(',', '.')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

async function importSponsors(memberMap: Map<string, string>, groupMap: Map<string, string>) {
  console.log('\n💰 Importing sponsors from sponsors.csv...')

  const csvContent = fs.readFileSync('data/sponsors.csv', 'utf-8')
  const { data } = Papa.parse<SponsorRow>(csvContent, {
    header: true,
    skipEmptyLines: true
  })

  let imported = 0
  let skipped = 0

  for (const row of data) {
    // Skip rows without essential data
    if (!row.Name && !row.Firma) {
      skipped++
      continue
    }

    const memberAssignment = row.Member?.trim()
    if (!memberAssignment) {
      skipped++
      continue
    }

    try {
      let memberId: string | null = null
      let groupId: string | null = null

      // Try to find member by first name (column Member contains member first names)
      const memberNames = Array.from(memberMap.keys())
      const matchingMember = memberNames.find(name =>
        name.toLowerCase().startsWith(memberAssignment.toLowerCase())
      )

      if (matchingMember) {
        memberId = memberMap.get(matchingMember) || null
      } else if (groupMap.has(memberAssignment)) {
        groupId = groupMap.get(memberAssignment) || null
      } else {
        // Create a simple member placeholder if not found
        const simpleMember = await prisma.member.create({
          data: {
            firstName: memberAssignment,
            lastName: 'Gruppe'
          }
        })
        memberId = simpleMember.id
        memberMap.set(memberAssignment, memberId)
      }

      const sponsor = await prisma.sponsor.create({
        data: {
          company: row.Firma?.trim() || null,
          salutation: row.Anrede?.trim() || null,
          firstName: row.Vorname?.trim() || null,
          lastName: row.Name?.trim() || null,
          street: row.Strasse?.trim() || null,
          postalCode: row.PLZ?.trim() || null,
          city: row.Ort?.trim() || null,
          phone: null,
          email: null,
          notes: null,
          memberId,
          groupId
        }
      })

      imported++
      const displayName = row.Firma || `${row.Vorname || ''} ${row.Name}`.trim()
      console.log(`  ✓ ${displayName} → ${memberAssignment}`)

    } catch (error) {
      console.error(`  ✗ Error importing sponsor ${row.Name}:`, error)
      skipped++
    }
  }

  console.log(`✅ Imported ${imported} sponsors, skipped ${skipped}`)
}

async function createFiscalYear() {
  console.log('\n📅 Creating fiscal year...')

  const fiscalYear = await prisma.fiscalYear.create({
    data: {
      name: 'Demo Year 2025-2026',
      startDate: new Date('2025-04-26T00:00:00.000Z'),
      endDate: new Date('2026-04-25T23:59:59.999Z')
    }
  })

  console.log(`✅ Created fiscal year: ${fiscalYear.name}`)
  return fiscalYear
}

async function createTargets(memberMap: Map<string, string>, fiscalYearId: string) {
  console.log('\n🎯 Creating member targets...')

  // Default target amount for all members
  const defaultTarget = 500.00
  let created = 0

  for (const [memberName, memberId] of memberMap) {
    try {
      await prisma.memberTarget.create({
        data: {
          memberId,
          fiscalYearId,
          targetAmount: defaultTarget
        }
      })
      created++
    } catch (error) {
      console.error(`  ✗ Error creating target for ${memberName}:`, error)
    }
  }

  console.log(`✅ Created ${created} member targets`)
}

async function createSettings() {
  console.log('\n⚙️  Creating settings...')

  await prisma.setting.create({
    data: {
      key: 'organization_name',
      value: 'Demo Organization',
      description: 'Name der Organisation'
    }
  })

  await prisma.setting.create({
    data: {
      key: 'fiscal_year_start_month',
      value: '4',
      description: 'Startmonat für neue Vereinsjahre (1-12)'
    }
  })

  await prisma.setting.create({
    data: {
      key: 'fiscal_year_start_day',
      value: '26',
      description: 'Starttag für neue Vereinsjahre (1-31)'
    }
  })

  await prisma.setting.create({
    data: {
      key: 'default_member_target',
      value: '500',
      description: 'Standard-Vorgabebetrag für neue Mitglieder (CHF)'
    }
  })

  console.log('✅ Settings created')
}

async function main() {
  console.log('🚀 Starting CSV import...\n')

  try {
    // Step 1: Clear all data
    await clearAllData()

    // Step 2: Import members
    const memberMap = await importMembers()

    // Step 3: Create groups
    const groupMap = await createGroups(memberMap)

    // Step 4: Import sponsors
    await importSponsors(memberMap, groupMap)

    // Step 5: Create fiscal year
    const fiscalYear = await createFiscalYear()

    // Step 6: Create targets for all members
    await createTargets(memberMap, fiscalYear.id)

    // Step 7: Create settings
    await createSettings()

    console.log('\n✨ Import completed successfully!')
    console.log(`\n📊 Summary:`)
    console.log(`   Members: ${memberMap.size}`)
    console.log(`   Groups: ${groupMap.size}`)
    console.log(`   Fiscal Year: ${fiscalYear.name}`)

  } catch (error) {
    console.error('\n❌ Import failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
