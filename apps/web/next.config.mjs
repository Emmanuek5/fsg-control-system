import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for the production Docker image (see apps/web/Dockerfile).
  output: 'standalone',
  transpilePackages: ['@fsg/shared'],
  // Monorepo root for output file tracing (avoids picking up ~/bun.lock).
  outputFileTracingRoot: path.join(import.meta.dirname, '..', '..'),
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
