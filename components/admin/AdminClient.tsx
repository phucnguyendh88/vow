'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Tab = 'stats' | 'users' | 'matches' | 'moments'

interface Stats {
  totalUsers: number
  usersToday: number
  usersLast7Days: number
  moments: number
  reports: number
  matches: number
}

interface AdminMoment {
  id: string
  user_id: string
  media_url: string
  media_type: string
  thumbnail_url: string | null
  caption: string | null
  created_at: string
  profiles: { full_name: string | null; username: string | null } | null
}

interface AdminUser {
  id: string
  full_name: string | null
  username: string | null
  role: string
  is_banned: boolean
  is_active: boolean
  church_name: string | null
  location_text: string | null
  avatar_url: string | null
  created_at: string
  auth_provider?: string
  email?: string | null
  is_anonymous?: boolean
}

interface AdminMatch {
  id: string
  created_at: string
  user1: { id: string; name: string; avatar: string | null } | null
  user2: { id: string; name: string; avatar: string | null } | null
}

const PAGE = 20

/**
 * Tính mốc thời gian bắt đầu ngày hôm nay theo múi giờ Việt Nam (UTC+7)
 */
function getVietnamTodayStartISO(): string {
  const now = new Date()
  // Offset UTC+7 = 7 * 60 minutes
  const vnOffsetMs = 7 * 60 * 60 * 1000
  const vnDate = new Date(now.getTime() + vnOffsetMs)
  vnDate.setUTCHours(0, 0, 0, 0)
  // Đưa về mốc UTC tương ứng
  const utcStart = new Date(vnDate.getTime() - vnOffsetMs)
  return utcStart.toISOString()
}

/**
 * Tính mốc thời gian 7 ngày trước theo múi giờ Việt Nam
 */
function getVietnam7DaysAgoISO(): string {
  const now = new Date()
  const sevenDaysAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000
  return new Date(sevenDaysAgoMs).toISOString()
}

export default function AdminClient() {
  const supabase = createClient() as any
  const [tab, setTab] = useState<Tab>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [moments, setMoments] = useState<AdminMoment[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [matches, setMatches] = useState<AdminMatch[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState<'all' | 'google' | 'email' | 'guest'>('all')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal xác nhận xóa người dùng
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const count = useCallback(
    async (table: string, filter?: (q: any) => any) => {
      let q = supabase.from(table).select('id', { count: 'exact', head: true })
      if (filter) q = filter(q)
      const { count: c, error: e } = await q
      if (e) throw e
      return (c as number) ?? 0
    },
    [supabase]
  )

  const loadStats = useCallback(async () => {
    const todayISO = getVietnamTodayStartISO()
    const sevenDaysISO = getVietnam7DaysAgoISO()

    const [totalUsers, usersToday, usersLast7Days, momentsCount, reportsCount, matchesCount] =
      await Promise.all([
        count('profiles'),
        count('profiles', (q) => q.gte('created_at', todayISO)),
        count('profiles', (q) => q.gte('created_at', sevenDaysISO)),
        count('moments', (q) => q.eq('is_deleted', false)),
        count('reports', (q) => q.eq('status', 'pending')),
        count('matches'),
      ])

    setStats({
      totalUsers,
      usersToday,
      usersLast7Days,
      moments: momentsCount,
      reports: reportsCount,
      matches: matchesCount,
    })
  }, [count])

  const loadUsers = useCallback(async () => {
    const res = await fetch(
      `/api/admin/users?page=${page}&limit=${PAGE}&search=${encodeURIComponent(searchQuery)}&provider=${providerFilter}`
    )
    if (!res.ok) throw new Error('Không tải được danh sách người dùng')
    const json = await res.json()
    setUsers(json.users || [])
  }, [page, searchQuery, providerFilter])

  const loadMatches = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('matches')
      .select(`
        id,
        created_at,
        p1:user1_id (id, full_name, username, avatar_url),
        p2:user2_id (id, full_name, username, avatar_url)
      `)
      .order('created_at', { ascending: false })
      .range(page * PAGE, (page + 1) * PAGE - 1)

    if (e) throw e

    const formatted: AdminMatch[] = (data || []).map((m: any) => ({
      id: m.id,
      created_at: m.created_at,
      user1: m.p1
        ? {
            id: m.p1.id,
            name: m.p1.full_name || m.p1.username || 'Thành viên',
            avatar: m.p1.avatar_url,
          }
        : null,
      user2: m.p2
        ? {
            id: m.p2.id,
            name: m.p2.full_name || m.p2.username || 'Thành viên',
            avatar: m.p2.avatar_url,
          }
        : null,
    }))

    // Filter theo searchQuery client-side nếu có
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      setMatches(
        formatted.filter(
          (m) =>
            m.user1?.name.toLowerCase().includes(q) ||
            m.user2?.name.toLowerCase().includes(q) ||
            m.user1?.id.includes(q) ||
            m.user2?.id.includes(q)
        )
      )
    } else {
      setMatches(formatted)
    }
  }, [page, searchQuery, supabase])

  const loadMoments = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('moments')
      .select(
        'id, user_id, media_url, media_type, thumbnail_url, caption, created_at, profiles:user_id(full_name, username)'
      )
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (e) throw e
    setMoments((data ?? []) as AdminMoment[])
  }, [page, supabase])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'stats') {
        await loadStats()
      } else if (tab === 'users') {
        await loadUsers()
      } else if (tab === 'matches') {
        await loadMatches()
      } else if (tab === 'moments') {
        await loadMoments()
      }
    } catch (e: any) {
      setError(e?.message || 'Không tải được dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [tab, loadStats, loadUsers, loadMatches, loadMoments])

  useEffect(() => {
    void load()
  }, [load])

  const deleteMoment = async (id: string) => {
    if (!window.confirm('Xóa khoảnh khắc này?')) return
    const { error: e } = await supabase
      .from('moments')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (e) setError(e.message)
    else setMoments((prev) => prev.filter((m) => m.id !== id))
  }

  const toggleBan = async (u: AdminUser) => {
    if (u.role === 'admin') return
    const next = !u.is_banned
    if (!window.confirm(next ? `Khóa người dùng ${u.full_name || u.username}?` : `Mở khóa ${u.full_name || u.username}?`))
      return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id, is_banned: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Cập nhật thất bại')
      }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_banned: next } : x)))
    } catch (err: any) {
      setError(err?.message || 'Thao tác thất bại')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteUserConfirm = async () => {
    if (!deletingUser) return
    if (deleteConfirmText.trim() !== 'XOA') {
      alert('Vui lòng gõ chính xác "XOA" để xác nhận!')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/users?userId=${deletingUser.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Xóa tài khoản thất bại')
      }
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id))
      setDeletingUser(null)
      setDeleteConfirmText('')
      alert('Đã xóa người dùng thành công')
    } catch (err: any) {
      alert(err?.message || 'Xóa tài khoản thất bại')
    } finally {
      setActionLoading(false)
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'stats', label: 'Thống kê' },
    { id: 'users', label: 'Người dùng' },
    { id: 'matches', label: 'Các cặp đã match' },
    { id: 'moments', label: 'Khoảnh khắc' },
  ]

  return (
    <div className="mx-auto min-h-dvh w-full max-w-4xl bg-[#050505] px-5 py-6 text-white font-sans">
      <div className="flex items-center justify-between border-b border-[rgba(232,208,141,0.2)] pb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-wide text-[#E8D08D]">Quản trị VOW</h1>
          <p className="text-xs text-neutral-400">Giám sát hệ thống & tài khoản</p>
        </div>
        <Link
          href="/tim-chua-truoc"
          className="rounded-full border border-[rgba(232,208,141,0.3)] bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-[#E8D08D] backdrop-blur transition hover:bg-white/[0.08]"
        >
          ← Về ứng dụng
        </Link>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setPage(0)
              setTab(t.id)
            }}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              tab === t.id
                ? 'bg-[#E8D08D] text-black shadow-[0_0_12px_rgba(232,208,141,0.4)]'
                : 'border border-[rgba(232,208,141,0.15)] bg-white/[0.03] text-neutral-300 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search Input for users / matches */}
      {(tab === 'users' || tab === 'matches') && (
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(0)
            }}
            placeholder={`Tìm kiếm ${tab === 'users' ? 'tên, username hoặc ID người dùng...' : 'tên hoặc ID...'}`}
            className="flex-1 rounded-xl border border-[rgba(232,208,141,0.2)] bg-white/[0.03] px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#E8D08D]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-400"
            >
              Xóa
            </button>
          )}
        </div>
      )}

      {/* Provider Filter for Users Tab */}
      {tab === 'users' && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-neutral-400 mr-1">Đăng nhập bằng:</span>
          {(
            [
              { id: 'all', label: 'Tất cả' },
              { id: 'google', label: 'Google' },
              { id: 'email', label: 'Email' },
              { id: 'guest', label: 'Khách (Guest)' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProviderFilter(p.id)
                setPage(0)
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                providerFilter === p.id
                  ? 'bg-[#E8D08D] text-black font-semibold'
                  : 'border border-white/10 bg-white/[0.03] text-neutral-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-300">
          {error}{' '}
          <button type="button" onClick={() => void load()} className="underline font-semibold">
            Thử lại
          </button>
        </div>
      )}

      {loading && <p className="mt-8 text-center text-sm text-neutral-400">Đang tải dữ liệu…</p>}

      {/* TAB 1: THỐNG KÊ (ASIA/HO_CHI_MINH) */}
      {!loading && tab === 'stats' && stats && (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-[rgba(232,208,141,0.2)] bg-white/[0.02] p-5 backdrop-blur-md">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#E8D08D]">
              Tăng trưởng người dùng (Giờ Việt Nam - UTC+7)
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                <p className="text-xs text-neutral-400">Tổng người dùng</p>
                <p className="mt-1.5 font-serif text-3xl font-bold text-white">{stats.totalUsers}</p>
              </div>
              <div className="rounded-xl border border-[rgba(232,208,141,0.3)] bg-black/40 p-4 shadow-[0_0_15px_rgba(232,208,141,0.1)]">
                <p className="text-xs text-[#E8D08D]">Đăng ký hôm nay</p>
                <p className="mt-1.5 font-serif text-3xl font-bold text-[#E8D08D]">{stats.usersToday}</p>
                <p className="mt-1 text-[10px] text-neutral-400">Tính từ 00:00 (GMT+7)</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                <p className="text-xs text-neutral-400">7 ngày qua</p>
                <p className="mt-1.5 font-serif text-3xl font-bold text-white">{stats.usersLast7Days}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[rgba(232,208,141,0.2)] bg-white/[0.02] p-5 backdrop-blur-md">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#E8D08D]">
              Hoạt động & Tương tác
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                <p className="text-xs text-neutral-400">Khoảnh khắc đang hiển thị</p>
                <p className="mt-1.5 font-serif text-3xl font-bold text-white">{stats.moments}</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                <p className="text-xs text-neutral-400">Cặp match thành công</p>
                <p className="mt-1.5 font-serif text-3xl font-bold text-[#E8D08D]">{stats.matches}</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                <p className="text-xs text-neutral-400">Báo cáo chờ xử lý</p>
                <p className={`mt-1.5 font-serif text-3xl font-bold ${stats.reports > 0 ? 'text-red-400' : 'text-neutral-400'}`}>
                  {stats.reports}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUẢN LÝ NGƯỜI DÙNG */}
      {!loading && tab === 'users' && (
        <div className="mt-6 space-y-3">
          {users.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-500">Không tìm thấy người dùng phù hợp.</p>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-3 rounded-2xl border border-[rgba(232,208,141,0.15)] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.avatar_url}
                      alt={u.full_name || 'User'}
                      className="h-12 w-12 shrink-0 rounded-full object-cover border border-[rgba(232,208,141,0.3)]"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/5 font-serif text-base font-bold text-[#E8D08D]">
                      {(u.full_name?.charAt(0) || u.username?.charAt(0) || '?').toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-white">
                        {u.full_name || u.username || 'Người dùng VOW'}
                      </p>
                      {u.role === 'admin' && (
                        <span className="rounded-full bg-[#E8D08D]/20 px-2 py-0.5 text-[10px] font-bold text-[#E8D08D]">
                          ADMIN
                        </span>
                      )}
                      {u.is_banned && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                          BỊ KHÓA
                        </span>
                      )}
                      {u.is_anonymous || u.auth_provider === 'anonymous' ? (
                        <span className="rounded-full border border-neutral-700 bg-neutral-800/80 px-2 py-0.5 text-[10px] font-medium text-neutral-300">
                          Khách
                        </span>
                      ) : u.auth_provider === 'google' ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          Google
                        </span>
                      ) : (
                        <span className="rounded-full border border-sky-500/30 bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                          Email
                        </span>
                      )}
                    </div>
                    {u.email && (
                      <p className="truncate text-xs text-[#E8D08D]/80 font-mono">{u.email}</p>
                    )}
                    <p className="truncate font-mono text-[11px] text-neutral-500">{u.id}</p>
                    <p className="text-xs text-neutral-400">
                      {u.church_name ? `Hội thánh: ${u.church_name} · ` : ''}
                      Ngày tạo: {new Date(u.created_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>

                {u.role !== 'admin' && (
                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void toggleBan(u)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                        u.is_banned
                          ? 'border border-[rgba(232,208,141,0.4)] bg-[#E8D08D]/10 text-[#E8D08D]'
                          : 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      {u.is_banned ? 'Mở khóa' : 'Khóa'}
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => {
                        setDeletingUser(u)
                        setDeleteConfirmText('')
                      }}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 active:scale-95"
                    >
                      Xóa
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: CÁC CẶP ĐÃ MATCH */}
      {!loading && tab === 'matches' && (
        <div className="mt-6 space-y-3">
          {matches.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-500">Không có cặp match nào.</p>
          ) : (
            matches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-2xl border border-[rgba(232,208,141,0.15)] bg-white/[0.02] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    {m.user1?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.user1.avatar}
                        alt="User 1"
                        className="h-11 w-11 rounded-full border-2 border-[#050505] object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#050505] bg-neutral-800 text-xs font-bold text-[#E8D08D]">
                        {m.user1?.name?.charAt(0) || '1'}
                      </div>
                    )}

                    {m.user2?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.user2.avatar}
                        alt="User 2"
                        className="h-11 w-11 rounded-full border-2 border-[#050505] object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#050505] bg-neutral-700 text-xs font-bold text-[#E8D08D]">
                        {m.user2?.name?.charAt(0) || '2'}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      {m.user1?.name || 'Thành viên'} <span className="text-[#E8D08D]">♥</span>{' '}
                      {m.user2?.name || 'Thành viên'}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Match lúc: {new Date(m.created_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>

                <span className="rounded-full border border-[rgba(232,208,141,0.3)] bg-[#E8D08D]/10 px-3 py-1 text-xs font-semibold text-[#E8D08D]">
                  Đã ghép đôi
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: KHOẢNH KHẮC */}
      {!loading && tab === 'moments' && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {moments.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-neutral-500">
              Chưa có khoảnh khắc nào.
            </p>
          )}
          {moments.map((m) => (
            <div
              key={m.id}
              className="overflow-hidden rounded-2xl border border-[rgba(232,208,141,0.2)] bg-white/[0.02]"
            >
              <div className="relative aspect-square bg-black">
                {m.media_type === 'video' ? (
                  <video src={m.media_url} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.thumbnail_url || m.media_url}
                    alt={m.caption || 'Khoảnh khắc'}
                    className="h-full w-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => void deleteMoment(m.id)}
                  aria-label="Xóa khoảnh khắc"
                  className="absolute right-2 top-2 rounded-full bg-black/75 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-black"
                >
                  Xóa
                </button>
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-medium text-white">
                  {m.profiles?.full_name || m.profiles?.username || 'Người dùng VOW'}
                </p>
                {m.caption && <p className="truncate text-[11px] text-neutral-400">{m.caption}</p>}
                <p className="mt-1 text-[10px] text-neutral-500">
                  {new Date(m.created_at).toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {tab !== 'stats' && (
        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
          <button
            type="button"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium disabled:opacity-30"
          >
            ← Trước
          </button>
          <span className="text-xs text-neutral-400">Trang {page + 1}</span>
          <button
            type="button"
            disabled={
              loading ||
              (tab === 'moments'
                ? moments.length < PAGE
                : tab === 'users'
                ? users.length < PAGE
                : matches.length < PAGE)
            }
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium disabled:opacity-30"
          >
            Sau →
          </button>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-[#0e0e10] p-6 shadow-2xl">
            <h3 className="font-serif text-lg font-bold text-red-400">CẢNH BÁO: XÓA NGƯỜI DÙNG</h3>
            <p className="mt-2 text-xs leading-relaxed text-neutral-300">
              Bạn đang yêu cầu xóa vĩnh viễn tài khoản của{' '}
              <strong className="text-white">
                {deletingUser.full_name || deletingUser.username}
              </strong>{' '}
              (ID: <span className="font-mono text-neutral-400">{deletingUser.id}</span>).
            </p>
            <p className="mt-2 text-xs text-red-300/80">
              Mọi dữ liệu liên quan (khoảnh khắc, tin nhắn, bạn bè, lượt quẹt) sẽ bị xóa và không thể khôi phục.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-neutral-400">
                Để xác nhận, gõ chữ <strong className="text-white">XOA</strong> bên dưới:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="XOA"
                className="mt-1.5 w-full rounded-xl border border-red-500/30 bg-black/50 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  setDeletingUser(null)
                  setDeleteConfirmText('')
                }}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-neutral-300"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={actionLoading || deleteConfirmText.trim() !== 'XOA'}
                onClick={() => void handleDeleteUserConfirm()}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-40"
              >
                {actionLoading ? 'Đang xóa...' : 'Xác nhận xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
