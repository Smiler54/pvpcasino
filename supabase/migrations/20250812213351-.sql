-- Add balance column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN balance DECIMAL(10,2) DEFAULT 0.00;

-- Create transactions table to track credit purchases and bets
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit_purchase', 'bet_placed', 'bet_won', 'bet_lost')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  stripe_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for transactions
CREATE POLICY "Users can view their own transactions" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (true);

-- Create function to update user balance
CREATE OR REPLACE FUNCTION public.update_user_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_stripe_session_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert transaction record
  INSERT INTO public.transactions (user_id, type, amount, description, stripe_session_id)
  VALUES (p_user_id, p_transaction_type, p_amount, p_description, p_stripe_session_id);
  
  -- Update user balance
  UPDATE public.profiles 
  SET balance = balance + p_amount
  WHERE user_id = p_user_id;
END;
$$;