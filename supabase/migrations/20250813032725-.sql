-- Update RLS policies for jackpot_tickets to allow viewing all participants in active games
DROP POLICY IF EXISTS "Users can view their own jackpot tickets" ON public.jackpot_tickets;

-- Create new policy to allow viewing all tickets in active jackpot games
CREATE POLICY "Users can view all tickets in active games" ON public.jackpot_tickets
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.jackpot_games 
    WHERE id = game_id AND status = 'active'
  )
);

-- Keep the insert policy for users to add their own tickets
-- (This policy already exists and is correct)