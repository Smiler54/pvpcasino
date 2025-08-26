-- Fix percentage calculation in get_jackpot_players_for_wheel function
CREATE OR REPLACE FUNCTION public.get_jackpot_players_for_wheel(p_game_id uuid)
RETURNS TABLE(username text, tickets_bought integer, total_value numeric, percentage numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_tickets INTEGER;
BEGIN
  -- Get total tickets for this game
  SELECT COALESCE(SUM(jt.tickets_bought), 0)
  INTO v_total_tickets
  FROM public.jackpot_tickets jt
  WHERE jt.game_id = p_game_id;
  
  -- Return aggregated player data with correct percentages
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
$function$