-- Fix function signature and additional security improvements

-- 1. Restrict jackpot_tickets to show only aggregated data publicly, not individual user data
DROP POLICY IF EXISTS "Public can view jackpot tickets for display" ON public.jackpot_tickets;
CREATE POLICY "Users can view own tickets only" 
ON public.jackpot_tickets 
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Drop and recreate the jackpot history function with updated signature
DROP FUNCTION IF EXISTS public.get_public_jackpot_history(integer);
CREATE OR REPLACE FUNCTION public.get_public_jackpot_history(p_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  total_pool numeric,
  winner_name text,
  completed_at timestamp with time zone,
  total_players integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Only return basic winner info, not detailed gambling patterns
  RETURN QUERY
  SELECT 
    jg.id,
    jg.total_pool,
    jg.winner_name,
    jg.completed_at,
    (
      SELECT COUNT(DISTINCT user_id)::integer 
      FROM public.jackpot_tickets jt 
      WHERE jt.game_id = jg.id
    ) as total_players
  FROM public.jackpot_games jg
  WHERE jg.status = 'completed'
    AND jg.winner_name IS NOT NULL
    AND jg.completed_at IS NOT NULL
  ORDER BY jg.completed_at DESC
  LIMIT p_limit;
END;
$function$;

-- 3. Create function for public jackpot stats without exposing user details
CREATE OR REPLACE FUNCTION public.get_public_jackpot_stats()
RETURNS TABLE(
  active_games integer,
  current_pool numeric,
  current_players integer,
  games_today integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::integer FROM public.jackpot_games WHERE status = 'active') as active_games,
    (SELECT COALESCE(SUM(total_pool), 0) FROM public.jackpot_games WHERE status = 'active') as current_pool,
    (
      SELECT COUNT(DISTINCT jt.user_id)::integer 
      FROM public.jackpot_tickets jt 
      JOIN public.jackpot_games jg ON jg.id = jt.game_id 
      WHERE jg.status = 'active'
    ) as current_players,
    (
      SELECT COUNT(*)::integer 
      FROM public.jackpot_games 
      WHERE status = 'completed' 
        AND completed_at > CURRENT_DATE
    ) as games_today;
END;
$function$;