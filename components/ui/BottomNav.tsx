'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  {
    href: '/tim-chua-truoc',
    label: 'Tìm Chúa trước',
    icon: (active: boolean) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: '/khoang-khac',
    label: 'Khoảnh Khắc',
    icon: (active: boolean) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    href: '/ket-noi-sau',
    label: 'Kết Nối Sau',
    icon: (active: boolean) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bottom-nav border-t z-50"
      style={{
        background: 'var(--background)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center justify-around px-2 pt-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors min-w-0"
              style={{ color: isActive ? 'var(--gold)' : 'var(--text-muted)' }}
            >
              {item.icon(isActive)}
              <span className="text-[10px] font-medium truncate">{item.label}</span>
              {/* Active dot indicator */}
              {isActive && (
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ background: 'var(--gold)' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
