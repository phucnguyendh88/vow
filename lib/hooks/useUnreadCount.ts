'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useUnreadCount(userId?: string | null) {
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const supabase = createClient()
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await Promise.resolve(
        (supabase.rpc as any)('get_unread_messages_count')
      )
      if (!error && typeof data === 'number' && !isNaN(data)) {
        setUnreadCount(Math.max(0, data))
      }
    } catch {}
  }, [supabase])

  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      void refresh()
    }, 300)
  }, [refresh])

  useEffect(() => {
    void refresh()

    let channel: any = null
    try {
      channel = supabase
        .channel('global_unread_messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          (payload: any) => {
            if (
              payload?.eventType === 'INSERT' &&
              userId &&
              payload?.new?.sender_id === userId
            ) {
              return
            }
            debouncedRefresh()
          }
        )
        .subscribe()
    } catch {}

    const handleVisibility = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          debouncedRefresh()
        }
      } catch {}
    }

    try {
      if (typeof window !== 'undefined') {
        window.addEventListener('visibilitychange', handleVisibility)
        window.addEventListener('focus', handleVisibility)
      }
    } catch {}

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      try {
        if (channel) supabase.removeChannel(channel)
      } catch {}
      try {
        if (typeof window !== 'undefined') {
          window.removeEventListener('visibilitychange', handleVisibility)
          window.removeEventListener('focus', handleVisibility)
        }
      } catch {}
    }
  }, [supabase, refresh, debouncedRefresh, userId])

  return { unreadCount, refresh }
}

