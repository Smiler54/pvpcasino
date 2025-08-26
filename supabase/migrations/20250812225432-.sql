-- Create a secure function to get aggregate jackpot data without exposing individual players
CREATE OR REPLACE FUNCTION public.get_jackpot_aggregate_data(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_tickets', COALESCE(SUM(tickets_bought), 0),
    'total_players', COUNT(DISTINCT user_id),
    'total_pool', (SELECT total_pool FROM public.jackpot_games WHERE id = p_game_id)
  )
  INTO v_result
  FROM public.jackpot_tickets
  WHERE game_id = p_game_id;
  
  RETURN v_result;
END;
$function$;