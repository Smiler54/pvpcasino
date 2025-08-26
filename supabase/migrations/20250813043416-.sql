-- Cancel all open coinflip offers
UPDATE public.game_offers 
SET status = 'cancelled', updated_at = now()
WHERE status = 'open';