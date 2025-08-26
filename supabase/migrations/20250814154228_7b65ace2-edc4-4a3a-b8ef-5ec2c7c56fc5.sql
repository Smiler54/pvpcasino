-- Create coinflip games table for multiplayer matches
CREATE TABLE public.coinflip_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player1_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  player1_username TEXT NOT NULL,
  player1_choice TEXT CHECK (player1_choice IN ('heads', 'tails')),
  player2_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  player2_username TEXT,
  player2_choice TEXT CHECK (player2_choice IN ('heads', 'tails')),
  bet_amount NUMERIC NOT NULL DEFAULT 1.00,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'flipping', 'completed', 'cancelled')),
  result TEXT CHECK (result IN ('heads', 'tails')),
  winner_id UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.coinflip_games ENABLE ROW LEVEL SECURITY;

-- Create policies for coinflip games
CREATE POLICY "Users can view games they participate in" 
ON public.coinflip_games 
FOR SELECT 
USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Users can create new games" 
ON public.coinflip_games 
FOR INSERT 
WITH CHECK (auth.uid() = player1_id);

CREATE POLICY "Players can update their own games" 
ON public.coinflip_games 
FOR UPDATE 
USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Create policy for viewing available games (waiting status)
CREATE POLICY "Users can view waiting games" 
ON public.coinflip_games 
FOR SELECT 
USING (status = 'waiting');

-- Create updated_at trigger
CREATE TRIGGER update_coinflip_games_updated_at
BEFORE UPDATE ON public.coinflip_games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add realtime functionality
ALTER PUBLICATION supabase_realtime ADD TABLE public.coinflip_games;

-- Create index for better performance
CREATE INDEX idx_coinflip_games_status ON public.coinflip_games(status);
CREATE INDEX idx_coinflip_games_players ON public.coinflip_games(player1_id, player2_id);