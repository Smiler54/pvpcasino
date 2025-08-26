-- Fix critical security issues with financial data exposure
-- Remove duplicate RLS policies and strengthen data protection

-- 1. Clean up duplicate SELECT policies on profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
-- Keep only the more descriptive policy name

-- 2. Add admin-only access policy for profiles (for legitimate admin functions)
CREATE POLICY "Admins can view all profiles for management" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  (has_role(auth.uid(), 'admin'::app_role))
);

-- 3. Update the public profile functions to be more restrictive
-- Drop the existing potentially unsafe functions
DROP FUNCTION IF EXISTS public.get_public_profile_secure(uuid);
DROP FUNCTION IF EXISTS public.get_public_profile_by_username(text);

-- 4. Create a safer public profile function that only returns non-sensitive data
CREATE OR REPLACE FUNCTION public.get_safe_public_profile(p_user_id uuid)
RETURNS TABLE(
  user_id uuid, 
  username text, 
  level integer, 
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Require authentication
  IF NOT public.is_authenticated_user() THEN
    RAISE EXCEPTION 'Authentication required to access profile data';
  END IF;
  
  -- Only return non-sensitive public profile data
  -- Explicitly exclude balance, stripe_account_id, experience, and other sensitive fields
  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    p.level,
    p.created_at
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
END;
$$;

-- 5. Create a function for users to get their own complete profile safely
CREATE OR REPLACE FUNCTION public.get_my_complete_profile()
RETURNS TABLE(
  user_id uuid,
  username text,
  balance numeric,
  level integer,
  experience integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Return complete profile data only for the authenticated user
  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    p.balance,
    p.level,
    p.experience,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
END;
$$;

-- 6. Strengthen transaction access - ensure no cross-user access
-- Add additional validation to transaction viewing
CREATE OR REPLACE FUNCTION public.get_my_transactions(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  type text,
  amount numeric,
  description text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate parameters
  IF p_limit > 100 THEN
    p_limit := 100; -- Max 100 records at a time
  END IF;
  
  -- Return only the user's own transactions, excluding sensitive stripe data
  RETURN QUERY
  SELECT 
    t.id,
    t.type,
    t.amount,
    t.description,
    t.created_at
  FROM public.transactions t
  WHERE t.user_id = auth.uid()
  ORDER BY t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 7. Create a secure withdrawal access function
CREATE OR REPLACE FUNCTION public.get_my_withdrawals()
RETURNS TABLE(
  id uuid,
  amount numeric,
  withdrawal_method text,
  status text,
  requested_at timestamp with time zone,
  processed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Return only the user's own withdrawals, excluding sensitive details
  RETURN QUERY
  SELECT 
    w.id,
    w.amount,
    w.withdrawal_method,
    w.status,
    w.requested_at,
    w.processed_at
  FROM public.withdrawals w
  WHERE w.user_id = auth.uid()
  ORDER BY w.requested_at DESC;
END;
$$;

-- 8. Add additional security logging for profile access attempts
CREATE OR REPLACE FUNCTION public.log_profile_access_attempt(
  p_target_user_id uuid, 
  p_access_type text,
  p_success boolean DEFAULT true
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
    p_target_user_id,
    CASE WHEN p_success THEN 'profile_access_success' ELSE 'profile_access_denied' END,
    json_build_object(
      'access_type', p_access_type,
      'timestamp', NOW(),
      'success', p_success,
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    )
  );
END;
$$;

-- 9. Create a strict policy for admin audit log access
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;

CREATE POLICY "Only super admins can view audit logs" 
ON public.admin_audit_log 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  -- Additional check: only allow if accessing within reasonable time frame
  created_at > NOW() - INTERVAL '90 days'
);

-- 10. Add a function to validate financial data access
CREATE OR REPLACE FUNCTION public.validate_financial_access(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_authorized boolean := false;
BEGIN
  -- Only allow access to own data or if admin
  IF auth.uid() = p_user_id OR has_role(auth.uid(), 'admin'::app_role) THEN
    v_is_authorized := true;
  END IF;
  
  -- Log the access attempt
  PERFORM public.log_profile_access_attempt(
    p_user_id, 
    'financial_data_access', 
    v_is_authorized
  );
  
  RETURN v_is_authorized;
END;
$$;