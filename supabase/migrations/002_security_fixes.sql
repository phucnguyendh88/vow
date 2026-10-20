-- ==============================================================================
-- PROJECT VOW - SUPABASE DATABASE MIGRATIONS
-- Migration: 002_security_fixes.sql
-- Description:
--   1. Prevent Privilege Escalation on public.profiles (role, is_banned)
--   2. Fix IDOR vulnerability on public.conversation_members
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX PRIVILEGE ESCALATION ON public.profiles
-- ------------------------------------------------------------------------------

-- Trigger function ngăn chặn user tự thăng cấp role hoặc tự mở khóa is_banned
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Nếu user đang tự cập nhật hồ sơ của chính mình và không phải là admin
    IF auth.uid() = NEW.id AND NOT public.check_admin(auth.uid()) THEN
        NEW.role := OLD.role;
        NEW.is_banned := OLD.is_banned;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Gắn trigger vào bảng profiles
DROP TRIGGER IF EXISTS trigger_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trigger_prevent_profile_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- Cập nhật lại POLICY profiles_update_self_or_admin
DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id OR public.check_admin(auth.uid())
    )
    WITH CHECK (
        auth.uid() = id OR public.check_admin(auth.uid())
    );

-- ------------------------------------------------------------------------------
-- 2. FIX IDOR ON public.conversation_members
-- ------------------------------------------------------------------------------

-- Loại bỏ user_id = auth.uid() để ngăn chặn việc người dùng tự ý tham gia hội thoại riêng tư của người khác
DROP POLICY IF EXISTS "conversation_members_insert" ON public.conversation_members;
CREATE POLICY "conversation_members_insert" ON public.conversation_members
    FOR INSERT WITH CHECK (
        public.is_conversation_member(conversation_id)
        OR public.check_admin(auth.uid())
    );
