// app/(main)/khoang-khac/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSwipeQueue } from '@/hooks/useSwipeQueue';
import { SwipeCard } from '@/components/design-system/SwipeCard';
// Import client-side Supabase for browser usage
import { createClient } from '@/lib/supabase/client';
import { redirect } from 'next/navigation';
import toast from 'react-hot-toast';

/**
 * Discovery/Swipe page – shows a stack of profiles the user can Like or Pass.
 * Utilises the design‑system SwipeCard component and the useSwipeQueue hook.
 */
export default function DiscoveryPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Authenticate on client side (fallback to server redirect if needed)
  useEffect(() => {
    async function fetchUser() {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        redirect('/dang-nhap');
        return;
      }
      setUserId(user.id);
      setAuthChecked(true);
    }
    fetchUser();
  }, []);

  const { profiles, loading, error, removeTopProfile, hasMore, refetch } = useSwipeQueue(userId ?? '');

  // Handle Like / Pass actions
  const handleAction = async (profileId: string, action: 'like' | 'pass') => {
    try {
// Use API endpoint for swipes instead of direct Supabase insert
      const response = await fetch('/api/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swiped_id: profileId, action }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to record swipe');
      }
      // Successful swipe – remove current card
      removeTopProfile();
      if (action === 'like' && result.matched) {
        toast.success('Matched! 🎉');
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to record swipe');
    }
  };

  if (!authChecked) {
    return <div className="p-4 text-center">Đang kiểm tra đăng nhập…</div>;
  }

  if (loading && profiles.length === 0) {
    return <div className="p-4 text-center">Đang tải hồ sơ…</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={refetch} className="mt-2 text-primary underline">Thử lại</button>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="p-4 text-center">
        <p>Không còn hồ sơ nào để khám phá.</p>
        {hasMore && (
          <button onClick={refetch} className="mt-2 text-primary underline">Tải thêm</button>
        )}
      </div>
    );
  }

  const current = profiles[0];

  return (
    <div className="flex justify-center items-center min-h-screen bg-background p-4">
      <SwipeCard
        profile={current}
        loading={loading}
        onLike={(id) => handleAction(id, 'like')}
        onPass={(id) => handleAction(id, 'pass')}
      />
    </div>
  );
}
