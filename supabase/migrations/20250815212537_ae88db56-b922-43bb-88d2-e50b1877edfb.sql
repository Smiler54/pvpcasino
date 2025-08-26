-- Clean up bugged active coinflip games
-- Update stuck 'flipping' games to 'cancelled' status
UPDATE public.coinflip_games 
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE status IN ('flipping', 'waiting')
  AND created_at < NOW() - INTERVAL '5 minutes';

-- Also clean up any games that have been in 'waiting' status for more than 1 hour
UPDATE public.coinflip_games 
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE status = 'waiting'
  AND created_at < NOW() - INTERVAL '1 hour';