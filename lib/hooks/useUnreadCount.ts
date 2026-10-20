'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useUnreadCount(userId?: string | null) {
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const supabase = createClient()

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await (supabase.rpc as any)('get_unread_messages_count')
      if (!error && typeof data === 'number') {
        setUnreadCount(data)
      }
    } catch {}
  }, [supabase])

  useEffect(() => {
    void refresh()

    // Lắng nghe tin nhắn mới realtime
    const channel = supabase
      .channel('global_unread_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          void refresh()
        }
      )
      .subscribe()

    // Lắng nghe khi quay lại tab/app (visibilitychange & focus)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }

    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [supabase, refresh])

  return { unreadCount, refresh }
}
