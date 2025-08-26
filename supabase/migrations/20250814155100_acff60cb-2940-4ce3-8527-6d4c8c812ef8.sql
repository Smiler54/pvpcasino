-- Fix RLS policies for coinflip games to allow proper matchmaking
-- Drop the conflicting policies and create new ones

DROP POLICY IF EXISTS "Users can view games they participate in" ON coinflip_games;
DROP POLICY IF EXISTS "Users can view waiting games" ON coinflip_games;

-- Allow users to view games they participate in OR completed games (for history)
CREATE POLICY "Users can view their own games" 
ON coinflip_games 
FOR SELECT 
USING ((auth.uid() = player1_id) OR (auth.uid() = player2_id));

-- Allow users to view all waiting games for matchmaking
CREATE POLICY "Users can view all waiting games for matchmaking" 
ON coinflip_games 
FOR SELECT 
USING (status = 'waiting' AND auth.uid() IS NOT NULL);

-- Allow users to view all completed games for history/stats
CREATE POLICY "Users can view completed games" 
ON coinflip_games 
FOR SELECT 
USING (status = 'completed' AND auth.uid() IS NOT NULL);

-- Enable real-time updates for coinflip games
ALTER TABLE coinflip_games REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE coinflip_games;