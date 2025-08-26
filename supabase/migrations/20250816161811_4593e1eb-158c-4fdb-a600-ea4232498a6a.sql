-- Complete expired active games and let the system create a new one naturally
UPDATE public.jackpot_games
SET 
    status = 'completed',
    completed_at = NOW(),
    winner_name = 'Timer Expired - Debug Reset'
WHERE status = 'active' 
  AND timer_end_at IS NOT NULL 
  AND timer_end_at < NOW();