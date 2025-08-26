-- Create jackpot games table
CREATE TABLE public.jackpot_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_price NUMERIC NOT NULL DEFAULT 1.00,
  total_pool NUMERIC NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  winner_id UUID,
  winner_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create jackpot tickets table
CREATE TABLE public.jackpot_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.jackpot_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  tickets_bought INTEGER NOT NULL DEFAULT 1,
  amount_paid NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jackpot_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jackpot_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jackpot_games
CREATE POLICY "Anyone can view active jackpot games" 
ON public.jackpot_games 
FOR SELECT 
USING (true);

CREATE POLICY "System can insert/update jackpot games" 
ON public.jackpot_games 
FOR ALL 
USING (true);

-- RLS Policies for jackpot_tickets
CREATE POLICY "Anyone can view jackpot tickets" 
ON public.jackpot_tickets 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own tickets" 
ON public.jackpot_tickets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Function to buy jackpot tickets
CREATE OR REPLACE FUNCTION public.buy_jackpot_tickets(
  p_game_id UUID,
  p_user_id UUID,
  p_username TEXT,
  p_tickets INTEGER,
  p_ticket_price NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_cost NUMERIC;
  v_user_balance NUMERIC;
  v_result JSON;
BEGIN
  -- Calculate total cost
  v_total_cost := p_ticket_price * p_tickets;
  
  -- Check user balance
  SELECT balance INTO v_user_balance
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF v_user_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF v_user_balance < v_total_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Deduct from user balance
  UPDATE public.profiles
  SET balance = balance - v_total_cost
  WHERE user_id = p_user_id;
  
  -- Add to jackpot pool
  UPDATE public.jackpot_games
  SET total_pool = total_pool + v_total_cost
  WHERE id = p_game_id;
  
  -- Insert tickets
  INSERT INTO public.jackpot_tickets (game_id, user_id, username, tickets_bought, amount_paid)
  VALUES (p_game_id, p_user_id, p_username, p_tickets, v_total_cost);
  
  -- Insert transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'jackpot_tickets', -v_total_cost, 'Bought ' || p_tickets || ' jackpot tickets');
  
  RETURN json_build_object('success', true, 'tickets_bought', p_tickets, 'amount_paid', v_total_cost);
END;
$$;

-- Function to draw jackpot winner
CREATE OR REPLACE FUNCTION public.draw_jackpot_winner(p_game_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_tickets INTEGER;
  v_random_ticket INTEGER;
  v_winner_user_id UUID;
  v_winner_username TEXT;
  v_jackpot_amount NUMERIC;
  v_current_count INTEGER := 0;
  v_ticket_record RECORD;
BEGIN
  -- Get total tickets and jackpot amount
  SELECT 
    COALESCE(SUM(tickets_bought), 0),
    total_pool
  INTO v_total_tickets, v_jackpot_amount
  FROM public.jackpot_tickets t
  JOIN public.jackpot_games g ON g.id = t.game_id
  WHERE t.game_id = p_game_id
  GROUP BY g.total_pool;
  
  IF v_total_tickets = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No tickets sold');
  END IF;
  
  -- Generate random ticket number (1 to total_tickets)
  v_random_ticket := floor(random() * v_total_tickets) + 1;
  
  -- Find the winner by counting tickets
  FOR v_ticket_record IN 
    SELECT user_id, username, tickets_bought
    FROM public.jackpot_tickets
    WHERE game_id = p_game_id
    ORDER BY created_at
  LOOP
    v_current_count := v_current_count + v_ticket_record.tickets_bought;
    
    IF v_current_count >= v_random_ticket THEN
      v_winner_user_id := v_ticket_record.user_id;
      v_winner_username := v_ticket_record.username;
      EXIT;
    END IF;
  END LOOP;
  
  -- Update winner's balance
  UPDATE public.profiles
  SET balance = balance + v_jackpot_amount
  WHERE user_id = v_winner_user_id;
  
  -- Mark game as completed
  UPDATE public.jackpot_games
  SET 
    status = 'completed',
    winner_id = v_winner_user_id,
    winner_name = v_winner_username,
    completed_at = now()
  WHERE id = p_game_id;
  
  -- Insert winning transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_winner_user_id, 'jackpot_win', v_jackpot_amount, 'Won jackpot: $' || v_jackpot_amount);
  
  RETURN json_build_object(
    'success', true, 
    'winner_id', v_winner_user_id,
    'winner_name', v_winner_username,
    'jackpot_amount', v_jackpot_amount,
    'total_tickets', v_total_tickets
  );
END;
$$;

-- Create initial jackpot game
INSERT INTO public.jackpot_games (ticket_price, total_pool, status)
VALUES (2.00, 0.00, 'active');