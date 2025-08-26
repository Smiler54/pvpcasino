-- Enhanced security monitoring functions

-- Function to check for suspicious patterns in user activity
CREATE OR REPLACE FUNCTION public.check_enhanced_withdrawal_limits(p_user_id uuid, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_daily_withdrawals NUMERIC;
  v_weekly_withdrawals NUMERIC;
  v_recent_count INTEGER;
  v_user_level INTEGER;
  v_max_daily NUMERIC;
  v_max_weekly NUMERIC;
BEGIN
  -- Get user level for dynamic limits
  SELECT level INTO v_user_level
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- Set limits based on user level
  v_max_daily := CASE 
    WHEN v_user_level >= 10 THEN 2000
    WHEN v_user_level >= 5 THEN 1000
    ELSE 500
  END;
  
  v_max_weekly := v_max_daily * 5;
  
  -- Check daily withdrawal total
  SELECT COALESCE(SUM(amount), 0) INTO v_daily_withdrawals
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > CURRENT_DATE
    AND status IN ('pending', 'processing', 'completed');
  
  -- Check weekly withdrawal total
  SELECT COALESCE(SUM(amount), 0) INTO v_weekly_withdrawals
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > (CURRENT_DATE - INTERVAL '7 days')
    AND status IN ('pending', 'processing', 'completed');
  
  -- Check number of recent withdrawal requests
  SELECT COUNT(*) INTO v_recent_count
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > NOW() - INTERVAL '24 hours'
    AND status != 'cancelled';
  
  -- Apply enhanced security checks
  IF p_amount > v_max_daily THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'Single withdrawal exceeds daily limit for your account level'
    );
  END IF;
  
  IF v_daily_withdrawals + p_amount > v_max_daily THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'Daily withdrawal limit exceeded'
    );
  END IF;
  
  IF v_weekly_withdrawals + p_amount > v_max_weekly THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'Weekly withdrawal limit exceeded'
    );
  END IF;
  
  IF v_recent_count >= 3 THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'Too many withdrawal requests in 24 hours'
    );
  END IF;
  
  RETURN json_build_object(
    'allowed', true,
    'daily_remaining', v_max_daily - v_daily_withdrawals,
    'weekly_remaining', v_max_weekly - v_weekly_withdrawals
  );
END;
$function$;

-- Function to update user balance with enhanced security
CREATE OR REPLACE FUNCTION public.update_user_balance(
  p_user_id uuid, 
  p_amount numeric, 
  p_transaction_type text, 
  p_description text,
  p_stripe_session_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  v_new_balance := v_current_balance + p_amount;
  
  -- Prevent negative balance for most transaction types
  IF v_new_balance < 0 AND p_transaction_type NOT IN ('jackpot_tickets', 'coinflip_bet', 'withdrawal_request') THEN
    RAISE EXCEPTION 'Transaction would result in negative balance';
  END IF;
  
  -- Prevent unreasonably high balances (anti-fraud)
  IF v_new_balance > 100000 THEN
    RAISE EXCEPTION 'Transaction would exceed maximum allowed balance';
  END IF;
  
  -- Update balance
  UPDATE public.profiles
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO public.transactions (
    user_id, 
    type, 
    amount, 
    description,
    stripe_session_id
  ) VALUES (
    p_user_id, 
    p_transaction_type, 
    p_amount, 
    p_description,
    p_stripe_session_id
  );
  
  -- Log significant balance changes
  IF ABS(p_amount) > 1000 THEN
    PERFORM public.log_security_event(
      'large_balance_change',
      p_user_id,
      json_build_object(
        'amount', p_amount,
        'transaction_type', p_transaction_type,
        'old_balance', v_current_balance,
        'new_balance', v_new_balance
      )::jsonb,
      CASE WHEN ABS(p_amount) > 5000 THEN 'critical' ELSE 'warning' END
    );
  END IF;
END;
$function$;

-- Enhanced security alert function
CREATE OR REPLACE FUNCTION public.get_security_alerts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
  v_critical_count INTEGER;
  v_warning_count INTEGER;
  v_recent_suspicious INTEGER;
BEGIN
  -- Only admins can access this
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Count critical events in last 24 hours
  SELECT COUNT(*) INTO v_critical_count
  FROM public.admin_audit_log
  WHERE details->>'severity' = 'critical'
    AND created_at > NOW() - INTERVAL '24 hours';
  
  -- Count warning events in last 24 hours
  SELECT COUNT(*) INTO v_warning_count
  FROM public.admin_audit_log
  WHERE details->>'severity' = 'warning'
    AND created_at > NOW() - INTERVAL '24 hours';
  
  -- Count suspicious activities
  SELECT COUNT(*) INTO v_recent_suspicious
  FROM public.admin_audit_log
  WHERE action LIKE '%suspicious%'
    AND created_at > NOW() - INTERVAL '24 hours';
  
  v_result := json_build_object(
    'critical_alerts', v_critical_count,
    'warning_alerts', v_warning_count,
    'suspicious_activities', v_recent_suspicious,
    'overall_status', CASE 
      WHEN v_critical_count > 0 THEN 'CRITICAL'
      WHEN v_warning_count > 10 THEN 'HIGH'
      WHEN v_warning_count > 5 THEN 'MEDIUM'
      ELSE 'NORMAL'
    END,
    'last_check', NOW()
  );
  
  RETURN v_result;
END;
$function$;