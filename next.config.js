/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output configuration for Docker builds
  output: 'standalone',

  // Logging configuration
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // External packages configuration
  serverExternalPackages: [],

  // Headers configuration
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
