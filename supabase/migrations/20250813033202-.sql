-- Add timer fields to jackpot_games table
ALTER TABLE public.jackpot_games 
ADD COLUMN timer_end_at TIMESTAMPTZ,
ADD COLUMN timer_duration INTEGER DEFAULT 30, -- seconds
ADD COLUMN timer_extension INTEGER DEFAULT 5; -- seconds added per new player

-- Update the buy_jackpot_tickets function to handle timer logic
CREATE OR REPLACE FUNCTION public.buy_jackpot_tickets(p_game_id uuid, p_user_id uuid, p_username text, p_tickets integer, p_ticket_price numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_total_cost NUMERIC;
  v_user_balance NUMERIC;
  v_result JSON;
  v_current_players INTEGER;
  v_is_new_player BOOLEAN := FALSE;
  v_timer_end_at TIMESTAMPTZ;
  v_game_status TEXT;
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
  SELECT status INTO v_game_status
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
    -- First player: start 30-second timer
    v_timer_end_at := NOW() + INTERVAL '30 seconds';
    UPDATE public.jackpot_games
    SET timer_end_at = v_timer_end_at
    WHERE id = p_game_id;
  ELSIF v_is_new_player THEN
    -- New player joining: add 5 seconds to timer
    UPDATE public.jackpot_games
    SET timer_end_at = timer_end_at + INTERVAL '5 seconds'
    WHERE id = p_game_id
    RETURNING timer_end_at INTO v_timer_end_at;
  ELSE
    -- Existing player buying more tickets: no timer change
    SELECT timer_end_at INTO v_timer_end_at
    FROM public.jackpot_games
    WHERE id = p_game_id;
  END IF;
  
  RETURN json_build_object(
    'success', true, 
    'tickets_bought', p_tickets, 
    'amount_paid', v_total_cost,
    'timer_end_at', v_timer_end_at,
    'is_new_player', v_is_new_player,
    'total_players', v_current_players
  );
END;
$$;

-- Create function to automatically draw winner when timer expires
CREATE OR REPLACE FUNCTION public.check_jackpot_timer()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_game RECORD;
  v_winner_result JSON;
BEGIN
  -- Find active games where timer has expired
  FOR v_game IN 
    SELECT id FROM public.jackpot_games 
    WHERE status = 'active' 
    AND timer_end_at IS NOT NULL 
    AND timer_end_at <= NOW()
  LOOP
    -- Draw winner for this game
    SELECT public.draw_jackpot_winner(v_game.id) INTO v_winner_result;
    
    -- Log the automatic drawing
    RAISE NOTICE 'Auto-drew winner for game %: %', v_game.id, v_winner_result;
  END LOOP;
  
  RETURN json_build_object('success', true, 'checked_games', 'completed');
END;
$$;