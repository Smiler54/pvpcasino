-- CRITICAL SECURITY FIXES - Phase 1: Gambling Data Privacy
-- Drop overly permissive policies that expose sensitive gambling data

-- Remove dangerous policy that allows anyone to view all tickets
DROP POLICY IF EXISTS "Anyone can view jackpot tickets" ON public.jackpot_tickets;

-- Remove policy that exposes all game data to anonymous users  
DROP POLICY IF EXISTS "Anyone can view jackpot games" ON public.jackpot_games;

-- Create secure policies for jackpot_tickets
-- Users can only view their own tickets
CREATE POLICY "Users can view their own tickets" 
ON public.jackpot_tickets 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admins can view all tickets for management
CREATE POLICY "Admins can view all tickets" 
ON public.jackpot_tickets 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Create secure policies for jackpot_games
-- Authenticated users can view basic game info (active games only)
CREATE POLICY "Users can view active games" 
ON public.jackpot_games 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND status = 'active');

-- Create a safe public view for game information (anonymized)
CREATE VIEW public.jackpot_public_stats AS
SELECT 
  id,
  ticket_price,
  total_pool,
  status,
  timer_end_at,
  created_at,
  -- Hide sensitive winner information from public view
  CASE WHEN status = 'completed' THEN 'Game Completed' ELSE NULL END as game_status
FROM public.jackpot_games
WHERE status IN ('active', 'completed');

-- Grant access to the public view
GRANT SELECT ON public.jackpot_public_stats TO authenticated, anon;

-- PHASE 2: Authentication & Admin Security
-- Create secure admin bootstrap function with enhanced logging
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(p_user_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_admin_count INTEGER;
  v_result JSON;
BEGIN
  -- Check if any admins exist
  SELECT COUNT(*) INTO v_admin_count 
  FROM public.user_roles 
  WHERE role = 'admin';
  
  -- Only allow bootstrap if no admins exist
  IF v_admin_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin users already exist. Bootstrap not allowed.'
    );
  END IF;
  
  -- Find user by email in auth.users (using service role access)
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = p_user_email 
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User with email not found'
    );
  END IF;
  
  -- Create profile if it doesn't exist
  INSERT INTO public.profiles (user_id, username, balance)
  VALUES (v_user_id, 'admin_' || SUBSTR(v_user_id::text, 1, 8), 0.00)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Assign default user role as well
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Log the bootstrap action
  INSERT INTO public.admin_audit_log (
    admin_user_id, 
    target_user_id, 
    action, 
    details
  ) VALUES (
    v_user_id,
    v_user_id,
    'admin_bootstrap',
    json_build_object(
      'email', p_user_email,
      'timestamp', NOW(),
      'method', 'bootstrap_function'
    )
  );
  
  -- Log critical system event
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (
    v_user_id, 
    'admin_bootstrap', 
    0, 
    'CRITICAL: First admin user bootstrapped for ' || p_user_email
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'First admin successfully bootstrapped',
    'user_id', v_user_id,
    'email', p_user_email
  );
END;
$$;

-- Enhanced withdrawal security - Add daily withdrawal tracking
CREATE OR REPLACE FUNCTION public.check_enhanced_withdrawal_limits(p_user_id uuid, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_hourly_count INTEGER;
  v_daily_amount NUMERIC;
  v_weekly_count INTEGER;
  v_monthly_amount NUMERIC;
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

  -- Check daily withdrawal amount (reduced to $500 per day for security)
  SELECT COALESCE(SUM(amount), 0) INTO v_daily_amount
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > CURRENT_DATE
    AND status != 'cancelled';
    
  IF v_daily_amount + p_amount > 500 THEN
    RETURN json_build_object(
      'allowed', false, 
      'reason', 'Daily withdrawal limit of $500 exceeded'
    );
  END IF;

  -- Check weekly withdrawal count (max 5 per week)
  SELECT COUNT(*) INTO v_weekly_count
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > NOW() - INTERVAL '7 days'
    AND status != 'cancelled';
    
  IF v_weekly_count >= 5 THEN
    RETURN json_build_object(
      'allowed', false, 
      'reason', 'Weekly withdrawal limit of 5 transactions exceeded'
    );
  END IF;

  -- Check monthly withdrawal amount (max $2000 per month)
  SELECT COALESCE(SUM(amount), 0) INTO v_monthly_amount
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > NOW() - INTERVAL '30 days'
    AND status != 'cancelled';
    
  IF v_monthly_amount + p_amount > 2000 THEN
    RETURN json_build_object(
      'allowed', false, 
      'reason', 'Monthly withdrawal limit of $2000 exceeded'
    );
  END IF;

  RETURN json_build_object('allowed', true);
END;
$$;

-- Create function to get user's own jackpot tickets (secure replacement)
CREATE OR REPLACE FUNCTION public.get_user_jackpot_tickets_secure(p_game_id uuid)
RETURNS TABLE(tickets_bought integer, amount_paid numeric, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- User can only see their own tickets
  RETURN QUERY
  SELECT 
    jt.tickets_bought,
    jt.amount_paid,
    jt.created_at
  FROM public.jackpot_tickets jt
  WHERE jt.game_id = p_game_id 
  AND jt.user_id = auth.uid();
END;
$$;

-- Add trigger to log all sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log access to financial data
  IF TG_TABLE_NAME IN ('transactions', 'withdrawals', 'jackpot_tickets') THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id,
      target_user_id,
      action,
      details
    ) VALUES (
      auth.uid(),
      COALESCE(NEW.user_id, OLD.user_id),
      'sensitive_data_access',
      json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', NOW(),
        'ip_address', inet_client_addr()
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply the logging trigger to sensitive tables
CREATE TRIGGER log_transactions_access
  AFTER SELECT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_data_access();

CREATE TRIGGER log_withdrawals_access
  AFTER SELECT ON public.withdrawals  
  FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_data_access();

CREATE TRIGGER log_jackpot_tickets_access
  AFTER SELECT ON public.jackpot_tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_data_access();