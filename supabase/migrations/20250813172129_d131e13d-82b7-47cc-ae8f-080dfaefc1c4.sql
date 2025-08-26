-- Simulate a complete coinflip game test
-- Join the existing offer and create a match

-- Update the existing offer to matched status
UPDATE game_offers 
SET status = 'matched' 
WHERE id = 'de26ed11-6ae1-4b88-a20c-4c1dc29d5ef1' AND status = 'open';

-- Create a match for the joined offer
INSERT INTO game_matches (
  offer_id, 
  maker_id, 
  taker_id, 
  maker_name, 
  taker_name, 
  amount, 
  client_seed, 
  status
) 
VALUES (
  'de26ed11-6ae1-4b88-a20c-4c1dc29d5ef1',
  '3d4ef21b-8e70-4d55-8798-cc0c71b902cc',
  'f2c3b499-c5b0-47ee-8023-e5fc5ec220c4',
  'Ddenbror',
  'TestTaker',
  10,
  'abc123def456789',
  'active'
);

-- Now simulate completing the match with provably fair results
DO $$
DECLARE
  v_match_id UUID;
  v_server_seed TEXT;
  v_salt TEXT;
  v_combined_seed TEXT;
  v_hash_hex TEXT;
  v_first_byte INTEGER;
  v_result_side TEXT;
  v_maker_wins BOOLEAN;
  v_winner_id UUID;
  v_winner_name TEXT;
  v_win_amount NUMERIC;
BEGIN
  -- Get the match we just created
  SELECT id INTO v_match_id 
  FROM game_matches 
  WHERE offer_id = 'de26ed11-6ae1-4b88-a20c-4c1dc29d5ef1' 
  AND status = 'active';
  
  -- Generate provably fair result
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_salt := encode(gen_random_bytes(16), 'hex');
  
  -- Simulate hash calculation (using simple random for demo)
  v_first_byte := floor(random() * 256);
  v_result_side := CASE WHEN v_first_byte < 128 THEN 'heads' ELSE 'tails' END;
  
  -- Determine winner (maker chose heads, so they win if result is heads)
  v_maker_wins := (v_result_side = 'heads');
  
  IF v_maker_wins THEN
    v_winner_id := '3d4ef21b-8e70-4d55-8798-cc0c71b902cc';
    v_winner_name := 'Ddenbror';
  ELSE
    v_winner_id := 'f2c3b499-c5b0-47ee-8023-e5fc5ec220c4';
    v_winner_name := 'TestTaker';
  END IF;
  
  v_win_amount := 20; -- 2x the $10 bet
  
  -- Update match with results
  UPDATE game_matches
  SET 
    server_seed = v_server_seed,
    salt = v_salt,
    result_side = v_result_side,
    winner_id = v_winner_id,
    status = 'completed',
    completed_at = NOW()
  WHERE id = v_match_id;
  
  -- Update winner's balance
  PERFORM public.update_user_balance(
    v_winner_id,
    v_win_amount,
    'coinflip_win',
    'Won coinflip vs ' || CASE WHEN v_maker_wins THEN 'TestTaker' ELSE 'Ddenbror' END || ': $' || v_win_amount
  );
  
  -- Log the test result
  RAISE NOTICE 'COINFLIP TEST COMPLETED:';
  RAISE NOTICE 'Match ID: %', v_match_id;
  RAISE NOTICE 'Result: %', v_result_side;
  RAISE NOTICE 'Winner: % (%)', v_winner_name, v_winner_id;
  RAISE NOTICE 'Prize: $%', v_win_amount;
  RAISE NOTICE 'Server Seed: %', v_server_seed;
  RAISE NOTICE 'Salt: %', v_salt;
  
END $$;