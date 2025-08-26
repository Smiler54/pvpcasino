-- Just complete the expired active game, the constraint will allow a new one to be created later
UPDATE public.jackpot_games
SET 
    status = 'completed',
    completed_at = NOW(),
    winner_name = 'Timer Expired - Debug Reset'
WHERE status = 'active' 
  AND timer_end_at IS NOT NULL 
  AND timer_end_at < NOW();