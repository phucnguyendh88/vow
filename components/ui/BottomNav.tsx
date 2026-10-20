'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function DevotionIcon() {
  return (
    <IconWrap>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </IconWrap>
  )
}

function CameraIcon() {
  return (
    <IconWrap>
      <path strokeLinejoin="round" d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </IconWrap>
  )
}

function HeartIcon() {
  return (
    <IconWrap>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </IconWrap>
  )
}

const navTabs = [
  { href: '/tim-chua-truoc', label: 'Tìm Chúa trước', icon: <DevotionIcon /> },
  { href: '/khoang-khac', label: 'Khoảnh khắc', icon: <CameraIcon /> },
  { href: '/ket-noi-sau', label: 'Kết nối sau', icon: <HeartIcon /> },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [optimisticTab, setOptimisticTab] = useState(pathname)

  useEffect(() => {
    setOptimisticTab(pathname)
  }, [pathname])

  useEffect(() => {
    navTabs.forEach((tab) => {
      try {
        router.prefetch(tab.href)
      } catch {}
    })
    try {
      router.prefetch('/tin-nhan')
    } catch {}
  }, [router])

  // Hide bottom nav when inside a specific chat conversation (/tin-nhan/[convId])
  const isInChatRoom = /^\/tin-nhan\/[^/]+/.test(pathname)
  if (isInChatRoom) return null

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-ink/95 backdrop-blur border-t border-surface2 z-40"
    >
      <div className="grid grid-cols-3">
        {navTabs.map((tab) => {
          const isActive = optimisticTab.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              onClick={() => setOptimisticTab(tab.href)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-gold' : 'text-muted hover:text-cream'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {isActive && <span className="h-1 w-1 rounded-full bg-gold" />}
            </Link>
          )
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
