-- ==============================================================================
-- PROJECT VOW - SUPABASE DATABASE MIGRATIONS
-- Migration: 011_friendship_cleanup_trigger.sql
-- Description:
--   Automatically clean up friend_requests when a friendship is deleted (unfriended).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_friendship_deleted()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.friend_requests
    WHERE (sender_id = OLD.user1_id AND receiver_id = OLD.user2_id)
       OR (sender_id = OLD.user2_id AND receiver_id = OLD.user1_id);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_friendship_deleted ON public.friendships;
CREATE TRIGGER trigger_friendship_deleted
    AFTER DELETE ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_friendship_deleted();
