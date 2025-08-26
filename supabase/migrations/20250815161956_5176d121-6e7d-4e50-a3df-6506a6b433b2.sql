-- Fix the current active jackpot game to have proper 60-second timer
UPDATE jackpot_games 
SET timer_end_at = NOW() + INTERVAL '60 seconds'
WHERE status = 'active' 
  AND timer_end_at IS NULL
  AND id = '2b9342bb-d36b-4816-af64-c45bab3fc5ad';