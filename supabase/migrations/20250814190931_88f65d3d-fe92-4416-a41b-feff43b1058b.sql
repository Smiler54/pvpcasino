-- Reset current jackpot game
-- First, mark the current active game as completed (reset)
UPDATE public.jackpot_games 
SET status = 'completed', 
    completed_at = NOW(),
    winner_name = 'System Reset',
    timer_end_at = NULL
WHERE status = 'active';

-- Delete any tickets from the current game to clean up
DELETE FROM public.jackpot_tickets 
WHERE game_id IN (
  SELECT id FROM public.jackpot_games 
  WHERE winner_name = 'System Reset' 
  AND completed_at > NOW() - INTERVAL '1 minute'
);

-- Create a fresh new active jackpot game
INSERT INTO public.jackpot_games (ticket_price, total_pool, status)
VALUES (1.00, 0.00, 'active');