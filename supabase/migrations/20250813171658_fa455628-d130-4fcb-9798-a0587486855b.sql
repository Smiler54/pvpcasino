-- Fix jackpot game access by creating a public stats function
-- This allows viewing jackpot games without authentication while still being secure

CREATE OR REPLACE FUNCTION public.get_jackpot_public_stats()
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
  -- No authentication required for viewing public jackpot stats
  -- Log the access for monitoring
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_user_id,
    action,
    details
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    'jackpot_public_stats_access',
    json_build_object(
      'timestamp', NOW(),
      'authenticated', (auth.uid() IS NOT NULL)
    )
  );
  
  -- Return only public game statistics
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
  WHERE jg.status IN ('active', 'completed')
  ORDER BY jg.created_at DESC;
END;
$$;