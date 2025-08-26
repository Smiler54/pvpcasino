-- Check and fix the draw_jackpot_winner function
CREATE OR REPLACE FUNCTION public.draw_jackpot_winner(p_game_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_tickets INTEGER;
  v_random_ticket INTEGER;
  v_winner_user_id UUID;
  v_winner_username TEXT;
  v_jackpot_amount NUMERIC;
  v_current_count INTEGER := 0;
  v_ticket_record RECORD;
BEGIN
  -- Get total tickets and jackpot amount
  SELECT 
    COALESCE(SUM(tickets_bought), 0),
    total_pool
  INTO v_total_tickets, v_jackpot_amount
  FROM public.jackpot_tickets t
  JOIN public.jackpot_games g ON g.id = t.game_id
  WHERE t.game_id = p_game_id
  GROUP BY g.total_pool;
  
  IF v_total_tickets = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No tickets sold');
  END IF;
  
  -- Generate random ticket number (1 to total_tickets)
  v_random_ticket := floor(random() * v_total_tickets) + 1;
  
  -- Find the winner by counting tickets
  FOR v_ticket_record IN 
    SELECT user_id, username, tickets_bought
    FROM public.jackpot_tickets
    WHERE game_id = p_game_id
    ORDER BY created_at
  LOOP
    v_current_count := v_current_count + v_ticket_record.tickets_bought;
    
    IF v_current_count >= v_random_ticket THEN
      v_winner_user_id := v_ticket_record.user_id;
      v_winner_username := v_ticket_record.username;
      EXIT;
    END IF;
  END LOOP;
  
  -- Update winner's balance using the safe function
  PERFORM public.update_user_balance(
    v_winner_user_id, 
    v_jackpot_amount, 
    'jackpot_win', 
    'Won jackpot: $' || v_jackpot_amount
  );
  
  -- Mark game as completed
  UPDATE public.jackpot_games
  SET 
    status = 'completed',
    winner_id = v_winner_user_id,
    winner_name = v_winner_username,
    completed_at = now()
  WHERE id = p_game_id;
  
  RETURN json_build_object(
    'success', true, 
    'winner_id', v_winner_user_id,
    'winner_name', v_winner_username,
    'jackpot_amount', v_jackpot_amount,
    'total_tickets', v_total_tickets
  );
END;
$function$;