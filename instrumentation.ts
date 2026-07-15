/**
 * Runs once when the server process starts. Resumes any donor-mailing job that
 * was left in the "running" state by a previous process (e.g. after a deploy or
 * crash), so an interrupted mailing continues from where it stopped instead of
 * hanging forever.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { resumeRunningMailJobs } = await import('./lib/mailing-runner')
    await resumeRunningMailJobs()
  } catch (error) {
    console.error('Failed to resume mail jobs on startup:', error)
  }
}
