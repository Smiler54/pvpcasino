-- Add timer fields back to jackpot_games table
ALTER TABLE public.jackpot_games 
ADD COLUMN timer_start_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN timer_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN countdown_seconds INTEGER DEFAULT 45;

-- Create function to start countdown timer
CREATE OR REPLACE FUNCTION public.start_jackpot_countdown(p_game_id uuid, p_countdown_seconds integer DEFAULT 45)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_player_count INTEGER;
  v_game_status TEXT;
BEGIN
  -- Check if game exists and is active
  SELECT status INTO v_game_status
  FROM public.jackpot_games 
  WHERE id = p_game_id;
  
  IF v_game_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;
  
  IF v_game_status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Game is not active');
  END IF;
  
  -- Count unique players
  SELECT COUNT(DISTINCT user_id) INTO v_player_count
  FROM public.jackpot_tickets 
  WHERE game_id = p_game_id;
  
  -- Only start countdown if we have enough players and timer hasn't started
  IF v_player_count >= 2 THEN
    UPDATE public.jackpot_games
    SET 
      timer_start_at = NOW(),
      timer_end_at = NOW() + (p_countdown_seconds || ' seconds')::INTERVAL,
      countdown_seconds = p_countdown_seconds
    WHERE id = p_game_id 
      AND timer_start_at IS NULL; -- Only start if not already started
    
    IF FOUND THEN
      RETURN json_build_object(
        'success', true,
        'timer_started', true,
        'countdown_seconds', p_countdown_seconds,
        'end_time', (SELECT timer_end_at FROM public.jackpot_games WHERE id = p_game_id)
      );
    ELSE
      RETURN json_build_object(
        'success', true,
        'timer_started', false,
        'message', 'Timer already running'
      );
    END IF;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'timer_started', false,
    'player_count', v_player_count,
    'message', 'Need at least 2 players to start countdown'
  );
END;
$function$;

-- Update buy_jackpot_tickets function to potentially start countdown
CREATE OR REPLACE FUNCTION public.buy_jackpot_tickets(p_game_id uuid, p_user_id uuid, p_username text, p_tickets integer, p_ticket_price numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC;
  total_cost NUMERIC;
  game_status TEXT;
  current_unique_players INTEGER;
  user_already_playing BOOLEAN := FALSE;
  timer_result JSON;
BEGIN
  -- Calculate total cost
  total_cost := p_tickets * p_ticket_price;
  
  -- Check if game exists and is active
  SELECT status INTO game_status
  FROM public.jackpot_games 
  WHERE id = p_game_id;
  
  IF game_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;
  
  IF game_status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Game is not active');
  END IF;

  -- Get user's current balance
  SELECT balance INTO current_balance 
  FROM public.profiles 
  WHERE user_id = p_user_id;
  
  IF current_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  IF current_balance < total_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Count unique players BEFORE this purchase
  SELECT COUNT(DISTINCT user_id) INTO current_unique_players
  FROM public.jackpot_tickets 
  WHERE game_id = p_game_id;
  
  -- Check if this user already has tickets in this game
  SELECT EXISTS(
    SELECT 1 FROM public.jackpot_tickets 
    WHERE game_id = p_game_id AND user_id = p_user_id
  ) INTO user_already_playing;

  -- Deduct balance
  UPDATE public.profiles 
  SET balance = balance - total_cost 
  WHERE user_id = p_user_id;
  
  -- Create transaction record
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'jackpot_tickets', -total_cost, 'Jackpot ticket purchase');
  
  -- Insert ticket purchase
  INSERT INTO public.jackpot_tickets (game_id, user_id, username, tickets_bought, amount_paid)
  VALUES (p_game_id, p_user_id, p_username, p_tickets, total_cost);
  
  -- Update jackpot pool
  UPDATE public.jackpot_games 
  SET total_pool = total_pool + total_cost
  WHERE id = p_game_id;
  
  -- Try to start countdown if conditions are met
  SELECT public.start_jackpot_countdown(p_game_id, 45) INTO timer_result;
  
  RETURN json_build_object(
    'success', true,
    'tickets_bought', p_tickets,
    'amount_paid', total_cost,
    'unique_players_before', current_unique_players,
    'user_already_playing', user_already_playing,
    'timer_result', timer_result
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', SQLERRM
    );
END;
$function$;