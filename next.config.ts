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

