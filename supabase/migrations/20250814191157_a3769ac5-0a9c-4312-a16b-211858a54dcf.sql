-- Clear the expired timer
UPDATE public.jackpot_games 
SET timer_end_at = NULL
WHERE status = 'active';