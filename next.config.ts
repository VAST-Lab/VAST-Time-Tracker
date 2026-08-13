/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: 'VAST-Time-Tracker',
  images: {
    unoptimized: true, // Required for static exports
  },
};
module.exports = nextConfig;