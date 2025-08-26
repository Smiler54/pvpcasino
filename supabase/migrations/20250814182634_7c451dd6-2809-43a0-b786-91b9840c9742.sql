-- Create coinflip_games table for shared game storage
CREATE TABLE IF NOT EXISTS public.coinflip_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  creator_username TEXT NOT NULL,
  creator_choice TEXT NOT NULL CHECK (creator_choice IN ('heads', 'tails')),
  joiner_id UUID,
  joiner_username TEXT,
  joiner_choice TEXT CHECK (joiner_choice IN ('heads', 'tails')),
  bet_amount NUMERIC NOT NULL DEFAULT 1.00,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'flipping', 'completed')),
  result TEXT CHECK (result IN ('heads', 'tails')),
  winner_id UUID,
  winner_username TEXT,
  server_seed TEXT,
  server_seed_hash TEXT,
  client_seed TEXT,
  hmac_result TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.coinflip_games ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all games
CREATE POLICY "Users can view all coinflip games" 
ON public.coinflip_games 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Users can create games
CREATE POLICY "Users can create coinflip games" 
ON public.coinflip_games 
FOR INSERT 
WITH CHECK (auth.uid() = creator_id);

-- Players can update games they're part of
CREATE POLICY "Players can update their coinflip games" 
ON public.coinflip_games 
FOR UPDATE 
USING (auth.uid() = creator_id OR auth.uid() = joiner_id);

-- Add index for performance
CREATE INDEX idx_coinflip_games_status ON public.coinflip_games(status);
CREATE INDEX idx_coinflip_games_created_at ON public.coinflip_games(created_at DESC);