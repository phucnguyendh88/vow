'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export interface FilterOptions {
  gender: 'all' | 'Nam' | 'Nữ'
  minAge: number
  maxAge: number
  area: string
}

interface Props {
  open: boolean
  onClose: () => void
  currentFilters: FilterOptions
  onApply: (filters: FilterOptions) => void
}

export default function FilterModal({ open, onClose, currentFilters, onApply }: Props) {
  const [gender, setGender] = useState<'all' | 'Nam' | 'Nữ'>(currentFilters.gender)
  const [minAge, setMinAge] = useState(currentFilters.minAge)
  const [maxAge, setMaxAge] = useState(currentFilters.maxAge)
  const [area, setArea] = useState(currentFilters.area)

  if (!open) return null

  const handleSave = () => {
    onApply({
      gender,
      minAge,
      maxAge,
      area,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4">
      <div className="nice-scroll w-full max-w-sm rounded-t-3xl bg-surface p-6 sm:rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <h2 className="font-serif text-xl font-semibold text-cream">Bộ lọc</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full bg-surface2 p-2 text-muted hover:text-cream transition active:scale-95 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Gender */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
              Giới tính
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['all', 'Nam', 'Nữ'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`py-2 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer ${
                    gender === g
                      ? 'bg-gold text-ink'
                      : 'bg-surface2 text-cream hover:bg-surface3'
                  }`}
                >
                  {g === 'all' ? 'Tất cả' : g}
                </button>
              ))}
            </div>
          </div>

          {/* Age range */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted">
                Độ tuổi
              </label>
              <span className="text-xs font-bold text-gold">
                {minAge} — {maxAge} tuổi
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={18}
                max={50}
                value={minAge}
                onChange={(e) => setMinAge(Math.min(Number(e.target.value), maxAge - 1))}
                className="w-full accent-[#F5B301]"
              />
              <input
                type="range"
                min={20}
                max={60}
                value={maxAge}
                onChange={(e) => setMaxAge(Math.max(Number(e.target.value), minAge + 1))}
                className="w-full accent-[#F5B301]"
              />
            </div>
          </div>

          {/* Area */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
              Khu vực
            </label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-xl bg-surface2 border border-transparent px-3 py-2 text-sm text-cream outline-none focus:border-gold"
            >
              <option value="all">Tất cả khu vực</option>
              <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
              <option value="Hà Nội">Hà Nội</option>
              <option value="Đà Nẵng">Đà Nẵng</option>
              <option value="Cần Thơ">Cần Thơ</option>
            </select>
          </div>

          {/* Apply button */}
          <button
            type="button"
            onClick={handleSave}
            className="mt-6 w-full rounded-full bg-gold py-3 text-sm font-semibold text-ink shadow-lg shadow-gold/20 transition hover:brightness-105 active:scale-[0.99] cursor-pointer"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  )
}
