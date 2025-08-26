-- Security fix: Implement secure financial data access controls

-- 1. Create function to check enhanced withdrawal limits
CREATE OR REPLACE FUNCTION public.check_enhanced_withdrawal_limits(p_user_id uuid, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_daily_count INTEGER;
  v_daily_amount NUMERIC;
  v_weekly_amount NUMERIC;
BEGIN
  -- Check daily withdrawal count (max 3 per day)
  SELECT COUNT(*) INTO v_daily_count
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > CURRENT_DATE
    AND status != 'cancelled';
    
  IF v_daily_count >= 3 THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'Daily withdrawal limit exceeded (3 per day)'
    );
  END IF;
  
  -- Check daily withdrawal amount (max $2000 per day)
  SELECT COALESCE(SUM(amount), 0) INTO v_daily_amount
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > CURRENT_DATE
    AND status != 'cancelled';
    
  IF v_daily_amount + p_amount > 2000 THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'Daily withdrawal amount limit exceeded ($2000 per day)'
    );
  END IF;
  
  -- Check weekly withdrawal amount (max $5000 per week)
  SELECT COALESCE(SUM(amount), 0) INTO v_weekly_amount
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > CURRENT_DATE - INTERVAL '7 days'
    AND status != 'cancelled';
    
  IF v_weekly_amount + p_amount > 5000 THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'Weekly withdrawal amount limit exceeded ($5000 per week)'
    );
  END IF;
  
  RETURN json_build_object('allowed', true);
END;
$function$;

-- 2. Update profiles RLS policy to restrict sensitive data access
DROP POLICY IF EXISTS "Admins can view all profiles for management" ON public.profiles;
CREATE POLICY "Admins can view limited profile data" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  (has_role(auth.uid(), 'admin'::app_role) AND false) -- Admins must use secure functions
);

-- 3. Update withdrawals RLS policy to be more restrictive
DROP POLICY IF EXISTS "Admins can manage all withdrawals" ON public.withdrawals;
CREATE POLICY "Admins can manage withdrawals securely" 
ON public.withdrawals 
FOR ALL 
USING (
  (auth.uid() = user_id) OR 
  (has_role(auth.uid(), 'admin'::app_role) AND action IN ('approve', 'reject', 'process'))
);

-- 4. Create secure admin function for withdrawal management
CREATE OR REPLACE FUNCTION public.admin_get_pending_withdrawals()
RETURNS TABLE(
  id uuid, 
  user_id uuid, 
  username text,
  amount numeric, 
  withdrawal_method text, 
  status text, 
  requested_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only admins can access this
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Log admin access
  PERFORM public.log_security_event(
    'admin_withdrawal_access',
    auth.uid(),
    json_build_object('action', 'view_pending_withdrawals')::jsonb,
    'info'
  );
  
  RETURN QUERY
  SELECT 
    w.id,
    w.user_id,
    p.username,
    w.amount,
    w.withdrawal_method,
    w.status,
    w.requested_at
  FROM public.withdrawals w
  JOIN public.profiles p ON p.user_id = w.user_id
  WHERE w.status = 'pending'
  ORDER BY w.requested_at ASC;
END;
$function$;

-- 5. Create secure function for admin profile management
CREATE OR REPLACE FUNCTION public.admin_get_user_summary(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  username text,
  balance_tier text,
  level integer,
  account_status text,
  last_active timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only admins can access this
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Log admin access
  PERFORM public.log_security_event(
    'admin_profile_access',
    p_user_id,
    json_build_object('admin_id', auth.uid(), 'action', 'view_summary')::jsonb,
    'info'
  );
  
  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    CASE 
      WHEN p.balance < 10 THEN 'Low ($0-$9.99)'
      WHEN p.balance < 100 THEN 'Medium ($10-$99.99)'
      WHEN p.balance < 1000 THEN 'High ($100-$999.99)'
      ELSE 'Very High ($1000+)'
    END as balance_tier,
    p.level,
    CASE 
      WHEN p.balance >= 0 THEN 'Active'
      ELSE 'Inactive'
    END as account_status,
    p.updated_at as last_active
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
END;
$function$;

-- 6. Restrict game seed access until match completion
CREATE OR REPLACE FUNCTION public.get_match_result_safe(p_match_id uuid)
RETURNS TABLE(
  id uuid,
  amount numeric,
  status text,
  result_side text,
  winner_id uuid,
  completed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only return seed data for completed matches and only to participants
  RETURN QUERY
  SELECT 
    gm.id,
    gm.amount,
    gm.status,
    gm.result_side,
    gm.winner_id,
    gm.completed_at
  FROM public.game_matches gm
  WHERE gm.id = p_match_id
    AND (gm.maker_id = auth.uid() OR gm.taker_id = auth.uid())
    AND gm.status = 'completed';
END;
$function$;

-- 7. Add trigger to validate withdrawal requests
CREATE OR REPLACE FUNCTION public.validate_withdrawal_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_limit_result json;
BEGIN
  -- Check enhanced withdrawal limits
  SELECT public.check_enhanced_withdrawal_limits(NEW.user_id, NEW.amount) INTO v_limit_result;
  
  IF NOT (v_limit_result->>'allowed')::boolean THEN
    RAISE EXCEPTION 'Withdrawal limit exceeded: %', v_limit_result->>'reason';
  END IF;
  
  -- Log withdrawal request
  PERFORM public.log_security_event(
    'withdrawal_requested',
    NEW.user_id,
    json_build_object(
      'amount', NEW.amount,
      'method', NEW.withdrawal_method,
      'withdrawal_id', NEW.id
    )::jsonb,
    'info'
  );
  
  RETURN NEW;
END;
$function$;

-- Create trigger for withdrawal validation
DROP TRIGGER IF EXISTS validate_withdrawal_trigger ON public.withdrawals;
CREATE TRIGGER validate_withdrawal_trigger
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_withdrawal_request();

-- 8. Update game_matches RLS to hide seed data until completion
DROP POLICY IF EXISTS "Users can view their own matches with restricted sensitive data" ON public.game_matches;
CREATE POLICY "Users can view safe match data" 
ON public.game_matches 
FOR SELECT 
USING (
  (auth.uid() = maker_id OR auth.uid() = taker_id) AND
  (status = 'completed' OR (server_seed IS NULL AND salt IS NULL))
);