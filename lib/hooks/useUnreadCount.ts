'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useUnreadCount(_userId?: string | null) {
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const supabase = createClient()

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
          () => {
            void refresh()
          }
        )
        .subscribe()
    } catch {}

    const handleVisibility = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void refresh()
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
  }, [supabase, refresh])

  return { unreadCount, refresh }
}

