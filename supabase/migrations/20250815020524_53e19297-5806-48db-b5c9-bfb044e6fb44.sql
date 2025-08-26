-- Create coinflip provably fair generation function
CREATE OR REPLACE FUNCTION public.generate_coinflip_provably_fair(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_server_seed TEXT;
  v_server_seed_hash TEXT;
  v_client_seed TEXT;
  v_hmac_result TEXT;
  v_result TEXT;
  v_decimal_value BIGINT;
BEGIN
  -- Generate server seed (32 bytes = 64 hex chars)
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  
  -- Generate server seed hash
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');
  
  -- Generate client seed (32 bytes = 64 hex chars)
  v_client_seed := encode(gen_random_bytes(32), 'hex');
  
  -- Generate HMAC result
  v_hmac_result := encode(hmac(v_client_seed, v_server_seed, 'sha256'), 'hex');
  
  -- Determine result based on HMAC (use first 8 characters)
  v_decimal_value := ('x' || substring(v_hmac_result, 1, 8))::bit(32)::bigint;
  v_result := CASE WHEN v_decimal_value % 2 = 0 THEN 'heads' ELSE 'tails' END;
  
  -- Update the game with provably fair data and result
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
    'hmac_result', v_hmac_result,
    'result', v_result
  );
END;
$$;