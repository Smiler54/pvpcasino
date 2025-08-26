-- Remove timer_start functionality from buy_jackpot_tickets function
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
  
  RETURN json_build_object(
    'success', true,
    'tickets_bought', p_tickets,
    'amount_paid', total_cost,
    'unique_players_before', current_unique_players,
    'user_already_playing', user_already_playing
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', SQLERRM
    );
END;
$function$