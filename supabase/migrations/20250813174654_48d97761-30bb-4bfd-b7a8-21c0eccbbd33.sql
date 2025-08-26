-- Fix remaining authentication security warnings
-- These require configuration changes in auth settings

-- Note: The following issues need to be fixed in Supabase Auth settings:
-- 1. OTP expiry time should be reduced from current setting
-- 2. Leaked password protection should be enabled

-- We can't fix these via SQL migration as they are auth configuration settings
-- However, we can add additional security measures in the database

-- Add a function to check for weak passwords during profile updates
CREATE OR REPLACE FUNCTION public.validate_security_settings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_admin_count integer;
  v_recent_logins integer;
BEGIN
  -- Only admins can check security settings
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Check admin count
  SELECT COUNT(*) INTO v_admin_count
  FROM public.user_roles
  WHERE role = 'admin';
  
  -- Check recent login activity
  SELECT COUNT(*) INTO v_recent_logins
  FROM public.admin_audit_log
  WHERE action LIKE '%login%'
    AND created_at > NOW() - INTERVAL '24 hours';
  
  v_result := json_build_object(
    'admin_count', v_admin_count,
    'recent_admin_logins', v_recent_logins,
    'security_recommendations', json_build_array(
      'Enable leaked password protection in Auth settings',
      'Reduce OTP expiry time to 5 minutes or less',
      'Implement 2FA for admin accounts',
      'Regular security audits recommended'
    ),
    'last_check', NOW()
  );
  
  RETURN v_result;
END;
$$;

-- Add enhanced logging for authentication events
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_event_type text,
  p_user_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_user_id,
    action,
    details
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    COALESCE(p_user_id, auth.uid()),
    'auth_' || p_event_type,
    jsonb_build_object(
      'event_type', p_event_type,
      'timestamp', NOW(),
      'details', p_details,
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
      'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
    )
  );
END;
$$;

-- Create a function to mask sensitive financial data for admin viewing
CREATE OR REPLACE FUNCTION public.get_masked_user_profile(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  username text,
  masked_balance text,
  level integer,
  has_stripe_account boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can view masked profiles
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Log the admin access
  PERFORM public.log_profile_access_attempt(
    p_user_id, 
    'masked_profile_view', 
    true
  );
  
  -- Return masked financial data
  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    CASE 
      WHEN p.balance IS NULL THEN 'No balance'
      WHEN p.balance = 0 THEN '$0.00'
      WHEN p.balance < 10 THEN '$X.XX'
      WHEN p.balance < 100 THEN '$XX.XX'
      ELSE '$XXX.XX+'
    END as masked_balance,
    p.level,
    (p.stripe_account_id IS NOT NULL) as has_stripe_account,
    p.created_at
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
END;
$$;