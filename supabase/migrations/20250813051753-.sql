-- Fix remaining function search_path issues for complete security hardening

-- Update all remaining database functions to use immutable search_path settings

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
  v_user_exists BOOLEAN;
  v_new_game_id UUID;
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
  
  -- Mark game as completed
  UPDATE public.jackpot_games
  SET 
    status = 'completed',
    winner_id = v_winner_user_id,
    winner_name = v_winner_username,
    completed_at = now()
  WHERE id = p_game_id;
  
  -- Create a new active game
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
$function$;

CREATE OR REPLACE FUNCTION public.make_user_admin(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
  v_caller_role TEXT;
  v_admin_count INTEGER;
BEGIN
  -- Check if there are any existing admins
  SELECT COUNT(*) INTO v_admin_count 
  FROM public.user_roles 
  WHERE role = 'admin';
  
  -- If no admins exist, allow the first admin creation (bootstrap)
  IF v_admin_count = 0 THEN
    -- Log this critical bootstrap operation
    INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (
      auth.uid(), 
      'admin_bootstrap', 
      0, 
      'Bootstrap: First admin created for user ' || p_user_id
    );
    
    -- Assign admin role (insert if not exists)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Also assign default user role if needed
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN json_build_object(
      'success', true,
      'user_id', p_user_id,
      'granted_by', auth.uid(),
      'message', 'Bootstrap admin created successfully',
      'bootstrap', true
    );
  END IF;
  
  -- For non-bootstrap cases, check if caller is already an admin
  SELECT role INTO v_caller_role 
  FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin';
  
  IF v_caller_role IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized: Only existing admins can create new admins'
    );
  END IF;
  
  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Target user does not exist'
    );
  END IF;
  
  -- Log this critical operation with caller info
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (
    auth.uid(), 
    'admin_action', 
    0, 
    'Admin role granted to user ' || p_user_id || ' by admin ' || auth.uid()
  );
  
  -- Assign admin role (insert if not exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Also assign default user role if needed
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  SELECT json_build_object(
    'success', true,
    'user_id', p_user_id,
    'granted_by', auth.uid(),
    'message', 'Admin role granted successfully'
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_jackpot_aggregate_data(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.calculate_level(exp integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  current_level INTEGER := 1;
  required_exp INTEGER := 0;
  level_increment INTEGER := 50;
BEGIN
  -- Level 1 = 0 exp, Level 2 = 50 exp, Level 3 = 125 exp (50+75), Level 4 = 225 exp (50+75+100), etc.
  WHILE exp >= required_exp LOOP
    IF current_level = 1 THEN
      required_exp := required_exp + level_increment; -- Level 2 requires 50 exp
    ELSE
      required_exp := required_exp + (level_increment + (current_level - 2) * 25); -- Each level adds 25 more exp requirement
    END IF;
    
    IF exp >= required_exp THEN
      current_level := current_level + 1;
    END IF;
  END LOOP;
  
  RETURN current_level;
END;
$function$;

CREATE OR REPLACE FUNCTION public.exp_for_next_level(current_exp integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  current_level INTEGER;
  required_exp INTEGER := 0;
  level_increment INTEGER := 50;
  i INTEGER := 1;
BEGIN
  current_level := public.calculate_level(current_exp);
  
  -- Calculate total exp needed for next level
  WHILE i <= current_level LOOP
    IF i = 1 THEN
      -- Level 1 to 2 requires 50 exp
      required_exp := required_exp + level_increment;
    ELSE
      -- Each subsequent level requires 25 more exp than the previous increment
      required_exp := required_exp + (level_increment + (i - 2) * 25);
    END IF;
    i := i + 1;
  END LOOP;
  
  RETURN required_exp;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_balance_safe(p_user_id uuid, p_amount numeric, p_operation text DEFAULT 'add'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_operation = 'add' THEN
    UPDATE public.profiles 
    SET balance = balance + p_amount
    WHERE user_id = p_user_id;
  ELSIF p_operation = 'subtract' THEN
    UPDATE public.profiles 
    SET balance = balance - p_amount
    WHERE user_id = p_user_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_withdrawal_rate_limit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > NOW() - INTERVAL '24 hours'
    AND status != 'cancelled';
  
  RETURN v_count < 3;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.level := public.calculate_level(NEW.experience);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_level_rewards(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
  unclaimed_levels INTEGER[];
  level_num INTEGER;
  reward_per_level NUMERIC := 0.10;
  total_rewards NUMERIC := 0;
  claimed_count INTEGER := 0;
BEGIN
  -- Get user's current level and claimed rewards
  SELECT level, experience INTO user_profile
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF user_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Find unclaimed levels (levels 2 and above that haven't been claimed)
  SELECT array_agg(level_num) INTO unclaimed_levels
  FROM generate_series(2, user_profile.level) AS level_num
  WHERE NOT EXISTS (
    SELECT 1 FROM public.level_rewards 
    WHERE user_id = p_user_id AND level = level_num
  );
  
  -- If no unclaimed rewards, return early
  IF unclaimed_levels IS NULL OR array_length(unclaimed_levels, 1) = 0 THEN
    RETURN json_build_object(
      'success', true, 
      'message', 'No unclaimed rewards available',
      'rewards_claimed', 0,
      'total_amount', 0
    );
  END IF;
  
  -- Claim rewards for each unclaimed level
  FOREACH level_num IN ARRAY unclaimed_levels
  LOOP
    -- Insert claimed reward record
    INSERT INTO public.level_rewards (user_id, level, reward_amount)
    VALUES (p_user_id, level_num, reward_per_level);
    
    claimed_count := claimed_count + 1;
    total_rewards := total_rewards + reward_per_level;
  END LOOP;
  
  -- Add rewards to user balance
  UPDATE public.profiles
  SET balance = balance + total_rewards
  WHERE user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (
    p_user_id, 
    'level_reward', 
    total_rewards, 
    'Level-up rewards claimed for ' || claimed_count || ' levels'
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Successfully claimed ' || claimed_count || ' level rewards',
    'rewards_claimed', claimed_count,
    'total_amount', total_rewards
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_jackpot_timer()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

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
  v_max_timer_end TIMESTAMPTZ;
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
  
  -- Handle timer logic with 60-second maximum cap
  SELECT COUNT(DISTINCT user_id) INTO v_current_players
  FROM public.jackpot_tickets
  WHERE game_id = p_game_id;
  
  -- Calculate maximum allowed timer end (60 seconds from first ticket)
  SELECT created_at + INTERVAL '60 seconds' INTO v_max_timer_end
  FROM public.jackpot_games
  WHERE id = p_game_id;
  
  IF v_current_players = 1 THEN
    -- First player: start 30-second timer
    v_timer_end_at := NOW() + INTERVAL '30 seconds';
    -- Make sure it doesn't exceed 60 seconds from game creation
    IF v_timer_end_at > v_max_timer_end THEN
      v_timer_end_at := v_max_timer_end;
    END IF;
    
    UPDATE public.jackpot_games
    SET timer_end_at = v_timer_end_at
    WHERE id = p_game_id;
  ELSIF v_is_new_player THEN
    -- New player joining: add 5 seconds to timer, but cap at 60 seconds total
    SELECT timer_end_at + INTERVAL '5 seconds' INTO v_timer_end_at
    FROM public.jackpot_games
    WHERE id = p_game_id;
    
    -- Cap at maximum 60 seconds from game creation
    IF v_timer_end_at > v_max_timer_end THEN
      v_timer_end_at := v_max_timer_end;
    END IF;
    
    UPDATE public.jackpot_games
    SET timer_end_at = v_timer_end_at
    WHERE id = p_game_id;
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
    'total_players', v_current_players,
    'timer_capped', (v_timer_end_at = v_max_timer_end)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_jackpot_tickets(p_game_id uuid, p_user_id uuid)
RETURNS TABLE(tickets_bought integer, amount_paid numeric, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify the requesting user matches the user_id parameter
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Can only view your own tickets';
  END IF;

  RETURN QUERY
  SELECT 
    jt.tickets_bought,
    jt.amount_paid,
    jt.created_at
  FROM public.jackpot_tickets jt
  WHERE jt.game_id = p_game_id 
  AND jt.user_id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_balance_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Prevent negative balance (except for small rounding errors)
  IF NEW.balance < -0.01 THEN
    RAISE EXCEPTION 'Balance cannot be negative: %', NEW.balance;
  END IF;
  
  -- Prevent unreasonably high balances (possible fraud)
  IF NEW.balance > 1000000 THEN
    RAISE EXCEPTION 'Balance exceeds maximum allowed: %', NEW.balance;
  END IF;
  
  -- Log significant balance changes
  IF ABS(NEW.balance - OLD.balance) > 1000 THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id, 
      target_user_id, 
      action, 
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'), 
      NEW.user_id,
      'large_balance_change',
      json_build_object(
        'old_balance', OLD.balance,
        'new_balance', NEW.balance,
        'difference', NEW.balance - OLD.balance
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_balance(p_user_id uuid, p_amount numeric, p_transaction_type text, p_description text DEFAULT NULL::text, p_stripe_session_id text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  exp_gained INTEGER := 0;
  new_experience INTEGER;
  new_level INTEGER;
  v_user_exists BOOLEAN;
BEGIN
  -- Validate user exists in profiles table
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User profile does not exist for user_id: %', p_user_id;
  END IF;
  
  -- Validate amount is reasonable
  IF ABS(p_amount) > 100000 THEN
    RAISE EXCEPTION 'Transaction amount too large: %', p_amount;
  END IF;
  
  -- Calculate experience gained for spending (negative amounts)
  IF p_amount < 0 THEN
    exp_gained := ABS(p_amount)::INTEGER; -- 1 exp per dollar spent
  END IF;
  
  -- Insert transaction record first (this will fail if user doesn't exist)
  INSERT INTO public.transactions (user_id, type, amount, description, stripe_session_id)
  VALUES (p_user_id, p_transaction_type, p_amount, p_description, p_stripe_session_id);
  
  -- Update user balance and experience
  UPDATE public.profiles 
  SET 
    balance = balance + p_amount,
    experience = experience + exp_gained
  WHERE user_id = p_user_id
  RETURNING experience INTO new_experience;
  
  -- Calculate and update new level
  new_level := public.calculate_level(new_experience);
  
  UPDATE public.profiles 
  SET level = new_level
  WHERE user_id = p_user_id;
  
  -- Log large transactions
  IF ABS(p_amount) > 100 THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id, 
      target_user_id, 
      action, 
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      p_user_id,
      'large_transaction',
      json_build_object(
        'amount', p_amount,
        'type', p_transaction_type,
        'description', p_description
      )
    );
  END IF;
END;
$function$;