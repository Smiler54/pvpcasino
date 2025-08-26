-- Create withdrawals table to track withdrawal requests and status
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  withdrawal_method TEXT NOT NULL DEFAULT 'bank_transfer',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  stripe_transfer_id TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row-Level Security
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Create policies for withdrawals
CREATE POLICY "Users can view their own withdrawals" 
ON public.withdrawals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own withdrawal requests" 
ON public.withdrawals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all withdrawals" 
ON public.withdrawals 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function for get_my_withdrawals RPC
CREATE OR REPLACE FUNCTION public.get_my_withdrawals()
RETURNS TABLE(
  id uuid, 
  amount numeric, 
  withdrawal_method text, 
  status text, 
  requested_at timestamp with time zone, 
  processed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Return only the user's own withdrawals, excluding sensitive details
  RETURN QUERY
  SELECT 
    w.id,
    w.amount,
    w.withdrawal_method,
    w.status,
    w.requested_at,
    w.processed_at
  FROM public.withdrawals w
  WHERE w.user_id = auth.uid()
  ORDER BY w.requested_at DESC;
END;
$function$;

-- Create trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_withdrawal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_withdrawals_updated_at
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_withdrawal_updated_at();