-- Test coinflip again - join the open offer
-- Current offer: Ddenbror betting $10 on heads

DO $$
DECLARE
  v_offer_id UUID := '3da11cbf-11b0-4602-ba5d-4845eb6edfa0';
  v_maker_id UUID := '3d4ef21b-8e70-4d55-8798-cc0c71b902cc';
  v_taker_id UUID := 'f2c3b499-c5b0-47ee-8023-e5fc5ec220c4';
  v_match_id UUID;
  v_server_seed TEXT;
  v_salt TEXT;
  v_client_seed TEXT := encode(gen_random_bytes(16), 'hex');
  v_first_byte INTEGER;
  v_result_side TEXT;
  v_maker_wins BOOLEAN;
  v_winner_id UUID;
  v_winner_name TEXT;
  v_win_amount NUMERIC := 20;
BEGIN
  -- Update offer to matched status
  UPDATE game_offers 
  SET status = 'matched' 
  WHERE id = v_offer_id AND status = 'open';
  
  -- Create the match
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
    v_offer_id,
    v_maker_id,
    v_taker_id,
    'Ddenbror',
    'TestChallenger',
    10,
    v_client_seed,
    'active'
  ) 
  RETURNING id INTO v_match_id;
  
  -- Generate provably fair result
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_salt := encode(gen_random_bytes(16), 'hex');
  
  -- Simulate random result (0-255, <128 = heads, >=128 = tails)
  v_first_byte := floor(random() * 256);
  v_result_side := CASE WHEN v_first_byte < 128 THEN 'heads' ELSE 'tails' END;
  
  -- Determine winner (maker chose heads)
  v_maker_wins := (v_result_side = 'heads');
  
  IF v_maker_wins THEN
    v_winner_id := v_maker_id;
    v_winner_name := 'Ddenbror';
  ELSE
    v_winner_id := v_taker_id;
    v_winner_name := 'TestChallenger';
  END IF;
  
  -- Complete the match
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
    'Won coinflip: $' || v_win_amount || ' (result: ' || v_result_side || ')'
  );
  
  -- Log the results
  RAISE NOTICE '🎯 COINFLIP TEST #2 COMPLETED!';
  RAISE NOTICE '═══════════════════════════════════';
  RAISE NOTICE 'Match ID: %', v_match_id;
  RAISE NOTICE 'Maker (Ddenbror) bet: HEADS';
  RAISE NOTICE 'Taker (TestChallenger) bet: TAILS'; 
  RAISE NOTICE 'Random byte: % (0-127=heads, 128-255=tails)', v_first_byte;
  RAISE NOTICE '🎲 RESULT: %', upper(v_result_side);
  RAISE NOTICE '🏆 WINNER: % (%)', v_winner_name, v_winner_id;
  RAISE NOTICE '💰 PRIZE: $%', v_win_amount;
  RAISE NOTICE '🔐 Client Seed: %', v_client_seed;
  RAISE NOTICE '🔐 Server Seed: %', v_server_seed;
  RAISE NOTICE '🔐 Salt: %', v_salt;
  RAISE NOTICE '═══════════════════════════════════';
  
END $$;