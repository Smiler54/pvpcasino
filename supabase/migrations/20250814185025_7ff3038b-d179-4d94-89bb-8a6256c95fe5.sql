-- Remove timer-related fields from jackpot_games table
ALTER TABLE public.jackpot_games 
DROP COLUMN IF EXISTS timer_end_at,
DROP COLUMN IF EXISTS timer_duration,
DROP COLUMN IF EXISTS timer_extension;

-- Update buy_jackpot_tickets function to remove timer logic
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
  
  -- Get current player count
  SELECT COUNT(DISTINCT user_id) INTO v_current_players
  FROM public.jackpot_tickets
  WHERE game_id = p_game_id;
  
  RETURN json_build_object(
    'success', true, 
    'tickets_bought', p_tickets, 
    'amount_paid', v_total_cost,
    'is_new_player', v_is_new_player,
    'total_players', v_current_players
  );
END;
$function$;

-- Update get_public_jackpot_stats function to remove timer fields
CREATE OR REPLACE FUNCTION public.get_public_jackpot_stats()
 RETURNS TABLE(id uuid, ticket_price numeric, total_pool numeric, status text, player_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Return only non-sensitive jackpot data without timer information
  RETURN QUERY
  SELECT 
    jg.id,
    jg.ticket_price,
    jg.total_pool,
    jg.status,
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

-- Update get_jackpot_public_stats function to remove timer fields
CREATE OR REPLACE FUNCTION public.get_jackpot_public_stats()
 RETURNS TABLE(id uuid, ticket_price numeric, total_pool numeric, status text, created_at timestamp with time zone, game_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- No authentication required for viewing public jackpot stats
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
  
  -- Return only public game statistics
  RETURN QUERY
  SELECT 
    jg.id,
    jg.ticket_price,
    jg.total_pool,
    jg.status,
    jg.created_at,
    jg.status as game_status
  FROM public.jackpot_games jg
  WHERE jg.status IN ('active', 'completed')
  ORDER BY jg.created_at DESC;
END;
$function$;

-- Remove the check_jackpot_timer function if it exists
DROP FUNCTION IF EXISTS public.check_jackpot_timer();