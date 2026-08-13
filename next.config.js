const withNextIntl = require('next-intl/plugin')()

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a minimal self-contained server (.next/standalone) with only the
  // traced runtime dependencies — much smaller to ship than full node_modules.
  output: 'standalone',
  // Keep nodemailer out of the server bundle: it resolves its transport modules
  // via dynamic require() at runtime, which the bundler cannot trace. Leaving it
  // external means it is copied into the standalone node_modules intact.
  serverExternalPackages: ['nodemailer'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Next defaults to one build worker per CPU core. On a many-core build host
    // that fans out far enough to exhaust the session's cgroup task limit, and
    // the build dies with "OS can't spawn worker thread: Resource temporarily
    // unavailable". Keep the fan-out modest; override via NEXT_BUILD_CPUS.
    cpus: Number(process.env.NEXT_BUILD_CPUS) || 8,
  },
}

module.exports = withNextIntl(nextConfig)
