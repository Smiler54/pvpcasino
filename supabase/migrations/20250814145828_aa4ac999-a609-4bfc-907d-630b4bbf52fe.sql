-- Fix Critical Security Issues: Public Data Exposure (Fixed Version)

-- 1. Update jackpot_games RLS policies to require authentication
DROP POLICY IF EXISTS "Public can view jackpot games" ON public.jackpot_games;

CREATE POLICY "Authenticated users can view active/completed jackpot games" 
ON public.jackpot_games 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND status = ANY (ARRAY['active'::text, 'completed'::text])
);

-- 2. Update game_offers RLS policies to require authentication  
DROP POLICY IF EXISTS "Anyone can view open offers" ON public.game_offers;

CREATE POLICY "Authenticated users can view open offers" 
ON public.game_offers 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND status = 'open'::text
);

-- 3. Drop existing functions and recreate with proper signatures
DROP FUNCTION IF EXISTS public.get_public_jackpot_stats();
DROP FUNCTION IF EXISTS public.get_public_game_offers();
DROP FUNCTION IF EXISTS public.get_public_recent_matches_safe(integer);

-- 4. Create secure function for public jackpot stats (minimal safe data only)
CREATE OR REPLACE FUNCTION public.get_public_jackpot_stats()
RETURNS TABLE(
  id uuid, 
  ticket_price numeric, 
  total_pool numeric, 
  status text, 
  timer_end_at timestamp with time zone,
  player_count bigint
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $function$
BEGIN
  -- Return only non-sensitive jackpot data without winner information
  RETURN QUERY
  SELECT 
    jg.id,
    jg.ticket_price,
    jg.total_pool,
    jg.status,
    jg.timer_end_at,
    COALESCE(
      (SELECT COUNT(DISTINCT user_id) FROM public.jackpot_tickets WHERE game_id = jg.id), 
      0
    ) as player_count
  FROM public.jackpot_games jg
  WHERE jg.status IN ('active'::text, 'completed'::text)
  ORDER BY jg.created_at DESC
  LIMIT 50;
END;
$function$;

-- 5. Create secure function for public game offers (minimal safe data only)
CREATE OR REPLACE FUNCTION public.get_public_game_offers()
RETURNS TABLE(
  id uuid,
  amount numeric,
  side text,
  maker_name text,
  created_at timestamp with time zone
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $function$
BEGIN
  -- Return only non-sensitive offer data
  RETURN QUERY
  SELECT 
    go.id,
    go.amount,
    go.side,
    go.maker_name,
    go.created_at
  FROM public.game_offers go
  WHERE go.status = 'open'::text
  ORDER BY go.created_at DESC
  LIMIT 100;
END;
$function$;

-- 6. Enhanced security function for completed matches (public summary only)
CREATE OR REPLACE FUNCTION public.get_public_recent_matches_safe(p_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid, 
  amount numeric, 
  result_side text, 
  completed_at timestamp with time zone
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $function$
BEGIN
  -- Return only non-sensitive match data without user names or IDs
  RETURN QUERY
  SELECT 
    gm.id,
    gm.amount,
    gm.result_side,
    gm.completed_at
  FROM public.game_matches gm
  WHERE gm.status = 'completed'::text
  ORDER BY gm.completed_at DESC
  LIMIT LEAST(p_limit, 50); -- Cap at 50 for performance
END;
$function$;

-- 7. Log this critical security update
INSERT INTO public.admin_audit_log (
  admin_user_id,
  target_user_id,
  action,
  details
) VALUES (
  COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
  COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
  'critical_security_update',
  json_build_object(
    'type', 'rls_policy_hardening',
    'tables_affected', ARRAY['jackpot_games', 'game_offers'],
    'security_level', 'CRITICAL',
    'timestamp', NOW(),
    'description', 'Fixed public data exposure by requiring authentication for sensitive gambling data'
  )
);