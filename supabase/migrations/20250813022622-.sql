-- Fix function search path security issue by explicitly setting search_path
-- Update existing functions that don't have SET search_path

-- Update the check_withdrawal_rate_limit function
CREATE OR REPLACE FUNCTION public.check_withdrawal_rate_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Update the has_role function to fix search path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;