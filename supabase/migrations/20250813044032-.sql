-- Manually start the timer for the current game since there are players
UPDATE public.jackpot_games 
SET timer_end_at = NOW() + INTERVAL '30 seconds'
WHERE status = 'active' AND timer_end_at IS NULL;