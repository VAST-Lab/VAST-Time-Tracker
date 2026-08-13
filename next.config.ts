/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'export',
  basePath: isProd  ? '/VAST-Time-Tracker' : '',
  assetPrefix: isProd ? '/VAST-Time-Tracker/' : '',
  images: {
    unoptimized: true, // Required for static exports
  },
};
module.exports = nextConfig;