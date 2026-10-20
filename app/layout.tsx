import type { Metadata, Viewport } from 'next'
import './vow-original.css'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import ZaloWebViewEscape from '@/components/auth/ZaloWebViewEscape'

export const metadata: Metadata = {
  title: 'VOW — Niềm tin, cùng nhau',
  description:
    'Nơi yên tĩnh để gặp Chúa mỗi ngày, chia sẻ khoảnh khắc với bạn bè và kết nối với những người cùng đức tin.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
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
  viewportFit: 'cover',
  themeColor: '#0b0b0f',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" className="dark bg-ink text-cream" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('vow_theme') || localStorage.getItem('fc_devotion_theme');
                  if (theme === 'light') {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('devotion-light');
                  } else {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('devotion-light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-svh bg-ink text-cream antialiased flex justify-center">
        <div className="w-full max-w-md min-h-svh flex flex-col relative shadow-2xl shadow-black/80 bg-ink">
          <ZaloWebViewEscape />
          {children}
        </div>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1c1c1e',
              color: '#f5f5f4',
              border: '1px solid rgba(245, 179, 1, 0.2)',
              borderRadius: '16px',
            },
            success: {
              iconTheme: { primary: '#f5b301', secondary: '#0b0b0f' },
            },
            error: {
              iconTheme: { primary: '#f87171', secondary: '#0b0b0f' },
            },
          }}
        />
      </body>
    </html>
  )
}
