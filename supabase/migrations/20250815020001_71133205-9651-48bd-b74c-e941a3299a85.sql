-- Fix critical security vulnerabilities in RLS policies

-- 1. Fix profiles table - users should only see their own profile
DROP POLICY IF EXISTS "Users can view their own complete profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins must use secure functions only" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;

CREATE POLICY "Users can view only their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- 2. Fix transactions table - users should only see their own transactions
-- Current policy is correct but let's ensure it's robust
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

-- 4. Add additional security for sensitive game data
-- Ensure jackpot_tickets are properly secured
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.jackpot_tickets;
DROP POLICY IF EXISTS "Users can view own tickets only" ON public.jackpot_tickets;

CREATE POLICY "Users can view only their own jackpot tickets"
ON public.jackpot_tickets FOR SELECT
USING (auth.uid() = user_id);

-- 5. Add audit logging for sensitive operations
CREATE OR REPLACE FUNCTION log_sensitive_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access to sensitive financial data
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
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers for audit logging on sensitive tables
DROP TRIGGER IF EXISTS audit_profiles_access ON public.profiles;
CREATE TRIGGER audit_profiles_access
  AFTER SELECT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_access();

DROP TRIGGER IF EXISTS audit_transactions_access ON public.transactions;  
CREATE TRIGGER audit_transactions_access
  AFTER SELECT OR INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_access();

DROP TRIGGER IF EXISTS audit_withdrawals_access ON public.withdrawals;
CREATE TRIGGER audit_withdrawals_access
  AFTER SELECT OR INSERT OR UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_access();