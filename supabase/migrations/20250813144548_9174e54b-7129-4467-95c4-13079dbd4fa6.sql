-- Security Fix: Add RLS policies to protect public profile views
-- These are views that expose user data and need proper access controls

-- Note: Since public_profiles, public_profiles_secure, and jackpot_public_stats are VIEWS,
-- we cannot add RLS policies directly to them. However, we can create security functions
-- and ensure the underlying tables have proper protection.

-- Create a function to check if user is authenticated for public data access
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- Add additional security logging function for profile access
CREATE OR REPLACE FUNCTION public.log_profile_access(p_target_user_id uuid, p_access_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log profile access attempts for security monitoring
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_user_id,
    action,
    details
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    p_target_user_id,
    'profile_access',
    json_build_object(
      'access_type', p_access_type,
      'timestamp', NOW(),
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    )
  );
END;
$$;

-- Since we cannot add RLS to views, we'll create secure functions to access the data
-- These functions will replace direct view access in the application

-- Secure function to get public profile data (requires authentication)
CREATE OR REPLACE FUNCTION public.get_public_profile_secure(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  username text,
  level integer,
  experience integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Require authentication
  IF NOT public.is_authenticated_user() THEN
    RAISE EXCEPTION 'Authentication required to access profile data';
  END IF;
  
  -- Log the access
  PERFORM public.log_profile_access(p_user_id, 'public_profile_view');
  
  -- Return the profile data
  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    p.level,
    p.experience,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
END;
$$;

-- Secure function to get jackpot public stats (requires authentication)
CREATE OR REPLACE FUNCTION public.get_jackpot_stats_secure(p_game_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  ticket_price numeric,
  total_pool numeric,
  status text,
  timer_end_at timestamp with time zone,
  created_at timestamp with time zone,
  game_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Require authentication for accessing game statistics
  IF NOT public.is_authenticated_user() THEN
    RAISE EXCEPTION 'Authentication required to access game statistics';
  END IF;
  
  -- Log the access
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_user_id,
    action,
    details
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    auth.uid(),
    'jackpot_stats_access',
    json_build_object(
      'game_id', p_game_id,
      'timestamp', NOW()
    )
  );
  
  -- Return game statistics
  RETURN QUERY
  SELECT 
    jg.id,
    jg.ticket_price,
    jg.total_pool,
    jg.status,
    jg.timer_end_at,
    jg.created_at,
    jg.status as game_status
  FROM public.jackpot_games jg
  WHERE (p_game_id IS NULL OR jg.id = p_game_id)
    AND jg.status IN ('active', 'completed');
END;
$$;

-- Add security comments to document the approach
COMMENT ON VIEW public.public_profiles IS 'SECURITY WARNING: This view exposes user data without RLS. Use get_public_profile_secure() function instead for secure access that requires authentication.';
COMMENT ON VIEW public.public_profiles_secure IS 'SECURITY WARNING: This view exposes user data without RLS. Use get_public_profile_secure() function instead for secure access that requires authentication.';
COMMENT ON VIEW public.jackpot_public_stats IS 'SECURITY WARNING: This view exposes game data without RLS. Use get_jackpot_stats_secure() function instead for secure access that requires authentication.';

-- Create a security policy audit function
CREATE OR REPLACE FUNCTION public.audit_security_policies()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
  v_tables_without_rls text[];
  v_views_exposed text[];
BEGIN
  -- Check for tables without RLS enabled
  SELECT array_agg(tablename) INTO v_tables_without_rls
  FROM pg_tables 
  WHERE schemaname = 'public' 
    AND tablename NOT IN (
      SELECT tablename 
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE c.relrowsecurity = true
        AND t.schemaname = 'public'
    );
  
  -- Check for exposed views (this is informational)
  SELECT array_agg(viewname) INTO v_views_exposed
  FROM pg_views 
  WHERE schemaname = 'public'
    AND viewname IN ('public_profiles', 'public_profiles_secure', 'jackpot_public_stats');
  
  v_result := json_build_object(
    'tables_without_rls', v_tables_without_rls,
    'exposed_views', v_views_exposed,
    'recommendation', 'Use secure functions instead of direct view access',
    'audit_timestamp', NOW()
  );
  
  RETURN v_result;
END;
$$;