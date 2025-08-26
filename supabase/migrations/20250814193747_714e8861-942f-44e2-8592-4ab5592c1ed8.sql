-- Fix timer update issue: Reset expired timer and ensure timer_end_at is properly updated

-- Clear all expired timers
UPDATE public.jackpot_games 
SET timer_end_at = NULL
WHERE status = 'active' AND timer_end_at IS NOT NULL AND timer_end_at < NOW();

-- For any active games without tickets, also clear their timers
UPDATE public.jackpot_games 
SET timer_end_at = NULL
WHERE status = 'active' 
AND id NOT IN (
  SELECT DISTINCT game_id 
  FROM public.jackpot_tickets
);