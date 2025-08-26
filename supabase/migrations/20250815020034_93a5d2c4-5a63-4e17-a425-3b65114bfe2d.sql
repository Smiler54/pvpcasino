-- Fix critical security vulnerabilities in RLS policies

-- 1. Fix profiles table - users should only see their own profile
DROP POLICY IF EXISTS "Users can view their own complete profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins must use secure functions only" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;

CREATE POLICY "Users can view only their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- 2. Fix transactions table - users should only see their own transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;

CREATE POLICY "Users can view only their own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

-- 3. Fix withdrawals table - remove overly permissive policies
DROP POLICY IF EXISTS "Users can view their own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users and admins limited access to withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Admins can manage withdrawals" ON public.withdrawals;

-- Create proper restrictive policies for withdrawals
CREATE POLICY "Users can view only their own withdrawals"
ON public.withdrawals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own withdrawal requests"
ON public.withdrawals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their pending withdrawals"
ON public.withdrawals FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can manage all withdrawals"
ON public.withdrawals FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Ensure jackpot_tickets are properly secured
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.jackpot_tickets;
DROP POLICY IF EXISTS "Users can view own tickets only" ON public.jackpot_tickets;

CREATE POLICY "Users can view only their own jackpot tickets"
ON public.jackpot_tickets FOR SELECT
USING (auth.uid() = user_id);

-- 5. Add function for logging sensitive access
CREATE OR REPLACE FUNCTION log_sensitive_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if admin_audit_log table exists and user is authenticated
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_audit_log') 
     AND auth.uid() IS NOT NULL THEN
    INSERT INTO admin_audit_log (admin_user_id, action, details, ip_address)
    VALUES (
      auth.uid(),
      TG_OP || ' on ' || TG_TABLE_NAME,
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'user_affected', COALESCE(NEW.user_id, OLD.user_id),
        'timestamp', now()
      ),
      inet_client_addr()
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;