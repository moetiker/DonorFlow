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
  },
}

module.exports = withNextIntl(nextConfig)
