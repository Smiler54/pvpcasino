-- Add RLS policies to public_profiles table to restrict data exposure
ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view public profiles (restricted data)
CREATE POLICY "Authenticated users can view public profiles" 
ON public_profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Only allow service role to insert/update public profiles (via trigger)
CREATE POLICY "Service role can manage public profiles" 
ON public_profiles 
FOR ALL 
TO service_role
USING (true);

-- Add security indexes for better performance on security-related queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_user_id_balance ON public.profiles(user_id, balance);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_id_amount ON public.transactions(user_id, amount) WHERE ABS(amount) > 100;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_user_id_status ON public.withdrawals(user_id, status, requested_at);

-- Add function to sanitize text input
CREATE OR REPLACE FUNCTION public.sanitize_text_input(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove HTML tags and script content
  input_text := regexp_replace(input_text, '<[^>]*>', '', 'g');
  
  -- Remove potentially dangerous characters
  input_text := regexp_replace(input_text, '[<>&"''`]', '', 'g');
  
  -- Trim whitespace and limit length
  input_text := trim(substring(input_text from 1 for 1000));
  
  RETURN input_text;
END;
$$;