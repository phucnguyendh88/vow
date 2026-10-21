'use client'

import { useState, useEffect } from 'react'

export interface FilterOptions {
  gender: 'all' | 'Nam' | 'Nữ'
  minAge: number
  maxAge: number
  area?: string
}

interface Props {
  open: boolean
  onClose: () => void
  currentFilters: FilterOptions
  onApply: (filters: FilterOptions) => void
}

export default function FilterModal({ open, onClose, currentFilters, onApply }: Props) {
  const [minAge, setMinAge] = useState(currentFilters.minAge)
  const [maxAge, setMaxAge] = useState(currentFilters.maxAge)
  const [gender, setGender] = useState<'all' | 'Nam' | 'Nữ'>(currentFilters.gender ?? 'all')

  useEffect(() => {
    if (open) {
      setMinAge(currentFilters.minAge)
      setMaxAge(currentFilters.maxAge)
      setGender(currentFilters.gender ?? 'all')
    }
  }, [open, currentFilters])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Bộ lọc"
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0A0A0A] p-6 pb-8 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/10" />
        <h2 className="font-serif text-2xl text-cream">Bộ lọc</h2>

        <p className="mt-6 text-sm text-muted">Giới tính</p>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Giới tính">
          {(
            [
              { v: 'all', label: 'Tất cả' },
              { v: 'Nam', label: 'Nam' },
              { v: 'Nữ', label: 'Nữ' },
            ] as const
          ).map((item) => (
            <button
              key={item.v}
              type="button"
              role="radio"
              aria-checked={gender === item.v}
              onClick={() => setGender(item.v)}
              className={`rounded-full py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                gender === item.v ? 'bg-gold text-ink' : 'bg-surface2 text-muted hover:text-cream'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-6 text-sm text-muted">Độ tuổi mong muốn</p>
        <div className="mt-6 text-center font-serif text-3xl text-gold">
          {Math.min(minAge, maxAge)} – {Math.max(minAge, maxAge)}
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted">Từ</span>
              <span className="font-medium text-cream">{minAge} tuổi</span>
            </div>
            <input
              type="range"
              min={18}
              max={60}
              value={minAge}
              onChange={(e) => setMinAge(Number(e.target.value))}
              className="w-full accent-[#F5B301]"
              aria-label="Tuổi tối thiểu"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted">Đến</span>
              <span className="font-medium text-cream">{maxAge} tuổi</span>
            </div>
            <input
              type="range"
              min={18}
              max={60}
              value={maxAge}
              onChange={(e) => setMaxAge(Number(e.target.value))}
              className="w-full accent-[#F5B301]"
              aria-label="Tuổi tối đa"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onApply({
              minAge: Math.min(minAge, maxAge),
              maxAge: Math.max(minAge, maxAge),
              gender,
            })
            onClose()
          }}
          className="mt-8 w-full rounded-full bg-gold py-3.5 font-semibold text-ink transition active:scale-[0.98]"
        >
          Áp dụng
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-full py-3 text-sm text-muted"
        >
          Đóng
        </button>
      </div>
    </div>
  )
}
