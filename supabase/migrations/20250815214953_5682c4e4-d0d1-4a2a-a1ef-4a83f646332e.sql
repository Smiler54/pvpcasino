-- Fix the digest function error by ensuring pgcrypto extension is properly loaded
-- and fix timer inconsistency and game reset issues

-- First ensure pgcrypto extension is available for digest function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fix the provably fair function to work properly with the extension
DROP FUNCTION IF EXISTS public.generate_coinflip_provably_fair(uuid);

CREATE OR REPLACE FUNCTION public.generate_coinflip_provably_fair(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_server_seed TEXT;
  v_server_seed_hash TEXT;
  v_client_seed TEXT;
  v_hmac_result TEXT;
  v_result TEXT;
  v_decimal_value BIGINT;
BEGIN
  -- Generate server seed (32 bytes = 64 hex chars)
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  
  -- Generate server seed hash using pgcrypto digest
  v_server_seed_hash := encode(digest(v_server_seed::bytea, 'sha256'), 'hex');
  
  -- Generate client seed (32 bytes = 64 hex chars)
  v_client_seed := encode(gen_random_bytes(32), 'hex');
  
  -- Generate HMAC result using pgcrypto
  v_hmac_result := encode(hmac(v_client_seed::bytea, v_server_seed::bytea, 'sha256'), 'hex');
  
  -- Determine result based on HMAC (use first 8 characters)
  v_decimal_value := ('x' || substring(v_hmac_result, 1, 8))::bit(32)::bigint;
  v_result := CASE WHEN v_decimal_value % 2 = 0 THEN 'heads' ELSE 'tails' END;
  
  -- Update the game with provably fair data and result
  UPDATE public.coinflip_games
  SET 
    server_seed = v_server_seed,
    server_seed_hash = v_server_seed_hash,
    client_seed = v_client_seed,
    hmac_result = v_hmac_result,
    result = v_result
  WHERE id = p_game_id;
  
  RETURN json_build_object(
    'server_seed_hash', v_server_seed_hash,
    'client_seed', v_client_seed,
    'hmac_result', v_hmac_result,
    'result', v_result
  );
END;
$$;

-- Fix the jackpot draw function to properly create new games and fix timer consistency
-- Update to ensure timer is always 60 seconds consistently
CREATE OR REPLACE FUNCTION public.buy_jackpot_tickets(p_game_id uuid, p_user_id uuid, p_username text, p_tickets integer, p_ticket_price numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_balance NUMERIC;
  total_cost NUMERIC;
  game_status TEXT;
  current_unique_players INTEGER;
  v_timer_end_at TIMESTAMPTZ;
  user_already_playing BOOLEAN := FALSE;
BEGIN
  -- Calculate total cost
  total_cost := p_tickets * p_ticket_price;
  
  -- Check if game exists and is active
  SELECT status, timer_end_at INTO game_status, v_timer_end_at
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
  
  -- Count unique players before this purchase
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
  
  -- FIXED: Start timer consistently when 2nd player joins (60 seconds always)
  IF current_unique_players = 1 AND NOT user_already_playing AND v_timer_end_at IS NULL THEN
    UPDATE public.jackpot_games 
    SET 
      timer_end_at = NOW() + INTERVAL '60 seconds',
      initial_timer_seconds = 60
    WHERE id = p_game_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'tickets_bought', p_tickets,
    'amount_paid', total_cost,
    'timer_started', (current_unique_players = 1 AND NOT user_already_playing AND v_timer_end_at IS NULL)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', SQLERRM
    );
END;
$$;

-- Fix draw winner function to properly reset and create new games
CREATE OR REPLACE FUNCTION public.draw_jackpot_winner(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total_tickets INTEGER;
  v_random_ticket INTEGER;
  v_winner_user_id UUID;
  v_winner_username TEXT;
  v_jackpot_amount NUMERIC;
  v_current_count INTEGER := 0;
  v_ticket_record RECORD;
  v_user_exists BOOLEAN;
  v_new_game_id UUID;
  v_game_status TEXT;
BEGIN
  -- Check if game is still active and not already completed
  SELECT status INTO v_game_status
  FROM public.jackpot_games
  WHERE id = p_game_id;
  
  IF v_game_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;
  
  IF v_game_status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Game is not active or already completed');
  END IF;

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
  
  -- Check if the winner actually exists in profiles table
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = v_winner_user_id) INTO v_user_exists;
  
  -- Only update balance if user exists, otherwise just mark the winner
  IF v_user_exists THEN
    -- Update winner's balance using the safe function
    PERFORM public.update_user_balance(
      v_winner_user_id, 
      v_jackpot_amount, 
      'jackpot_win', 
      'Won jackpot: $' || v_jackpot_amount
    );
  END IF;
  
  -- Mark game as completed (with check to ensure it's still active)
  UPDATE public.jackpot_games
  SET 
    status = 'completed',
    winner_id = v_winner_user_id,
    winner_name = v_winner_username,
    completed_at = now()
  WHERE id = p_game_id AND status = 'active';
  
  -- Check if we actually updated a game
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Game was already completed by another process'
    );
  END IF;
  
  -- FIXED: Always create a new game immediately after completion
  -- This prevents the lag issue on iOS Safari
  INSERT INTO public.jackpot_games (ticket_price, total_pool, status)
  VALUES (1.00, 0.00, 'active')
  RETURNING id INTO v_new_game_id;
  
  RETURN json_build_object(
    'success', true, 
    'winner_id', v_winner_user_id,
    'winner_name', v_winner_username,
    'jackpot_amount', v_jackpot_amount,
    'total_tickets', v_total_tickets,
    'new_game_id', v_new_game_id,
    'user_exists', v_user_exists
  );
END;
$$;