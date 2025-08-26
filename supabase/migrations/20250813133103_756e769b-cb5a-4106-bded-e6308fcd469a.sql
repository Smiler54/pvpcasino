-- Clean up multiple active jackpot games - keep only the most recent one
UPDATE public.jackpot_games 
SET status = 'completed'
WHERE status = 'active' 
AND id NOT IN (
  SELECT id FROM public.jackpot_games 
  WHERE status = 'active' 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Add a unique constraint to prevent multiple active games in the future
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_jackpot_games_single_active
ON public.jackpot_games (status) 
WHERE status = 'active';