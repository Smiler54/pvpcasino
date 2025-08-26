-- Clean up coinflip games and related data
-- Delete all coinflip game records
DELETE FROM public.coinflip_games;

-- Delete related transactions (coinflip bets and wins)
DELETE FROM public.transactions 
WHERE type IN ('coinflip_bet', 'coinflip_win', 'coinflip_payout');

-- Reset any user balances that might have been affected (optional - gives everyone a fresh $100 balance)
UPDATE public.profiles SET balance = 100.00;