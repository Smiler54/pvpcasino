-- CRITICAL SECURITY FIX: Restrict access to gambling seeds

-- 1. Remove the insecure public policy that exposes seeds
DROP POLICY IF EXISTS "Public can view completed matches safely" ON public.game_matches;

-- 2. Create a restrictive policy that only allows participants to see their own matches with full details
CREATE POLICY "Participants can view their own complete matches" 
ON public.game_matches 
FOR SELECT 
USING (auth.uid() = maker_id OR auth.uid() = taker_id);

-- 3. Update the public function to only return safe, non-sensitive data
CREATE OR REPLACE FUNCTION public.get_public_recent_matches(p_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  maker_name text,
  taker_name text,
  amount numeric,
  result_side text,
  winner_name text,
  completed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Only return non-sensitive public data, NO SEEDS/SALT
  RETURN QUERY
  SELECT 
    gm.id,
    gm.maker_name,
    gm.taker_name,
    gm.amount,
    gm.result_side,
    CASE 
      WHEN gm.winner_id IS NOT NULL THEN (
        CASE 
          WHEN EXISTS (SELECT 1 FROM public.profiles WHERE user_id = gm.winner_id AND username = gm.maker_name) 
          THEN gm.maker_name
          ELSE gm.taker_name
        END
      )
      ELSE NULL
    END as winner_name,
    gm.completed_at
  FROM public.game_matches gm
  WHERE gm.status = 'completed'
    AND gm.result_side IS NOT NULL
    AND gm.completed_at IS NOT NULL
  ORDER BY gm.completed_at DESC
  LIMIT p_limit;
END;
$function$;

-- 4. Create a secure function for participants to access their own match verification data
CREATE OR REPLACE FUNCTION public.get_my_match_verification(p_match_id uuid)
RETURNS TABLE(
  id uuid,
  client_seed text,
  server_seed text,
  salt text,
  result_side text,
  amount numeric,
  completed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Only return verification data to match participants
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  RETURN QUERY
  SELECT 
    gm.id,
    gm.client_seed,
    gm.server_seed,
    gm.salt,
    gm.result_side,
    gm.amount,
    gm.completed_at
  FROM public.game_matches gm
  WHERE gm.id = p_match_id
    AND (gm.maker_id = auth.uid() OR gm.taker_id = auth.uid())
    AND gm.status = 'completed'
    AND gm.server_seed IS NOT NULL
    AND gm.salt IS NOT NULL;
END;
$function$;

-- 5. Log this critical security fix
INSERT INTO public.admin_audit_log (
  admin_user_id,
  target_user_id,
  action,
  details
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'critical_security_fix',
  json_build_object(
    'issue', 'gambling_seeds_exposed_publicly',
    'severity', 'CRITICAL',
    'fix_applied', 'restricted_match_access_to_participants_only',
    'timestamp', NOW()
  )
);