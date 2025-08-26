-- Security Enhancement Implementation - Fixed Version
-- Complete security fixes with proper trigger conditions

-- Security Enhancement Phase 2: Financial Data Protection
-- Recreate view with proper permissions (already handled above)

-- Security Enhancement Phase 3: Game Integrity Protection  
-- Enhanced RLS policies are already in place

-- Security Enhancement Phase 4: Enhanced audit logging for admin actions
-- Fixed trigger implementation

CREATE OR REPLACE FUNCTION public.log_admin_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log admin role assignments (INSERT)
  IF TG_OP = 'INSERT' AND NEW.role = 'admin' THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id,
      target_user_id,
      action,
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      NEW.user_id,
      'admin_role_assigned',
      json_build_object(
        'role', NEW.role,
        'timestamp', NEW.created_at
      )
    );
  END IF;

  -- Log admin role removals (DELETE)
  IF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id,
      target_user_id,
      action,
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      OLD.user_id,
      'admin_role_removed',
      json_build_object(
        'role', OLD.role,
        'timestamp', NOW()
      )
    );
  END IF;

  -- Log admin role changes (UPDATE)
  IF TG_OP = 'UPDATE' AND (OLD.role = 'admin' OR NEW.role = 'admin') THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id,
      target_user_id,
      action,
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      NEW.user_id,
      'admin_role_changed',
      json_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'timestamp', NOW()
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create separate triggers for each operation to avoid NEW/OLD reference issues
DROP TRIGGER IF EXISTS monitor_admin_roles_insert ON public.user_roles;
CREATE TRIGGER monitor_admin_roles_insert
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  WHEN (NEW.role = 'admin')
  EXECUTE FUNCTION public.log_admin_action();

DROP TRIGGER IF EXISTS monitor_admin_roles_delete ON public.user_roles;
CREATE TRIGGER monitor_admin_roles_delete
  AFTER DELETE ON public.user_roles
  FOR EACH ROW
  WHEN (OLD.role = 'admin')
  EXECUTE FUNCTION public.log_admin_action();

DROP TRIGGER IF EXISTS monitor_admin_roles_update ON public.user_roles;
CREATE TRIGGER monitor_admin_roles_update
  AFTER UPDATE ON public.user_roles
  FOR EACH ROW
  WHEN (OLD.role = 'admin' OR NEW.role = 'admin')
  EXECUTE FUNCTION public.log_admin_action();

-- Security Enhancement: Create additional constraints for financial safety
-- Add check constraints to prevent extreme values

ALTER TABLE public.profiles 
ADD CONSTRAINT balance_reasonable_range 
CHECK (balance >= -1.00 AND balance <= 100000.00);

ALTER TABLE public.transactions 
ADD CONSTRAINT transaction_reasonable_range 
CHECK (amount >= -10000.00 AND amount <= 10000.00);

-- Create index for better performance on security queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user 
ON public.admin_audit_log(target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date 
ON public.transactions(user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status_date 
ON public.withdrawals(user_id, status, requested_at DESC);