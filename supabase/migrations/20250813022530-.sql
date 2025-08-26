-- Update RLS policy to require authentication for viewing game offers
DROP POLICY "Anyone can view open offers" ON public.game_offers;

CREATE POLICY "Authenticated users can view open offers" 
ON public.game_offers 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND status = 'open');

-- Add additional validation constraints for withdrawals
ALTER TABLE public.withdrawals 
ADD CONSTRAINT check_withdrawal_amount_positive CHECK (amount > 0),
ADD CONSTRAINT check_withdrawal_minimum CHECK (amount >= 10);

-- Add rate limiting for withdrawals (max 3 per day per user)
CREATE OR REPLACE FUNCTION public.check_withdrawal_rate_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.withdrawals
  WHERE user_id = p_user_id 
    AND requested_at > NOW() - INTERVAL '24 hours'
    AND status != 'cancelled';
  
  RETURN v_count < 3;
END;
$$;

-- Update withdrawal request function with enhanced validation
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_user_id uuid, p_amount numeric, p_method text, p_details jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_balance NUMERIC;
  v_withdrawal_id UUID;
  v_result JSON;
BEGIN
  -- Check rate limit
  IF NOT public.check_withdrawal_rate_limit(p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Daily withdrawal limit exceeded (3 per day)');
  END IF;

  -- Validate amount constraints
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid withdrawal amount');
  END IF;
  
  IF p_amount < 10 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum withdrawal amount is $10');
  END IF;
  
  IF p_amount > 10000 THEN
    RETURN json_build_object('success', false, 'error', 'Maximum withdrawal amount is $10,000');
  END IF;

  -- Validate withdrawal method
  IF p_method NOT IN ('paypal', 'bank_transfer', 'crypto') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid withdrawal method');
  END IF;

  -- Validate method-specific details
  IF p_method = 'paypal' AND (p_details->>'email' IS NULL OR p_details->>'email' = '') THEN
    RETURN json_build_object('success', false, 'error', 'PayPal email is required');
  END IF;
  
  IF p_method = 'bank_transfer' AND (
    p_details->>'account_number' IS NULL OR p_details->>'account_number' = '' OR
    p_details->>'routing_number' IS NULL OR p_details->>'routing_number' = '' OR
    p_details->>'account_holder' IS NULL OR p_details->>'account_holder' = ''
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Complete bank transfer details are required');
  END IF;
  
  IF p_method = 'crypto' AND (
    p_details->>'wallet_address' IS NULL OR p_details->>'wallet_address' = '' OR
    p_details->>'currency' IS NULL OR p_details->>'currency' = ''
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Crypto wallet address and currency are required');
  END IF;

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
  VALUES (p_user_id, 'withdrawal_request', -p_amount, 'Withdrawal request: $' || p_amount || ' via ' || p_method);
  
  RETURN json_build_object(
    'success', true, 
    'withdrawal_id', v_withdrawal_id,
    'amount', p_amount,
    'message', 'Withdrawal request submitted successfully'
  );
END;
$$;