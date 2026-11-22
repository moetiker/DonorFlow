/**
 * Runs once when the server process starts.
 *
 * - Migrates legacy sponsor owners and inherited donation recipients to the
 *   sponsor-assignment model (a no-op once the data is migrated).
 * - Backfills status tokens for any legacy records missing one, so a fresh
 *   deployment never needs a separate token-generation step.
 * - Resumes any donor-mailing job left in the "running" state by a previous
 *   process (e.g. after a deploy or crash), so an interrupted mailing continues
 *   from where it stopped instead of hanging forever.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { prisma } = await import('./lib/db')
    const { migrateSponsorAssignments } = await import('./lib/migrate-sponsor-assignments')
    const result = await migrateSponsorAssignments(prisma)
    if (result.status === 'migrated') {
      console.log(
        `Sponsor assignment migration: ${result.assignmentsCreated} assignments created, ` +
          `${result.donationsFilled} donation recipients filled, ${result.sponsorsMerged} duplicate sponsors merged`
      )
    } else if (result.status === 'rolledBack') {
      console.error(
        'Sponsor assignment migration rolled back - status pages show incomplete data until this is fixed'
      )
      for (const diff of result.diffs) {
        console.error(`  ${diff.key}: before ${diff.before}, after ${diff.after}`)
      }
    }
  } catch (error) {
    console.error('Failed to migrate sponsor assignments on startup:', error)
  }
  try {
    const { backfillStatusTokens } = await import('./lib/status-token-backfill')
    await backfillStatusTokens()
  } catch (error) {
    console.error('Failed to backfill status tokens on startup:', error)
  }
  try {
    const { resumeRunningMailJobs } = await import('./lib/mailing-runner')
    await resumeRunningMailJobs()
  } catch (error) {
    console.error('Failed to resume mail jobs on startup:', error)
  }
}
