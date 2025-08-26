-- Phase 1: Critical Security Fixes

-- 1. Drop insecure public views and replace with secure functions
DROP VIEW IF EXISTS public.public_profiles;
DROP VIEW IF EXISTS public.public_profiles_secure;
DROP VIEW IF EXISTS public.jackpot_public_stats;

-- 2. Create secure replacement functions with proper access controls
CREATE OR REPLACE FUNCTION public.get_public_profile_by_username(p_username text)
RETURNS TABLE(user_id uuid, username text, level integer, experience integer, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Require authentication
  IF NOT public.is_authenticated_user() THEN
    RAISE EXCEPTION 'Authentication required to access profile data';
  END IF;
  
  -- Log the access
  PERFORM public.log_profile_access(
    (SELECT profiles.user_id FROM public.profiles WHERE profiles.username = p_username LIMIT 1), 
    'public_profile_by_username'
  );
  
  -- Return limited profile data
  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    p.level,
    p.experience,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.username = p_username
  LIMIT 1;
END;
$$;

-- 3. Create secure jackpot stats function (already exists but let's ensure it's properly configured)
-- The get_jackpot_stats_secure function already exists and is properly secured

-- 4. Add missing RLS policies for critical tables
-- Add policy to prevent direct access to user_roles for privilege escalation
CREATE POLICY "Only admins can assign admin roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (
  CASE WHEN role = 'admin' THEN 
    public.has_role(auth.uid(), 'admin'::app_role)
  ELSE 
    auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role)
  END
);

-- 5. Enhanced audit logging for admin actions
CREATE OR REPLACE FUNCTION public.log_admin_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log all admin role assignments with enhanced details
  IF NEW.role = 'admin' THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id,
      target_user_id,
      action,
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      NEW.user_id,
      'admin_role_granted',
      json_build_object(
        'role', NEW.role,
        'timestamp', NOW(),
        'granter_id', auth.uid(),
        'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
        'critical_action', true
      )
    );
    
    -- Also log to transactions for extra visibility
    INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (
      NEW.user_id, 
      'admin_privilege_grant', 
      0, 
      'CRITICAL: Admin role granted to user by ' || COALESCE(auth.uid()::text, 'system')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for admin privilege escalation logging
DROP TRIGGER IF EXISTS log_admin_privilege_escalation_trigger ON public.user_roles;
CREATE TRIGGER log_admin_privilege_escalation_trigger
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_admin_privilege_escalation();

-- 6. Create function to bootstrap first admin safely
CREATE OR REPLACE FUNCTION public.bootstrap_admin_from_email(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_admin_count INTEGER;
BEGIN
  -- Check if any admins exist
  SELECT COUNT(*) INTO v_admin_count 
  FROM public.user_roles 
  WHERE role = 'admin';
  
  -- Only allow if no admins exist
  IF v_admin_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin users already exist. Bootstrap not allowed.'
    );
  END IF;
  
  -- Find user by email from existing profiles
  SELECT p.user_id INTO v_user_id
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE u.email = p_email
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User with email not found in profiles'
    );
  END IF;
  
  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
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
      'email', p_email,
      'timestamp', NOW(),
      'method', 'bootstrap_function',
      'critical_action', true
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'First admin successfully bootstrapped',
    'user_id', v_user_id,
    'email', p_email
  );
END;
$$;

-- 7. Enhanced balance validation with fraud detection
CREATE OR REPLACE FUNCTION public.validate_balance_update_enhanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance_change NUMERIC;
  v_daily_changes NUMERIC;
BEGIN
  v_balance_change := NEW.balance - OLD.balance;
  
  -- Prevent negative balance (with minimal tolerance)
  IF NEW.balance < -0.01 THEN
    RAISE EXCEPTION 'Balance cannot be negative: %', NEW.balance;
  END IF;
  
  -- Prevent unreasonably high balances
  IF NEW.balance > 1000000 THEN
    RAISE EXCEPTION 'Balance exceeds maximum allowed: %', NEW.balance;
  END IF;
  
  -- Calculate daily balance changes
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_daily_changes
  FROM public.transactions
  WHERE user_id = NEW.user_id 
    AND created_at > CURRENT_DATE;
  
  -- Enhanced fraud detection
  IF ABS(v_balance_change) > 1000 OR (v_daily_changes > 5000 AND ABS(v_balance_change) > 100) THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id, 
      target_user_id, 
      action, 
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'), 
      NEW.user_id,
      'suspicious_balance_change',
      json_build_object(
        'old_balance', OLD.balance,
        'new_balance', NEW.balance,
        'difference', v_balance_change,
        'daily_total', v_daily_changes,
        'fraud_risk', CASE 
          WHEN ABS(v_balance_change) > 5000 THEN 'HIGH'
          WHEN ABS(v_balance_change) > 1000 THEN 'MEDIUM'
          ELSE 'LOW'
        END
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Replace the existing balance validation trigger
DROP TRIGGER IF EXISTS validate_balance_update_trigger ON public.profiles;
CREATE TRIGGER validate_balance_update_trigger
  BEFORE UPDATE OF balance ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_balance_update_enhanced();

-- 8. Create security monitoring function
CREATE OR REPLACE FUNCTION public.get_security_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_count INTEGER;
  v_recent_suspicious INTEGER;
  v_result JSON;
BEGIN
  -- Require admin access
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Get admin count
  SELECT COUNT(*) INTO v_admin_count
  FROM public.user_roles
  WHERE role = 'admin';
  
  -- Get recent suspicious activities
  SELECT COUNT(*) INTO v_recent_suspicious
  FROM public.admin_audit_log
  WHERE action LIKE '%suspicious%'
    AND created_at > NOW() - INTERVAL '24 hours';
  
  v_result := json_build_object(
    'admin_count', v_admin_count,
    'recent_suspicious_activities', v_recent_suspicious,
    'security_status', CASE 
      WHEN v_admin_count = 0 THEN 'CRITICAL - No Admins'
      WHEN v_recent_suspicious > 10 THEN 'HIGH RISK'
      WHEN v_recent_suspicious > 5 THEN 'MEDIUM RISK'
      ELSE 'NORMAL'
    END,
    'last_check', NOW()
  );
  
  RETURN v_result;
END;
$$;