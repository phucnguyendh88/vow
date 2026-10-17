import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'VOW — Kết nối Cơ Đốc',
  description: 'Học Kinh Thánh, chia sẻ khoảnh khắc, gặp gỡ người cùng đức tin',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VOW',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" className="dark">
      <body>
        <div className="app-container">
          {children}
        </div>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1e1e1e',
              color: '#f5f5f0',
              border: '1px solid rgba(201, 168, 76, 0.3)',
              borderRadius: '12px',
            },
            success: {
              iconTheme: { primary: '#c9a84c', secondary: '#0a0a0a' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#0a0a0a' },
            },
          }}
        />
      </body>
    </html>
  )
}
