-- Fix security warnings by updating functions with proper search_path
DROP FUNCTION IF EXISTS generate_coinflip_provably_fair(UUID);
DROP FUNCTION IF EXISTS cleanup_stale_coinflip_games();

-- Recreate the coinflip provably fair function with proper search_path
CREATE OR REPLACE FUNCTION generate_coinflip_provably_fair(p_game_id UUID)
RETURNS JSON AS $$
DECLARE
    v_server_seed TEXT;
    v_client_seed TEXT;
    v_server_seed_hash TEXT;
    v_hmac_result TEXT;
    v_result TEXT;
    v_decimal_value BIGINT;
BEGIN
    -- Generate server seed (64 random hex characters)
    v_server_seed := encode(gen_random_bytes(32), 'hex');
    
    -- Generate client seed (64 random hex characters)  
    v_client_seed := encode(gen_random_bytes(32), 'hex');
    
    -- Create server seed hash
    v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');
    
    -- Generate HMAC result
    v_hmac_result := encode(hmac(v_client_seed, v_server_seed, 'sha256'), 'hex');
    
    -- Use first 8 characters of HMAC to determine result
    v_decimal_value := ('x' || substring(v_hmac_result, 1, 8))::bit(32)::bigint;
    
    -- Determine result based on even/odd
    IF v_decimal_value % 2 = 0 THEN
        v_result := 'heads';
    ELSE
        v_result := 'tails';
    END IF;
    
    -- Update the game with provably fair data and result
    UPDATE coinflip_games 
    SET 
        server_seed = v_server_seed,
        server_seed_hash = v_server_seed_hash,
        client_seed = v_client_seed,
        hmac_result = v_hmac_result,
        result = v_result,
        updated_at = now()
    WHERE id = p_game_id;
    
    -- Return the result
    RETURN json_build_object(
        'result', v_result,
        'server_seed_hash', v_server_seed_hash,
        'client_seed', v_client_seed,
        'hmac_result', v_hmac_result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Recreate the cleanup function with proper search_path
CREATE OR REPLACE FUNCTION cleanup_stale_coinflip_games()
RETURNS void AS $$
BEGIN
    -- Cancel games that have been waiting for more than 10 minutes
    UPDATE coinflip_games 
    SET status = 'cancelled', updated_at = now()
    WHERE status = 'waiting' 
    AND created_at < now() - interval '10 minutes';
    
    -- Cancel games that have been flipping for more than 1 minute (stuck)
    UPDATE coinflip_games 
    SET status = 'cancelled', updated_at = now()
    WHERE status = 'flipping' 
    AND updated_at < now() - interval '1 minute';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';