/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      // Financial/API responses must never enter the service-worker cache.
      urlPattern: ({ url, request }) => {
        if (request.method !== 'GET') return false;
        if (url.pathname.startsWith('/api/')) return false;
        if (url.hostname.includes('supabase')) return false;
        return url.origin === self.location.origin;
      },
      handler: 'NetworkFirst',
      options: {
        cacheName: 'page-cache',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 40,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
  ],
})

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  optimizeFonts: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Disable React DevTools in production
  productionBrowserSourceMaps: false,
  // Fix WebSocket issues
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = withPWA(nextConfig)
