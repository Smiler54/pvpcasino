-- Create tables for coinflip game offers and matches
CREATE TABLE public.game_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  maker_name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  side TEXT NOT NULL CHECK (side IN ('heads', 'tails')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.game_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.game_offers(id) ON DELETE CASCADE,
  maker_id UUID NOT NULL,
  taker_id UUID NOT NULL,
  maker_name TEXT NOT NULL,
  taker_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  client_seed TEXT NOT NULL,
  server_seed TEXT,
  salt TEXT,
  result_side TEXT CHECK (result_side IN ('heads', 'tails')),
  winner_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.game_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_offers
CREATE POLICY "Anyone can view open offers" 
ON public.game_offers 
FOR SELECT 
USING (status = 'open');

CREATE POLICY "Users can create their own offers" 
ON public.game_offers 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own offers" 
ON public.game_offers 
FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for game_matches
CREATE POLICY "Users can view their own matches" 
ON public.game_matches 
FOR SELECT 
USING (auth.uid() = maker_id OR auth.uid() = taker_id);

CREATE POLICY "System can create matches" 
ON public.game_matches 
FOR INSERT 
WITH CHECK (auth.uid() = taker_id);

CREATE POLICY "System can update matches" 
ON public.game_matches 
FOR UPDATE 
USING (auth.uid() = maker_id OR auth.uid() = taker_id);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_game_offers_updated_at
BEFORE UPDATE ON public.game_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for these tables
ALTER TABLE public.game_offers REPLICA IDENTITY FULL;
ALTER TABLE public.game_matches REPLICA IDENTITY FULL;