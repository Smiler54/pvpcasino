-- Allow public viewing of game data without authentication

-- 1. Update game_offers RLS policy to allow public viewing
DROP POLICY IF EXISTS "Authenticated users can view open offers" ON public.game_offers;
CREATE POLICY "Anyone can view open offers" 
ON public.game_offers 
FOR SELECT 
USING (status = 'open');

-- 2. Update game_matches RLS policy to allow public viewing of completed matches
DROP POLICY IF EXISTS "Users can view safe match data" ON public.game_matches;
CREATE POLICY "Public can view completed matches safely" 
ON public.game_matches 
FOR SELECT 
USING (
  status = 'completed' OR 
  (auth.uid() = maker_id OR auth.uid() = taker_id)
);

-- 3. Update jackpot_games RLS policy to allow public viewing
DROP POLICY IF EXISTS "Anyone can view public jackpot stats" ON public.jackpot_games;
DROP POLICY IF EXISTS "Users can view active games" ON public.jackpot_games;
CREATE POLICY "Public can view jackpot games" 
ON public.jackpot_games 
FOR SELECT 
USING (status IN ('active', 'completed'));

-- 4. Update jackpot_tickets RLS policy to allow public viewing of aggregated data
CREATE POLICY "Public can view jackpot tickets for display" 
ON public.jackpot_tickets 
FOR SELECT 
USING (true);

-- 5. Create public functions for game data
CREATE OR REPLACE FUNCTION public.get_public_recent_matches(p_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  maker_name text,
  taker_name text,
  amount numeric,
  result_side text,
  winner_name text,
  completed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    gm.id,
    gm.maker_name,
    gm.taker_name,
    gm.amount,
    gm.result_side,
    CASE 
      WHEN gm.winner_id = (SELECT user_id FROM public.profiles WHERE username = gm.maker_name LIMIT 1) 
      THEN gm.maker_name
      ELSE gm.taker_name
    END as winner_name,
    gm.completed_at
  FROM public.game_matches gm
  WHERE gm.status = 'completed'
  ORDER BY gm.completed_at DESC
  LIMIT p_limit;
END;
$function$;

-- 6. Create public function for jackpot history
CREATE OR REPLACE FUNCTION public.get_public_jackpot_history(p_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  total_pool numeric,
  winner_name text,
  completed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    jg.id,
    jg.total_pool,
    jg.winner_name,
    jg.completed_at
  FROM public.jackpot_games jg
  WHERE jg.status = 'completed'
    AND jg.winner_name IS NOT NULL
  ORDER BY jg.completed_at DESC
  LIMIT p_limit;
END;
$function$;