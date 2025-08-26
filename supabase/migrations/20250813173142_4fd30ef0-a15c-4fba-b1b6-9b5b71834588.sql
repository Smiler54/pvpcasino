-- Jackpot Test: Use existing users and give them balance for testing
-- First ensure users have enough balance

DO $$
DECLARE
  v_game_id UUID;
  v_user1_id UUID := '3d4ef21b-8e70-4d55-8798-cc0c71b902cc'; -- Ddenbror
  v_user2_id UUID := 'f2c3b499-c5b0-47ee-8023-e5fc5ec220c4'; -- Ddenbror97  
  v_user3_id UUID := '9324ba07-f457-44c8-9729-44346b9b2538'; -- Vitoria.gata
BEGIN
  -- Get the active jackpot game
  SELECT id INTO v_game_id FROM jackpot_games WHERE status = 'active' LIMIT 1;
  
  -- Give users enough balance for testing
  UPDATE profiles SET balance = balance + 50 WHERE user_id = v_user2_id; -- Ddenbror97 needs more
  UPDATE profiles SET balance = balance + 50 WHERE user_id = v_user3_id; -- Vitoria.gata needs more
  
  RAISE NOTICE '🎰 JACKPOT LOTTERY TEST STARTED!';
  RAISE NOTICE 'Game ID: %', v_game_id;
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '🎫 5 USERS BUYING DIFFERENT TICKET AMOUNTS';
  RAISE NOTICE '═══════════════════════════════════════';
  
  -- User 1: Ddenbror buys 5 tickets ($5) - moderate player
  PERFORM public.buy_jackpot_tickets(v_game_id, v_user1_id, 'Ddenbror', 5, 1.00);
  RAISE NOTICE '👤 Ddenbror bought 5 tickets ($5) - 25%% chance';
  
  -- User 2: Ddenbror97 buys 2 tickets ($2) - casual player
  PERFORM public.buy_jackpot_tickets(v_game_id, v_user2_id, 'Ddenbror97', 2, 1.00);
  RAISE NOTICE '👤 Ddenbror97 bought 2 tickets ($2) - 10%% chance';
  
  -- User 3: Vitoria.gata buys 8 tickets ($8) - high roller  
  PERFORM public.buy_jackpot_tickets(v_game_id, v_user3_id, 'Vitoria.gata', 8, 1.00);
  RAISE NOTICE '👤 Vitoria.gata bought 8 tickets ($8) - 40%% chance 🔥';
  
  -- User 1 again: Ddenbror buys 3 more tickets ($3) - total 8 tickets
  PERFORM public.buy_jackpot_tickets(v_game_id, v_user1_id, 'Ddenbror', 3, 1.00);
  RAISE NOTICE '👤 Ddenbror bought 3 MORE tickets ($3) - total 8 tickets';
  
  -- User 2 again: Ddenbror97 buys 2 more tickets ($2) - total 4 tickets
  PERFORM public.buy_jackpot_tickets(v_game_id, v_user2_id, 'Ddenbror97', 2, 1.00);
  RAISE NOTICE '👤 Ddenbror97 bought 2 MORE tickets ($2) - total 4 tickets';
  
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '📊 FINAL JACKPOT SUMMARY:';
  RAISE NOTICE 'Total Tickets: 20 (8+4+8)';
  RAISE NOTICE 'Total Pool: $20';
  RAISE NOTICE 'Active Players: 3';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 FINAL WINNING CHANCES:';
  RAISE NOTICE 'Ddenbror: 8/20 tickets = 40%% chance';
  RAISE NOTICE 'Ddenbror97: 4/20 tickets = 20%% chance';  
  RAISE NOTICE 'Vitoria.gata: 8/20 tickets = 40%% chance 🔥';
  RAISE NOTICE '';
  RAISE NOTICE '⏰ Timer should be running for automatic draw...';
  RAISE NOTICE '═══════════════════════════════════════';
  
END $$;