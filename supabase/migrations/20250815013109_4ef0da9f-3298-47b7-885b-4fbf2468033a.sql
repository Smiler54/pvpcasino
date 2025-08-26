-- Fix search path for buy_jackpot_tickets function
CREATE OR REPLACE FUNCTION buy_jackpot_tickets(
  p_game_id UUID,
  p_user_id UUID,
  p_username TEXT,
  p_tickets INTEGER,
  p_ticket_price NUMERIC
)
RETURNS JSON AS $$
DECLARE
  current_balance NUMERIC;
  total_cost NUMERIC;
  game_status TEXT;
  current_unique_players INTEGER;
  v_timer_end_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate total cost
  total_cost := p_tickets * p_ticket_price;
  
  -- Check if game exists and is active
  SELECT status, timer_end_at INTO game_status, v_timer_end_at
  FROM jackpot_games 
  WHERE id = p_game_id;
  
  IF game_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;
  
  IF game_status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Game is not active');
  END IF;
  
  -- Get user's current balance
  SELECT balance INTO current_balance 
  FROM profiles 
  WHERE user_id = p_user_id;
  
  IF current_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  IF current_balance < total_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Count unique players before this purchase
  SELECT COUNT(DISTINCT user_id) INTO current_unique_players
  FROM jackpot_tickets 
  WHERE game_id = p_game_id;
  
  -- Check if this user already has tickets in this game
  DECLARE
    user_already_playing BOOLEAN := FALSE;
  BEGIN
    SELECT EXISTS(
      SELECT 1 FROM jackpot_tickets 
      WHERE game_id = p_game_id AND user_id = p_user_id
    ) INTO user_already_playing;
  END;
  
  -- Deduct balance
  UPDATE profiles 
  SET balance = balance - total_cost 
  WHERE user_id = p_user_id;
  
  -- Create transaction record
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'jackpot_bet', -total_cost, 'Jackpot ticket purchase');
  
  -- Insert ticket purchase
  INSERT INTO jackpot_tickets (game_id, user_id, username, tickets_bought, amount_paid)
  VALUES (p_game_id, p_user_id, p_username, p_tickets, total_cost);
  
  -- Update jackpot pool
  UPDATE jackpot_games 
  SET total_pool = total_pool + total_cost
  WHERE id = p_game_id;
  
  -- Start timer only if this is the second unique player AND timer hasn't started yet
  IF current_unique_players = 1 AND NOT user_already_playing AND v_timer_end_at IS NULL THEN
    UPDATE jackpot_games 
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';