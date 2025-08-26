-- Create function to get jackpot players data for the animated wheel
CREATE OR REPLACE FUNCTION public.get_jackpot_players_for_wheel(p_game_id uuid)
RETURNS TABLE(
  username text,
  tickets_bought integer,
  total_value numeric,
  percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_tickets INTEGER;
  v_total_pool NUMERIC;
BEGIN
  -- Get total tickets and pool for this game
  SELECT 
    COALESCE(SUM(jt.tickets_bought), 0),
    jg.total_pool
  INTO v_total_tickets, v_total_pool
  FROM public.jackpot_tickets jt
  RIGHT JOIN public.jackpot_games jg ON jg.id = p_game_id
  WHERE jt.game_id = p_game_id OR jt.game_id IS NULL
  GROUP BY jg.total_pool;
  
  -- Return aggregated player data with percentages
  RETURN QUERY
  SELECT 
    jt.username,
    SUM(jt.tickets_bought)::integer as tickets_bought,
    SUM(jt.amount_paid) as total_value,
    CASE 
      WHEN v_total_tickets > 0 THEN 
        ROUND((SUM(jt.tickets_bought)::numeric / v_total_tickets::numeric * 100), 2)
      ELSE 0
    END as percentage
  FROM public.jackpot_tickets jt
  WHERE jt.game_id = p_game_id
  GROUP BY jt.username
  ORDER BY SUM(jt.tickets_bought) DESC;
END;
$function$;