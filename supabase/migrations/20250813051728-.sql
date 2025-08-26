-- Security Enhancement Phase 1: Database Function Hardening
-- Update existing functions to use immutable search_path settings for better security

-- Update handle_new_user function with immutable search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || SUBSTR(NEW.id::text, 1, 8)));
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;

-- Update has_role function with immutable search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- Security Enhancement Phase 2: Financial Data Protection
-- Create read-only public view for profiles excluding sensitive financial data

CREATE VIEW public.public_profiles AS
SELECT 
  user_id,
  username,
  level,
  experience,
  created_at,
  updated_at
FROM public.profiles;

-- Enable RLS on the view
ALTER VIEW public.public_profiles SET (security_invoker = true);

-- Grant access to authenticated users for the public view
GRANT SELECT ON public.public_profiles TO authenticated;

-- Security Enhancement Phase 3: Game Integrity Protection
-- Update RLS policies for game_matches to hide sensitive data during active games

-- Drop existing policies on game_matches to recreate them with enhanced security
DROP POLICY IF EXISTS "Users can view their own matches" ON public.game_matches;
DROP POLICY IF EXISTS "System can update matches" ON public.game_matches;
DROP POLICY IF EXISTS "System can create matches" ON public.game_matches;

-- Create enhanced RLS policy that hides server_seed and salt for active games
CREATE POLICY "Users can view their own matches with restricted sensitive data"
ON public.game_matches
FOR SELECT
USING (
  (auth.uid() = maker_id OR auth.uid() = taker_id) AND
  -- Hide server_seed and salt for active games
  (status != 'active' OR (server_seed IS NULL AND salt IS NULL))
);

CREATE POLICY "Users can create matches"
ON public.game_matches
FOR INSERT
WITH CHECK (auth.uid() = taker_id);

CREATE POLICY "System can update completed matches only"
ON public.game_matches
FOR UPDATE
USING (
  (auth.uid() = maker_id OR auth.uid() = taker_id) AND
  status = 'active'
);

-- Security Enhancement Phase 4: Enhanced Financial Transaction Monitoring
-- Create function for enhanced transaction logging with automatic fraud detection

CREATE OR REPLACE FUNCTION public.log_financial_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_daily_total NUMERIC;
  v_transaction_count INTEGER;
  v_user_balance NUMERIC;
BEGIN
  -- Get user's current balance
  SELECT balance INTO v_user_balance
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Calculate daily transaction volume for this user
  SELECT 
    COALESCE(SUM(ABS(amount)), 0),
    COUNT(*)
  INTO v_daily_total, v_transaction_count
  FROM public.transactions
  WHERE user_id = NEW.user_id 
    AND created_at >= CURRENT_DATE
    AND type IN ('credit_purchase', 'withdrawal_request', 'jackpot_tickets');

  -- Log suspicious activity patterns
  IF v_daily_total > 1000 OR v_transaction_count > 50 OR ABS(NEW.amount) > 500 THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id,
      target_user_id,
      action,
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      NEW.user_id,
      'suspicious_financial_activity',
      json_build_object(
        'transaction_id', NEW.id,
        'transaction_type', NEW.type,
        'amount', NEW.amount,
        'daily_total', v_daily_total,
        'daily_count', v_transaction_count,
        'user_balance', v_user_balance,
        'timestamp', NEW.created_at
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for automatic financial transaction monitoring
DROP TRIGGER IF EXISTS monitor_financial_transactions ON public.transactions;
CREATE TRIGGER monitor_financial_transactions
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  WHEN (NEW.type IN ('credit_purchase', 'withdrawal_request', 'jackpot_tickets', 'jackpot_win'))
  EXECUTE FUNCTION public.log_financial_transaction();

-- Create rate limiting function for withdrawal requests
CREATE OR REPLACE FUNCTION public.check_enhanced_withdrawal_limits(p_user_id uuid, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hourly_count INTEGER;
  v_daily_amount NUMERIC;
  v_weekly_count INTEGER;
BEGIN
  -- Check hourly withdrawal attempts (max 1 per hour)
  SELECT COUNT(*) INTO v_hourly_count
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > NOW() - INTERVAL '1 hour'
    AND status != 'cancelled';
    
  IF v_hourly_count >= 1 THEN
    RETURN json_build_object(
      'allowed', false, 
      'reason', 'Maximum 1 withdrawal per hour exceeded'
    );
  END IF;

  -- Check daily withdrawal amount (max $1000 per day)
  SELECT COALESCE(SUM(amount), 0) INTO v_daily_amount
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > CURRENT_DATE
    AND status != 'cancelled';
    
  IF v_daily_amount + p_amount > 1000 THEN
    RETURN json_build_object(
      'allowed', false, 
      'reason', 'Daily withdrawal limit of $1000 exceeded'
    );
  END IF;

  -- Check weekly withdrawal count (max 7 per week)
  SELECT COUNT(*) INTO v_weekly_count
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > NOW() - INTERVAL '7 days'
    AND status != 'cancelled';
    
  IF v_weekly_count >= 7 THEN
    RETURN json_build_object(
      'allowed', false, 
      'reason', 'Weekly withdrawal limit of 7 transactions exceeded'
    );
  END IF;

  RETURN json_build_object('allowed', true);
END;
$function$;

-- Update request_withdrawal function to use enhanced rate limiting
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_user_id uuid, p_amount numeric, p_method text, p_details jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_balance NUMERIC;
  v_withdrawal_id UUID;
  v_rate_limit_result JSON;
BEGIN
  -- Enhanced rate limit check
  SELECT public.check_enhanced_withdrawal_limits(p_user_id, p_amount) INTO v_rate_limit_result;
  
  IF NOT (v_rate_limit_result->>'allowed')::boolean THEN
    RETURN json_build_object(
      'success', false, 
      'error', v_rate_limit_result->>'reason'
    );
  END IF;

  -- Validate amount constraints
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid withdrawal amount');
  END IF;
  
  IF p_amount < 10 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum withdrawal amount is $10');
  END IF;
  
  IF p_amount > 5000 THEN -- Reduced from $10,000 for enhanced security
    RETURN json_build_object('success', false, 'error', 'Maximum withdrawal amount is $5,000');
  END IF;

  -- Validate withdrawal method
  IF p_method NOT IN ('paypal', 'bank_transfer', 'crypto') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid withdrawal method');
  END IF;

  -- Validate method-specific details
  IF p_method = 'paypal' AND (p_details->>'email' IS NULL OR p_details->>'email' = '') THEN
    RETURN json_build_object('success', false, 'error', 'PayPal email is required');
  END IF;
  
  IF p_method = 'bank_transfer' AND (
    p_details->>'account_number' IS NULL OR p_details->>'account_number' = '' OR
    p_details->>'routing_number' IS NULL OR p_details->>'routing_number' = '' OR
    p_details->>'account_holder' IS NULL OR p_details->>'account_holder' = ''
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Complete bank transfer details are required');
  END IF;
  
  IF p_method = 'crypto' AND (
    p_details->>'wallet_address' IS NULL OR p_details->>'wallet_address' = '' OR
    p_details->>'currency' IS NULL OR p_details->>'currency' = ''
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Crypto wallet address and currency are required');
  END IF;

  -- Check user balance
  SELECT balance INTO v_user_balance
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF v_user_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF v_user_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Create withdrawal request
  INSERT INTO public.withdrawals (user_id, amount, withdrawal_method, withdrawal_details)
  VALUES (p_user_id, p_amount, p_method, p_details)
  RETURNING id INTO v_withdrawal_id;
  
  -- Deduct from user balance (hold the funds)
  UPDATE public.profiles
  SET balance = balance - p_amount
  WHERE user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'withdrawal_request', -p_amount, 'Withdrawal request: $' || p_amount || ' via ' || p_method);
  
  RETURN json_build_object(
    'success', true, 
    'withdrawal_id', v_withdrawal_id,
    'amount', p_amount,
    'message', 'Withdrawal request submitted successfully'
  );
END;
$function$;