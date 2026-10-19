import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/components/design-system/SwipeCard';

/**
 * Hook to manage a queue of swipeable profiles.
 * Handles fetching, pagination, and loading state.
 * If `userId` is falsy, the hook does nothing until a valid ID is provided.
 */
export function useSwipeQueue(userId: string) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 12;

  const fetchProfiles = useCallback(async () => {
    if (!userId) {
      setHasMore(false);
      return;
    }
    if (!hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = await createClient();
      // Basic filters: active, not banned, not self
      let query = supabase
        .from('profiles')
        .select(`id, username, full_name, avatar_url, interests, date_of_birth, location_text, church_name, created_at`)
        .eq('is_active', true)
        .eq('is_banned', false)
        .neq('id', userId)
        .order('created_at', { ascending: false })
        .limit(pageSize);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }
      // Compute age from date_of_birth and map to Profile type
      const enriched = (data as any[]).map((p) => {
        const age = p.date_of_birth
          ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : undefined;
        return {
          id: p.id,
          username: p.username,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          interests: p.interests,
          age,
          city: p.location_text,
          church_name: p.church_name,
        } as Profile;
      });
      setProfiles((prev) => [...prev, ...enriched]);
    } catch (e: any) {
      setError(e.message || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, [userId, hasMore]);

  // Initial load & reload when userId changes
  useEffect(() => {
    setProfiles([]);
    setHasMore(true);
    fetchProfiles();
  }, [userId]);

  const removeTopProfile = () => {
    setProfiles((prev) => prev.slice(1));
    if (profiles.length <= pageSize && hasMore) {
      fetchProfiles();
    }
  };

  return { profiles, loading, error, removeTopProfile, hasMore, refetch: fetchProfiles };
}
