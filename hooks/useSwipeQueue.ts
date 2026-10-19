import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/components/design-system/SwipeCard';

/**
 * Hook quản lý hàng đợi hồ sơ cho Discovery/Swipe.
 * - Lọc bản thân, inactive, banned, is_complete=false
 * - Lọc các hồ sơ đã swipe (like/pass) trong context 'dating'
 * - Lọc quan hệ block (2 chiều)
 * - Hỗ trợ phân trang và tải thêm
 */
export function useSwipeQueue(userId: string) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [excludedLoaded, setExcludedLoaded] = useState(false);
  const pageSize = 10;

  // Bước 1: Load danh sách ID cần loại trừ (swipes + blocks)
  const loadExcludedIds = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();

    // Lấy swipe đã làm
    const { data: swipedData } = await supabase
      .from('swipes')
      .select('swiped_id')
      .eq('swiper_id', userId)
      .eq('context', 'dating');

    // Lấy blocks 2 chiều
    const { data: blockData } = await supabase
      .from('blocks')
      .select('blocked_id, blocker_id')
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    const swipedIds = (swipedData ?? []).map((s: any) => s.swiped_id as string);
    const blockIds = (blockData ?? []).flatMap((b: any) =>
      b.blocker_id === userId ? [b.blocked_id as string] : [b.blocker_id as string]
    );

    const allExcluded = [...new Set([userId, ...swipedIds, ...blockIds])];
    setExcludedIds(allExcluded);
    setExcludedLoaded(true);
  }, [userId]);

  // Bước 2: Fetch profiles dựa trên excludedIds
  const fetchProfiles = useCallback(async () => {
    if (!userId || !excludedLoaded) return;
    if (!hasMore) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      let query = supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, interests, date_of_birth, location_text, church_name, created_at')
        .eq('is_active', true)
        .eq('is_banned', false)
        .eq('is_complete', true)
        .order('created_at', { ascending: false })
        .limit(pageSize);

      // Loại trừ self + swipes + blocks
      if (excludedIds.length > 0) {
        query = query.not('id', 'in', `(${excludedIds.join(',')})`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }

      const enriched = data.map((p: any) => {
        const age = p.date_of_birth
          ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : undefined;
        return {
          id: p.id,
          username: p.username,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          interests: p.interests ?? [],
          age,
          city: p.location_text,
          church_name: p.church_name,
        } as Profile;
      });

      setProfiles((prev) => [...prev, ...enriched]);

      if (data.length < pageSize) {
        setHasMore(false);
      }
    } catch (e: any) {
      setError(e.message || 'Không thể tải hồ sơ');
    } finally {
      setLoading(false);
    }
  }, [userId, excludedLoaded, excludedIds, hasMore]);

  // Load excluded IDs khi userId thay đổi
  useEffect(() => {
    if (!userId) return;
    setProfiles([]);
    setHasMore(true);
    setExcludedLoaded(false);
    loadExcludedIds();
  }, [userId]);

  // Fetch profiles sau khi excluded IDs được load
  useEffect(() => {
    if (excludedLoaded && userId) {
      fetchProfiles();
    }
  }, [excludedLoaded]);

  const removeTopProfile = () => {
    setProfiles((prev) => {
      const [removed, ...rest] = prev;
      // Thêm vào excludedIds để tránh load lại
      if (removed) {
        setExcludedIds((ids) => [...ids, removed.id]);
      }
      return rest;
    });
  };

  return { profiles, loading, error, removeTopProfile, hasMore, refetch: fetchProfiles };
}
