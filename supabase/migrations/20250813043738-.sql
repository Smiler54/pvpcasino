-- Fix the pool discrepancy by updating it to match actual tickets sold
UPDATE public.jackpot_games 
SET total_pool = (
  SELECT COALESCE(SUM(t.amount_paid), 0)
  FROM public.jackpot_tickets t 
  WHERE t.game_id = jackpot_games.id
)
WHERE status = 'active';