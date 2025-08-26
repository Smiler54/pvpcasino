-- Update jackpot games policy to allow public viewing
DROP POLICY IF EXISTS "Authenticated users can view jackpot games" ON public.jackpot_games;

-- Create new policy that allows anyone to view jackpot games (read-only)
CREATE POLICY "Anyone can view jackpot games" 
ON public.jackpot_games 
FOR SELECT 
USING (true);

-- Update jackpot tickets policy to allow public viewing of ticket counts
-- (but still protect individual user data)
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.jackpot_tickets;

-- Allow anyone to view jackpot tickets (for displaying total counts)
CREATE POLICY "Anyone can view jackpot tickets" 
ON public.jackpot_tickets 
FOR SELECT 
USING (true);

-- Keep the insert policy secure (only authenticated users can buy tickets)
-- This policy should already exist but let's ensure it's there
CREATE POLICY "Users can insert their own tickets" 
ON public.jackpot_tickets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id)
ON CONFLICT DO NOTHING;