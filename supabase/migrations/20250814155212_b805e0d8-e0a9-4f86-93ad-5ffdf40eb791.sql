-- First, drop ALL existing policies and recreate them correctly
DROP POLICY IF EXISTS "Users can view their own games" ON coinflip_games;
DROP POLICY IF EXISTS "Users can view all waiting games for matchmaking" ON coinflip_games;
DROP POLICY IF EXISTS "Users can view completed games" ON coinflip_games;
DROP POLICY IF EXISTS "Users can view games they participate in" ON coinflip_games;
DROP POLICY IF EXISTS "Users can view waiting games" ON coinflip_games;
DROP POLICY IF EXISTS "Users can create new games" ON coinflip_games;
DROP POLICY IF EXISTS "Players can update their own games" ON coinflip_games;

-- Create comprehensive policies that allow proper matchmaking
-- Policy 1: Users can view games they are participating in (own games)
CREATE POLICY "coinflip_users_view_own_games" 
ON coinflip_games 
FOR SELECT 
USING ((auth.uid() = player1_id) OR (auth.uid() = player2_id));

-- Policy 2: Users can view all waiting games for matchmaking (everyone can see open games)
CREATE POLICY "coinflip_users_view_waiting_games" 
ON coinflip_games 
FOR SELECT 
USING (status = 'waiting' AND auth.uid() IS NOT NULL);

-- Policy 3: Users can view completed games for history/stats (everyone can see completed games)
CREATE POLICY "coinflip_users_view_completed_games" 
ON coinflip_games 
FOR SELECT 
USING (status = 'completed' AND auth.uid() IS NOT NULL);

-- Recreate existing policies for other operations
CREATE POLICY "coinflip_users_create_games" 
ON coinflip_games 
FOR INSERT 
WITH CHECK (auth.uid() = player1_id);

CREATE POLICY "coinflip_players_update_games" 
ON coinflip_games 
FOR UPDATE 
USING ((auth.uid() = player1_id) OR (auth.uid() = player2_id));