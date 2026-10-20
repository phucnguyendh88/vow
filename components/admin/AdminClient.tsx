'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Tab = 'stats' | 'moments' | 'users'

interface Stats {
  users: number
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
  created_at: string
}

const PAGE = 24

export default function AdminClient() {
  const supabase = createClient() as any
  const [tab, setTab] = useState<Tab>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [moments, setMoments] = useState<AdminMoment[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'stats') {
        const [u, m, r, mt] = await Promise.all([
          count('profiles'),
          count('moments', (q) => q.eq('is_deleted', false)),
          count('reports', (q) => q.eq('status', 'pending')),
          count('matches'),
        ])
        setStats({ users: u, moments: m, reports: r, matches: mt })
      } else if (tab === 'moments') {
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
      } else {
        const { data, error: e } = await supabase
          .from('profiles')
          .select('id, full_name, username, role, is_banned, created_at')
          .order('created_at', { ascending: false })
          .range(page * PAGE, page * PAGE + PAGE - 1)
        if (e) throw e
        setUsers((data ?? []) as AdminUser[])
      }
    } catch (e: any) {
      setError(e?.message || 'Không tải được dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [tab, page, supabase, count])

  useEffect(() => {
    void load()
  }, [load])

  const deleteMoment = async (id: string) => {
    if (!window.confirm('Xóa khoảnh khắc này? Nội dung sẽ không còn hiển thị với người dùng.')) return
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
    if (!window.confirm(next ? 'Khóa người dùng này?' : 'Mở khóa người dùng này?')) return
    const { error: e } = await supabase.from('profiles').update({ is_banned: next }).eq('id', u.id)
    if (e) setError(e.message)
    else setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_banned: next } : x)))
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'stats', label: 'Thống kê' },
    { id: 'moments', label: 'Khoảnh khắc' },
    { id: 'users', label: 'Người dùng' },
  ]

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl bg-ink px-5 py-6 text-cream">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">Quản trị VOW</h1>
        <Link href="/tim-chua-truoc" className="text-sm text-muted hover:text-cream">
          ← Về ứng dụng
        </Link>
      </div>

      <div className="mt-5 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setPage(0)
              setTab(t.id)
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === t.id ? 'bg-gold text-ink' : 'bg-surface2 text-cream'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-danger/15 p-3 text-sm text-danger">
          {error}{' '}
          <button type="button" onClick={() => void load()} className="underline">
            Thử lại
          </button>
        </div>
      )}
      {loading && <p className="mt-6 text-sm text-muted">Đang tải…</p>}

      {!loading && tab === 'stats' && stats && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            ['Người dùng', stats.users],
            ['Khoảnh khắc', stats.moments],
            ['Báo cáo chờ xử lý', stats.reports],
            ['Cặp match', stats.matches],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl bg-surface p-4">
              <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-gold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'moments' && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {moments.length === 0 && <p className="text-sm text-muted">Chưa có khoảnh khắc nào.</p>}
          {moments.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-2xl bg-surface">
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
                  className="absolute right-2 top-2 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-danger"
                >
                  Xóa
                </button>
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">
                  {m.profiles?.full_name || m.profiles?.username || 'Người dùng VOW'}
                </p>
                <p className="text-xs text-muted">{new Date(m.created_at).toLocaleString('vi-VN')}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'users' && (
        <ul className="mt-6 space-y-2">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between rounded-2xl bg-surface p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {u.full_name || u.username || 'Người dùng VOW'}
                  {u.role === 'admin' && <span className="ml-2 text-xs text-gold">admin</span>}
                </p>
                <p className="truncate font-mono text-xs text-muted">{u.id}</p>
              </div>
              {u.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => void toggleBan(u)}
                  className={`ml-3 shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    u.is_banned ? 'bg-gold text-ink' : 'bg-surface2 text-danger'
                  }`}
                >
                  {u.is_banned ? 'Mở khóa' : 'Khóa'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab !== 'stats' && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-full bg-surface2 px-4 py-2 text-sm disabled:opacity-40"
          >
            Trước
          </button>
          <span className="text-xs text-muted">Trang {page + 1}</span>
          <button
            type="button"
            disabled={loading || (tab === 'moments' ? moments.length : users.length) < PAGE}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full bg-surface2 px-4 py-2 text-sm disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  )
}
