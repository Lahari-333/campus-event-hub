const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better React safety
  reactStrictMode: true,
  // Standalone output for containerized deployments
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../'),
  // Ignore root ESLint lookup during production Next.js compilation
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Environment variables accessible client-side (non-secret only)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  },
};

module.exports = nextConfig;
