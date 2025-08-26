-- Jackpot Test: 5 Users Buying Different Ticket Amounts
-- First, ensure we have an active jackpot game

DO $$
DECLARE
  v_game_id UUID;
  v_user1_id UUID := '3d4ef21b-8e70-4d55-8798-cc0c71b902cc'; -- Ddenbror
  v_user2_id UUID := 'f2c3b499-c5b0-47ee-8023-e5fc5ec220c4'; -- Ddenbror97  
  v_user3_id UUID := '9324ba07-f457-44c8-9729-44346b9b2538'; -- Vitoria.gata
  v_user4_id UUID := gen_random_uuid(); -- TestUser1
  v_user5_id UUID := gen_random_uuid(); -- TestUser2
BEGIN
  -- Get the active jackpot game
  SELECT id INTO v_game_id FROM jackpot_games WHERE status = 'active' LIMIT 1;
  
  -- If no active game, create one
  IF v_game_id IS NULL THEN
    INSERT INTO jackpot_games (ticket_price, total_pool, status)
    VALUES (1.00, 0.00, 'active')
    RETURNING id INTO v_game_id;
    
    RAISE NOTICE '🎰 NEW JACKPOT GAME CREATED!';
    RAISE NOTICE 'Game ID: %', v_game_id;
  ELSE
    RAISE NOTICE '🎰 USING EXISTING JACKPOT GAME';
    RAISE NOTICE 'Game ID: %', v_game_id;
  END IF;
  
  -- Create test user profiles if they don't exist
  INSERT INTO profiles (user_id, username, balance) 
  VALUES 
    (v_user4_id, 'TestWhale', 500.00),
    (v_user5_id, 'TestGambler', 200.00)
  ON CONFLICT (user_id) DO NOTHING;
  
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '🎫 JACKPOT TEST: 5 USERS BUYING TICKETS';
  RAISE NOTICE '═══════════════════════════════════════';
  
  -- User 1: Ddenbror buys 3 tickets ($3)
  PERFORM public.buy_jackpot_tickets(v_game_id, v_user1_id, 'Ddenbror', 3, 1.00);
  RAISE NOTICE '👤 Ddenbror bought 3 tickets ($3)';
  
  -- User 2: Ddenbror97 buys 1 ticket ($1)  
  PERFORM public.buy_jackpot_tickets(v_game_id, v_user2_id, 'Ddenbror97', 1, 1.00);
  RAISE NOTICE '👤 Ddenbror97 bought 1 ticket ($1)';
  
  -- User 3: Vitoria.gata buys 2 tickets ($2)
  PERFORM public.buy_jackpot_tickets(v_game_id, v_user3_id, 'Vitoria.gata', 2, 1.00);
  RAISE NOTICE '👤 Vitoria.gata bought 2 tickets ($2)';
  
  -- User 4: TestWhale buys 10 tickets ($10) - big spender!
  PERFORM public.buy_jackpot_tickets(v_game_id, v_user4_id, 'TestWhale', 10, 1.00);
  RAISE NOTICE '👤 TestWhale bought 10 tickets ($10) 🐋';
  
  -- User 5: TestGambler buys 4 tickets ($4)
  PERFORM public.buy_jackpot_tickets(v_game_id, v_user5_id, 'TestGambler', 4, 1.00);
  RAISE NOTICE '👤 TestGambler bought 4 tickets ($4)';
  
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '📊 JACKPOT SUMMARY:';
  RAISE NOTICE 'Total Tickets: 20 (3+1+2+10+4)';
  RAISE NOTICE 'Total Pool: $20';
  RAISE NOTICE 'Players: 5';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 WINNING CHANCES:';
  RAISE NOTICE 'Ddenbror: 3/20 = 15%% chance';
  RAISE NOTICE 'Ddenbror97: 1/20 = 5%% chance';  
  RAISE NOTICE 'Vitoria.gata: 2/20 = 10%% chance';
  RAISE NOTICE 'TestWhale: 10/20 = 50%% chance 🐋';
  RAISE NOTICE 'TestGambler: 4/20 = 20%% chance';
  RAISE NOTICE '═══════════════════════════════════════';
  
END $$;