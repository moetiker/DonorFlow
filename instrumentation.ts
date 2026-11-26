/**
 * Runs once when the server process starts.
 *
 * - Backfills status tokens for any legacy records missing one, so a fresh
 *   deployment never needs a separate token-generation step.
 * - Resumes any donor-mailing job left in the "running" state by a previous
 *   process (e.g. after a deploy or crash), so an interrupted mailing continues
 *   from where it stopped instead of hanging forever.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
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
