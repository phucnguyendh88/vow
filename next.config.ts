import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      { source: '/auth', destination: '/dang-nhap' },
      { source: '/app', destination: '/tim-chua-truoc' },
      { source: '/app/devotion', destination: '/tim-chua-truoc' },
      { source: '/app/friends', destination: '/khoang-khac' },
      { source: '/app/connect', destination: '/ket-noi-sau' },
      { source: '/app/messages', destination: '/tin-nhan' },
      { source: '/app/messages/:convId', destination: '/tin-nhan/:convId' },
      { source: '/app/profile', destination: '/ho-so' },
    ]
  },
}

export default nextConfig
