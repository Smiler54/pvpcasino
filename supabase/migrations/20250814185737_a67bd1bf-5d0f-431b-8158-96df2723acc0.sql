-- Add timer fields back to jackpot_games table
ALTER TABLE public.jackpot_games 
ADD COLUMN IF NOT EXISTS timer_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS initial_timer_seconds INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS timer_extension_seconds INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS max_additional_seconds INTEGER DEFAULT 30;

-- Update buy_jackpot_tickets function to include timer logic
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
  v_game_status TEXT;
  v_timer_end_at TIMESTAMPTZ;
  v_current_timer TIMESTAMPTZ;
  v_initial_timer INTEGER := 60;
  v_extension_seconds INTEGER := 5;
  v_max_additional INTEGER := 30;
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
  SELECT status, timer_end_at, initial_timer_seconds, timer_extension_seconds, max_additional_seconds 
  INTO v_game_status, v_current_timer, v_initial_timer, v_extension_seconds, v_max_additional
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
    -- First player: set timer to initial duration from now
    v_timer_end_at := NOW() + (v_initial_timer || ' seconds')::INTERVAL;
    
    UPDATE public.jackpot_games
    SET timer_end_at = v_timer_end_at
    WHERE id = p_game_id;
  ELSIF v_is_new_player AND v_current_timer IS NOT NULL THEN
    -- New player joining: add extension time, but respect maximum total time
    v_timer_end_at := LEAST(
      v_current_timer + (v_extension_seconds || ' seconds')::INTERVAL,
      NOW() + ((v_initial_timer + v_max_additional) || ' seconds')::INTERVAL
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
    'timer_seconds_remaining', GREATEST(0, EXTRACT(EPOCH FROM (v_timer_end_at - NOW())))
  );
END;
$function$;

-- Update get_public_jackpot_stats function to include timer data
CREATE OR REPLACE FUNCTION public.get_public_jackpot_stats()
 RETURNS TABLE(id uuid, ticket_price numeric, total_pool numeric, status text, timer_end_at timestamp with time zone, player_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Return jackpot data with timer information
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

-- Update get_jackpot_public_stats function to include timer data
CREATE OR REPLACE FUNCTION public.get_jackpot_public_stats()
 RETURNS TABLE(id uuid, ticket_price numeric, total_pool numeric, status text, timer_end_at timestamp with time zone, created_at timestamp with time zone, game_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
  
  -- Return public game statistics with timer
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
$function$;

-- Create function to check for expired timers and auto-draw
CREATE OR REPLACE FUNCTION public.check_and_draw_expired_jackpots()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expired_game RECORD;
  v_draw_result JSON;
  v_results JSON[] := '{}';
BEGIN
  -- Find all active games with expired timers that have tickets
  FOR v_expired_game IN 
    SELECT jg.id 
    FROM public.jackpot_games jg
    WHERE jg.status = 'active'
      AND jg.timer_end_at IS NOT NULL
      AND jg.timer_end_at <= NOW()
      AND EXISTS (SELECT 1 FROM public.jackpot_tickets WHERE game_id = jg.id)
  LOOP
    -- Draw winner for this expired game
    SELECT public.draw_jackpot_winner(v_expired_game.id) INTO v_draw_result;
    
    -- Add result to array
    v_results := v_results || v_draw_result;
  END LOOP;
  
  RETURN json_build_object(
    'processed_games', array_length(v_results, 1),
    'results', v_results,
    'timestamp', NOW()
  );
END;
$function$;