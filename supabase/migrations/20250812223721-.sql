-- Update existing active jackpot games to have $1 ticket price
UPDATE public.jackpot_games 
SET ticket_price = 1.00 
WHERE status = 'active';

-- Update the default ticket price for future games
ALTER TABLE public.jackpot_games 
ALTER COLUMN ticket_price SET DEFAULT 1.00;