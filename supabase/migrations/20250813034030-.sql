-- Fix transaction type constraint to allow jackpot_win
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add updated constraint with jackpot_win included
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('purchase', 'withdrawal', 'withdrawal_request', 'jackpot_tickets', 'jackpot_win', 'level_reward'));