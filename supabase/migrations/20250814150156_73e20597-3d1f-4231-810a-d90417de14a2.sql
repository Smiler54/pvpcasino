-- Create secure function for bank withdrawal status check
CREATE OR REPLACE FUNCTION public.get_my_bank_status()
RETURNS TABLE(
  has_stripe_account boolean,
  balance numeric
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $function$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Return only bank status and balance for the authenticated user
  RETURN QUERY
  SELECT 
    (p.stripe_account_id IS NOT NULL) as has_stripe_account,
    p.balance
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
END;
$function$;