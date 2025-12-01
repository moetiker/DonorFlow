#!/usr/bin/env tsx

/**
 * Migration Script: Copy memberId/groupId from donations to sponsors
 *
 * This script ensures that sponsors have the correct memberId/groupId assignments
 * based on their donation history. This is needed for the "sponsors without donations"
 * feature to work correctly.
 *
 * Usage:
 *   npx tsx scripts/migrate-sponsor-assignments.ts
 *
 * What it does:
 * 1. Finds all sponsors without memberId/groupId assignment
 * 2. Looks up their donations to find the assignment
 * 3. Updates the sponsor with the most common assignment from their donations
 * 4. Reports conflicts (if a sponsor has donations to different members/groups)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface SponsorAssignment {
  sponsorId: string
  memberId: string | null
  groupId: string | null
  donationCount: number
}

async function migrateSponsorAssignments() {
  console.log('🔄 Starting sponsor assignment migration...\n')

  try {
    // Get all sponsors
    const sponsors = await prisma.sponsor.findMany({
      include: {
        donations: {
          select: {
            memberId: true,
            groupId: true
          }
        }
      }
    })

    console.log(`📊 Found ${sponsors.length} sponsors total\n`)

    let updated = 0
    let skipped = 0
    let conflicts = 0
    let noAssignment = 0

    for (const sponsor of sponsors) {
      const displayName = sponsor.company || `${sponsor.firstName || ''} ${sponsor.lastName || ''}`.trim() || sponsor.id

      // Skip if sponsor already has assignment
      if (sponsor.memberId || sponsor.groupId) {
        console.log(`⏭️  Skipping "${displayName}" - already assigned`)
        skipped++
        continue
      }

      // Skip if no donations
      if (sponsor.donations.length === 0) {
        console.log(`⚠️  Skipping "${displayName}" - no donations found`)
        noAssignment++
        continue
      }

      // Count assignments from donations
      const assignmentCounts = new Map<string, SponsorAssignment>()

      for (const donation of sponsor.donations) {
        if (!donation.memberId && !donation.groupId) {
          continue // Skip donations without assignment
        }

        const key = donation.memberId ? `member-${donation.memberId}` : `group-${donation.groupId}`

        if (!assignmentCounts.has(key)) {
          assignmentCounts.set(key, {
            sponsorId: sponsor.id,
            memberId: donation.memberId,
            groupId: donation.groupId,
            donationCount: 0
          })
        }

        const assignment = assignmentCounts.get(key)!
        assignment.donationCount++
      }

      // Check for conflicts (donations to multiple members/groups)
      if (assignmentCounts.size === 0) {
        console.log(`⚠️  Skipping "${displayName}" - donations have no assignments`)
        noAssignment++
        continue
      }

      if (assignmentCounts.size > 1) {
        console.log(`⚠️  CONFLICT: "${displayName}" has donations to multiple assignments:`)
        for (const [key, assignment] of assignmentCounts.entries()) {
          console.log(`     - ${key}: ${assignment.donationCount} donations`)
        }
        conflicts++

        // Use the assignment with most donations
        const sortedAssignments = Array.from(assignmentCounts.values())
          .sort((a, b) => b.donationCount - a.donationCount)

        const primaryAssignment = sortedAssignments[0]
        console.log(`     → Using most common: ${primaryAssignment.memberId ? 'member-' + primaryAssignment.memberId : 'group-' + primaryAssignment.groupId}`)

        await prisma.sponsor.update({
          where: { id: sponsor.id },
          data: {
            memberId: primaryAssignment.memberId,
            groupId: primaryAssignment.groupId
          }
        })

        updated++
        continue
      }

      // Single assignment - update sponsor
      const assignment = Array.from(assignmentCounts.values())[0]

      await prisma.sponsor.update({
        where: { id: sponsor.id },
        data: {
          memberId: assignment.memberId,
          groupId: assignment.groupId
        }
      })

      const assignmentType = assignment.memberId ? 'member' : 'group'
      const assignmentId = assignment.memberId || assignment.groupId
      console.log(`✅ Updated "${displayName}" → ${assignmentType}: ${assignmentId} (${assignment.donationCount} donations)`)
      updated++
    }

    console.log('\n' + '='.repeat(60))
    console.log('📋 Migration Summary:')
    console.log('='.repeat(60))
    console.log(`✅ Updated:          ${updated} sponsors`)
    console.log(`⏭️  Already assigned:  ${skipped} sponsors`)
    console.log(`⚠️  No donations:      ${noAssignment} sponsors`)
    console.log(`⚠️  Conflicts:         ${conflicts} sponsors`)
    console.log(`📊 Total processed:  ${sponsors.length} sponsors`)
    console.log('='.repeat(60))

    if (conflicts > 0) {
      console.log('\n⚠️  Note: Conflicts were resolved by using the most common assignment.')
      console.log('   You may want to review these sponsors manually.')
    }

    if (noAssignment > 0) {
      console.log('\n⚠️  Note: Sponsors without donations were not assigned.')
      console.log('   You may want to assign them manually in the UI.')
    }

    console.log('\n✅ Migration completed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
migrateSponsorAssignments()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
