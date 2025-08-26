-- Fix any existing active games that don't have proper timers
UPDATE public.jackpot_games 
SET timer_end_at = NOW() + INTERVAL '60 seconds'
WHERE status = 'active' 
  AND (timer_end_at IS NULL OR timer_end_at <= NOW())
  AND EXISTS (SELECT 1 FROM public.jackpot_tickets WHERE game_id = jackpot_games.id);

-- For active games with no tickets, reset the timer to null
UPDATE public.jackpot_games 
SET timer_end_at = NULL
WHERE status = 'active' 
  AND NOT EXISTS (SELECT 1 FROM public.jackpot_tickets WHERE game_id = jackpot_games.id);