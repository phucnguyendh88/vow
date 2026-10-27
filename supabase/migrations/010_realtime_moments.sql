-- ==============================================================================
-- PROJECT VOW - SUPABASE DATABASE MIGRATIONS
-- Migration: 010_realtime_moments.sql
-- Description:
--   Add moments table to supabase_realtime publication and set REPLICA IDENTITY FULL
--   to enable Realtime broadcasting of moments updates/deletions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Migration 010: Add moments table to supabase_realtime publication
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'moments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.moments;
    END IF;
END $$;

ALTER TABLE public.moments REPLICA IDENTITY FULL;
