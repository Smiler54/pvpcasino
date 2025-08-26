-- Create the missing update_user_balance function
CREATE OR REPLACE FUNCTION public.update_user_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_description TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update user balance
  UPDATE public.profiles
  SET balance = balance + p_amount
  WHERE user_id = p_user_id;
  
  -- Log transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, p_transaction_type, p_amount, p_description);
END;
$$;