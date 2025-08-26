-- Manually complete the expired jackpot game and create a new one
-- First, mark the current game as completed with a winner
UPDATE public.jackpot_games 
SET 
  status = 'completed',
  winner_id = (SELECT user_id FROM public.jackpot_tickets WHERE game_id = 'fac40194-472f-478b-83df-4b36e1c6a753' ORDER BY RANDOM() LIMIT 1),
  winner_name = (SELECT username FROM public.jackpot_tickets WHERE game_id = 'fac40194-472f-478b-83df-4b36e1c6a753' ORDER BY RANDOM() LIMIT 1),
  completed_at = now()
WHERE id = 'fac40194-472f-478b-83df-4b36e1c6a753';

-- Create a new active jackpot game with reset pool
INSERT INTO public.jackpot_games (ticket_price, total_pool, status)
VALUES (1.00, 0.00, 'active');