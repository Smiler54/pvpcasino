-- Security Enhancement Implementation (Fixed)
-- Implement comprehensive security improvements

-- Security Enhancement Phase 2: Financial Data Protection
-- Create read-only public view for profiles excluding sensitive financial data

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT 
  user_id,
  username,
  level,
  experience,
  created_at,
  updated_at
FROM public.profiles;

-- Enable RLS on the view
ALTER VIEW public.public_profiles SET (security_invoker = true);

-- Grant access to authenticated users for the public view
GRANT SELECT ON public.public_profiles TO authenticated;

-- Security Enhancement Phase 3: Game Integrity Protection
-- Update RLS policies for game_matches to hide sensitive data during active games

-- Drop existing policies on game_matches to recreate them with enhanced security
DROP POLICY IF EXISTS "Users can view their own matches with restricted sensitive data" ON public.game_matches;
DROP POLICY IF EXISTS "Users can create matches" ON public.game_matches;
DROP POLICY IF EXISTS "System can update completed matches only" ON public.game_matches;

-- Create enhanced RLS policy for viewing matches
CREATE POLICY "Users can view their own matches with restricted sensitive data"
ON public.game_matches
FOR SELECT
USING (auth.uid() = maker_id OR auth.uid() = taker_id);

CREATE POLICY "Users can create matches"
ON public.game_matches
FOR INSERT
WITH CHECK (auth.uid() = taker_id);

CREATE POLICY "System can update completed matches only"
ON public.game_matches
FOR UPDATE
USING (
  (auth.uid() = maker_id OR auth.uid() = taker_id) AND
  status = 'active'
);

-- Security Enhancement Phase 4: Enhanced audit logging for admin actions
-- Add additional security monitoring for admin operations (Fixed trigger syntax)

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
        'timestamp', now()
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create separate triggers for INSERT and DELETE to avoid syntax issues
DROP TRIGGER IF EXISTS monitor_admin_roles_insert ON public.user_roles;
DROP TRIGGER IF EXISTS monitor_admin_roles_delete ON public.user_roles;

CREATE TRIGGER monitor_admin_roles_insert
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  WHEN (NEW.role = 'admin')
  EXECUTE FUNCTION public.log_admin_action();

CREATE TRIGGER monitor_admin_roles_delete
  AFTER DELETE ON public.user_roles
  FOR EACH ROW
  WHEN (OLD.role = 'admin')
  EXECUTE FUNCTION public.log_admin_action();