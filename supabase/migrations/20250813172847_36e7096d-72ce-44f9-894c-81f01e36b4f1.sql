-- Join the latest open offer to test the animation
DO $$
DECLARE
  v_offer_id UUID;
  v_maker_id UUID;
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
  v_win_amount NUMERIC;
  v_offer_amount NUMERIC;
  v_offer_side TEXT;
BEGIN
  -- Get the latest open offer
  SELECT id, user_id, amount, side INTO v_offer_id, v_maker_id, v_offer_amount, v_offer_side
  FROM game_offers 
  WHERE status = 'open' 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF v_offer_id IS NULL THEN
    RAISE NOTICE 'No open offers found to join';
    RETURN;
  END IF;
  
  v_win_amount := v_offer_amount * 2;
  
  -- Update offer to matched status
  UPDATE game_offers 
  SET status = 'matched' 
  WHERE id = v_offer_id;
  
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
    'AnimationTester',
    v_offer_amount,
    v_client_seed,
    'active'
  ) 
  RETURNING id INTO v_match_id;
  
  RAISE NOTICE '🎮 ANIMATION TEST STARTED!';
  RAISE NOTICE 'Match ID: %', v_match_id;
  RAISE NOTICE 'Your bet: % on %', v_offer_amount, v_offer_side;
  RAISE NOTICE 'Challenger bet: % on %', v_offer_amount, CASE WHEN v_offer_side = 'heads' THEN 'tails' ELSE 'heads' END;
  RAISE NOTICE 'Watch for the coin flip animation...';
  
  -- Wait 2 seconds to let the real-time system show "match started"
  PERFORM pg_sleep(2);
  
  -- Generate provably fair result
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_salt := encode(gen_random_bytes(16), 'hex');
  
  -- Simulate random result (0-255, <128 = heads, >=128 = tails)
  v_first_byte := floor(random() * 256);
  v_result_side := CASE WHEN v_first_byte < 128 THEN 'heads' ELSE 'tails' END;
  
  -- Determine winner
  v_maker_wins := (v_result_side = v_offer_side);
  
  IF v_maker_wins THEN
    v_winner_id := v_maker_id;
    v_winner_name := 'Ddenbror';
  ELSE
    v_winner_id := v_taker_id;
    v_winner_name := 'AnimationTester';
  END IF;
  
  -- Complete the match (this will trigger the animation!)
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
    'Won coinflip animation test: $' || v_win_amount || ' (result: ' || v_result_side || ')'
  );
  
  -- Log the final results
  RAISE NOTICE '🎲 COIN FLIP ANIMATION TEST COMPLETED!';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE 'Random byte: % (0-127=heads, 128-255=tails)', v_first_byte;
  RAISE NOTICE '🎯 RESULT: %', upper(v_result_side);
  RAISE NOTICE '🏆 WINNER: % (%)', v_winner_name, v_winner_id;
  RAISE NOTICE '💰 PRIZE: $%', v_win_amount;
  RAISE NOTICE '✨ Animation should have triggered on your screen!';
  RAISE NOTICE '════════════════════════════════════════';
  
END $$;