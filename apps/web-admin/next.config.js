/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output creates a minimal self-contained server
  // used by the Dockerfile for production deployment
  output: 'standalone',

  // Allow images from Railway-hosted API uploads and R2
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.railway.app' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },
};

module.exports = nextConfig;
