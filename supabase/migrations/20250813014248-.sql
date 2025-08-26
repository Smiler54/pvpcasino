-- Create withdrawals table to track withdrawal requests
CREATE TABLE public.withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  withdrawal_method TEXT NOT NULL CHECK (withdrawal_method IN ('paypal', 'bank_transfer', 'crypto')),
  withdrawal_details JSONB NOT NULL, -- Store method-specific details like email, wallet address, etc.
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own withdrawals" 
ON public.withdrawals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create withdrawal requests" 
ON public.withdrawals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all withdrawals" 
ON public.withdrawals 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Create function to process withdrawal requests
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_details JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_balance NUMERIC;
  v_withdrawal_id UUID;
  v_result JSON;
BEGIN
  -- Check user balance
  SELECT balance INTO v_user_balance
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF v_user_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF v_user_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  IF p_amount < 10 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum withdrawal amount is $10');
  END IF;
  
  -- Create withdrawal request
  INSERT INTO public.withdrawals (user_id, amount, withdrawal_method, withdrawal_details)
  VALUES (p_user_id, p_amount, p_method, p_details)
  RETURNING id INTO v_withdrawal_id;
  
  -- Deduct from user balance (hold the funds)
  UPDATE public.profiles
  SET balance = balance - p_amount
  WHERE user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'withdrawal_request', -p_amount, 'Withdrawal request: $' || p_amount);
  
  RETURN json_build_object(
    'success', true, 
    'withdrawal_id', v_withdrawal_id,
    'amount', p_amount,
    'message', 'Withdrawal request submitted successfully'
  );
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_withdrawals_updated_at
BEFORE UPDATE ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();