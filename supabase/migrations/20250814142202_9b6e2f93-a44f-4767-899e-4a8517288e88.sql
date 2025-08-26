-- Fix the timer logic to always set exactly 1 minute from NOW() when first bet is placed
CREATE OR REPLACE FUNCTION public.buy_jackpot_tickets(p_game_id uuid, p_user_id uuid, p_username text, p_tickets integer, p_ticket_price numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_cost NUMERIC;
  v_user_balance NUMERIC;
  v_result JSON;
  v_current_players INTEGER;
  v_is_new_player BOOLEAN := FALSE;
  v_timer_end_at TIMESTAMPTZ;
  v_game_status TEXT;
  v_current_timer TIMESTAMPTZ;
BEGIN
  -- Calculate total cost
  v_total_cost := p_ticket_price * p_tickets;
  
  -- Check user balance
  SELECT balance INTO v_user_balance
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF v_user_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF v_user_balance < v_total_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Check if game is still active
  SELECT status, timer_end_at INTO v_game_status, v_current_timer
  FROM public.jackpot_games
  WHERE id = p_game_id;
  
  IF v_game_status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Jackpot game is no longer active');
  END IF;
  
  -- Check if this is a new player (hasn't bought tickets in this game before)
  IF NOT EXISTS (
    SELECT 1 FROM public.jackpot_tickets 
    WHERE game_id = p_game_id AND user_id = p_user_id
  ) THEN
    v_is_new_player := TRUE;
  END IF;
  
  -- Deduct from user balance
  UPDATE public.profiles
  SET balance = balance - v_total_cost
  WHERE user_id = p_user_id;
  
  -- Add to jackpot pool
  UPDATE public.jackpot_games
  SET total_pool = total_pool + v_total_cost
  WHERE id = p_game_id;
  
  -- Insert tickets
  INSERT INTO public.jackpot_tickets (game_id, user_id, username, tickets_bought, amount_paid)
  VALUES (p_game_id, p_user_id, p_username, p_tickets, v_total_cost);
  
  -- Insert transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'jackpot_tickets', -v_total_cost, 'Bought ' || p_tickets || ' jackpot tickets');
  
  -- Handle timer logic
  SELECT COUNT(DISTINCT user_id) INTO v_current_players
  FROM public.jackpot_tickets
  WHERE game_id = p_game_id;
  
  IF v_current_players = 1 THEN
    -- First player: set timer to exactly 1 minute from NOW()
    v_timer_end_at := NOW() + INTERVAL '1 minute';
    
    UPDATE public.jackpot_games
    SET timer_end_at = v_timer_end_at
    WHERE id = p_game_id;
  ELSIF v_is_new_player AND v_current_timer IS NOT NULL THEN
    -- New player joining: add 5 seconds to current timer, but max 90 seconds total from now
    v_timer_end_at := LEAST(
      v_current_timer + INTERVAL '5 seconds',
      NOW() + INTERVAL '90 seconds'
    );
    
    UPDATE public.jackpot_games
    SET timer_end_at = v_timer_end_at
    WHERE id = p_game_id;
  ELSE
    -- Existing player buying more tickets: no timer change
    v_timer_end_at := v_current_timer;
  END IF;
  
  RETURN json_build_object(
    'success', true, 
    'tickets_bought', p_tickets, 
    'amount_paid', v_total_cost,
    'timer_end_at', v_timer_end_at,
    'is_new_player', v_is_new_player,
    'total_players', v_current_players,
    'timer_seconds_remaining', EXTRACT(EPOCH FROM (v_timer_end_at - NOW()))
  );
END;
$function$;