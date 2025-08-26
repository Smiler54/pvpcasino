-- Reset timer for the current active game that has an expired timer
UPDATE public.jackpot_games 
SET timer_end_at = NOW() + INTERVAL '60 seconds'
WHERE id = '71301dd1-97a8-447c-81be-8449abaf5fc9' 
AND status = 'active';