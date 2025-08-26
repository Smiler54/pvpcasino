-- Fix the UPDATE policy to allow users to join waiting games
DROP POLICY IF EXISTS "coinflip_players_update_games" ON coinflip_games;

-- Create a policy that allows:
-- 1. Players already in the game to update it
-- 2. Any authenticated user to update a waiting game (to join it)
CREATE POLICY "coinflip_players_update_games" 
ON coinflip_games 
FOR UPDATE 
USING (
  -- Allow if user is already a player in the game
  (auth.uid() = player1_id OR auth.uid() = player2_id)
  OR
  -- Allow if game is waiting and user is authenticated (for joining)
  (status = 'waiting' AND auth.uid() IS NOT NULL)
);