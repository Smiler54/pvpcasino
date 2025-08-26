-- Add provably fair fields to coinflip_games table
ALTER TABLE public.coinflip_games 
ADD COLUMN IF NOT EXISTS server_seed TEXT,
ADD COLUMN IF NOT EXISTS server_seed_hash TEXT,
ADD COLUMN IF NOT EXISTS client_seed TEXT,
ADD COLUMN IF NOT EXISTS hmac_result TEXT;

-- Add provably fair fields to jackpot_games table
ALTER TABLE public.jackpot_games 
ADD COLUMN IF NOT EXISTS server_seed TEXT,
ADD COLUMN IF NOT EXISTS server_seed_hash TEXT,
ADD COLUMN IF NOT EXISTS client_seed TEXT,
ADD COLUMN IF NOT EXISTS hmac_result TEXT;

-- Create a function to generate provably fair data for coinflip
CREATE OR REPLACE FUNCTION public.generate_coinflip_provably_fair(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_server_seed TEXT;
  v_server_seed_hash TEXT;
  v_client_seed TEXT;
  v_hmac_result TEXT;
  v_result TEXT;
BEGIN
  -- Generate server seed (32 bytes = 64 hex chars)
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  
  -- Generate server seed hash
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');
  
  -- Generate client seed (32 bytes = 64 hex chars)
  v_client_seed := encode(gen_random_bytes(32), 'hex');
  
  -- Generate HMAC result
  v_hmac_result := encode(hmac(v_client_seed, v_server_seed, 'sha256'), 'hex');
  
  -- Determine result from first 8 characters of HMAC
  IF (('x' || substring(v_hmac_result, 1, 8))::bit(32)::int % 2) = 0 THEN
    v_result := 'heads';
  ELSE
    v_result := 'tails';
  END IF;
  
  -- Update the game with provably fair data
  UPDATE public.coinflip_games
  SET 
    server_seed = v_server_seed,
    server_seed_hash = v_server_seed_hash,
    client_seed = v_client_seed,
    hmac_result = v_hmac_result,
    result = v_result
  WHERE id = p_game_id;
  
  RETURN json_build_object(
    'server_seed_hash', v_server_seed_hash,
    'client_seed', v_client_seed,
    'result', v_result
  );
END;
$function$;

-- Create a function to generate provably fair data for jackpot
CREATE OR REPLACE FUNCTION public.generate_jackpot_provably_fair(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_server_seed TEXT;
  v_server_seed_hash TEXT;
  v_client_seed TEXT;
  v_hmac_result TEXT;
BEGIN
  -- Generate server seed (32 bytes = 64 hex chars)
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  
  -- Generate server seed hash
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');
  
  -- Generate client seed (32 bytes = 64 hex chars)
  v_client_seed := encode(gen_random_bytes(32), 'hex');
  
  -- Generate HMAC result
  v_hmac_result := encode(hmac(v_client_seed, v_server_seed, 'sha256'), 'hex');
  
  -- Update the game with provably fair data
  UPDATE public.jackpot_games
  SET 
    server_seed = v_server_seed,
    server_seed_hash = v_server_seed_hash,
    client_seed = v_client_seed,
    hmac_result = v_hmac_result
  WHERE id = p_game_id;
  
  RETURN json_build_object(
    'server_seed_hash', v_server_seed_hash,
    'client_seed', v_client_seed,
    'hmac_result', v_hmac_result
  );
END;
$function$;

-- Create a function to get public provably fair data for completed games
CREATE OR REPLACE FUNCTION public.get_game_provably_fair_data(p_game_id uuid, p_game_type text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
BEGIN
  IF p_game_type = 'coinflip' THEN
    SELECT json_build_object(
      'game_id', id,
      'server_seed_hash', server_seed_hash,
      'server_seed', CASE WHEN status = 'completed' THEN server_seed ELSE NULL END,
      'client_seed', client_seed,
      'hmac_result', CASE WHEN status = 'completed' THEN hmac_result ELSE NULL END,
      'result', result,
      'status', status,
      'completed_at', completed_at
    ) INTO v_result
    FROM public.coinflip_games
    WHERE id = p_game_id;
  ELSIF p_game_type = 'jackpot' THEN
    SELECT json_build_object(
      'game_id', id,
      'server_seed_hash', server_seed_hash,
      'server_seed', CASE WHEN status = 'completed' THEN server_seed ELSE NULL END,
      'client_seed', client_seed,
      'hmac_result', CASE WHEN status = 'completed' THEN hmac_result ELSE NULL END,
      'winner_name', winner_name,
      'status', status,
      'completed_at', completed_at
    ) INTO v_result
    FROM public.jackpot_games
    WHERE id = p_game_id;
  END IF;
  
  RETURN v_result;
END;
$function$;