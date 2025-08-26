-- Fix linter warning: ensure trigger function has immutable search_path
CREATE OR REPLACE FUNCTION public.update_withdrawal_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;