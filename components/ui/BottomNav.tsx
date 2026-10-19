'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      className="h-6 w-6 shrink-0"
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

function ChatIcon() {
  return (
    <IconWrap>
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />
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

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-end justify-center gap-3 px-6 w-full max-w-[430px]">
      {/* 3 Main Tabs Pill */}
      <nav
        aria-label="Điều hướng chính"
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#1c1c1e]/95 px-2 py-2 shadow-2xl shadow-black/60 backdrop-blur border border-white/5"
      >
        {navTabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              title={tab.label}
              className={`flex h-12 w-14 items-center justify-center rounded-full transition active:scale-95 ${
                isActive
                  ? 'bg-white/15 text-gold'
                  : 'text-white/55 hover:text-white'
              }`}
            >
              {tab.icon}
            </Link>
          )
        })}
      </nav>

      {/* Floating Chat / Messages Button */}
      <Link
        href="/tin-nhan"
        aria-label="Tin nhắn"
        title="Tin nhắn"
        className="pointer-events-auto relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1c1c1e]/95 text-white/80 shadow-2xl shadow-black/60 backdrop-blur transition active:scale-95 border border-white/5"
      >
        <ChatIcon />
      </Link>
    </div>
  )
}
