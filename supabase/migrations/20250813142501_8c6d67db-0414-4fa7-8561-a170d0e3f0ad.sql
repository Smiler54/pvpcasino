-- Fix critical RLS policy on profiles table to prevent financial data exposure
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;

-- Create restrictive policy for users to view their own complete profile
CREATE POLICY "Users can view their own complete profile" ON public.profiles
FOR SELECT 
USING (auth.uid() = user_id);

-- Create a secure view for public profile data (non-sensitive only)
CREATE OR REPLACE VIEW public.public_profiles_secure AS
SELECT 
  user_id,
  username,
  level,
  experience,
  created_at,
  updated_at
FROM public.profiles;

-- Enable RLS on the view
ALTER VIEW public.public_profiles_secure SET (security_invoker = true);

-- Grant access to the secure view
GRANT SELECT ON public.public_profiles_secure TO authenticated;

-- Add enhanced validation for financial transactions
CREATE OR REPLACE FUNCTION public.validate_financial_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hourly_count INTEGER;
  v_daily_amount NUMERIC;
BEGIN
  -- Prevent excessively large transactions
  IF ABS(NEW.amount) > 10000 THEN
    RAISE EXCEPTION 'Transaction amount exceeds maximum allowed: %', NEW.amount;
  END IF;
  
  -- Check for suspicious rapid transactions
  SELECT COUNT(*) INTO v_hourly_count
  FROM public.transactions
  WHERE user_id = NEW.user_id 
    AND created_at > NOW() - INTERVAL '1 hour'
    AND ABS(amount) > 50;
    
  IF v_hourly_count >= 10 THEN
    RAISE EXCEPTION 'Too many large transactions in the past hour. Please try again later.';
  END IF;
  
  -- Check daily transaction volume
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_daily_amount
  FROM public.transactions
  WHERE user_id = NEW.user_id 
    AND created_at > CURRENT_DATE
    AND type IN ('credit_purchase', 'withdrawal_request');
    
  IF v_daily_amount + ABS(NEW.amount) > 5000 THEN
    RAISE EXCEPTION 'Daily transaction limit exceeded. Maximum $5000 per day.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger for transaction validation
DROP TRIGGER IF EXISTS validate_financial_transaction_trigger ON public.transactions;
CREATE TRIGGER validate_financial_transaction_trigger
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_financial_transaction();

-- Enhanced chat message validation
CREATE OR REPLACE FUNCTION public.validate_chat_message_enhanced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_message_count INTEGER;
BEGIN
  -- Sanitize the message content more thoroughly
  NEW.message := public.sanitize_text_input(NEW.message);
  
  -- Check if message is not empty after sanitization
  IF NEW.message IS NULL OR trim(NEW.message) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  
  -- Prevent messages longer than 500 characters
  IF length(NEW.message) > 500 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;
  
  -- Rate limiting: max 5 messages per minute
  SELECT COUNT(*) INTO v_message_count
  FROM public.chat_messages
  WHERE user_id = NEW.user_id 
    AND created_at > NOW() - INTERVAL '1 minute';
    
  IF v_message_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 5 messages per minute.';
  END IF;
  
  -- Check for spam patterns
  IF EXISTS (
    SELECT 1 FROM public.chat_messages
    WHERE user_id = NEW.user_id 
      AND created_at > NOW() - INTERVAL '30 seconds'
      AND message = NEW.message
  ) THEN
    RAISE EXCEPTION 'Duplicate message detected. Please wait before sending the same message.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Replace the existing trigger
DROP TRIGGER IF EXISTS validate_chat_message_trigger ON public.chat_messages;
CREATE TRIGGER validate_chat_message_enhanced_trigger
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_chat_message_enhanced();

-- Create security audit function
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_user_id UUID,
  p_details JSONB DEFAULT NULL,
  p_severity TEXT DEFAULT 'info'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_user_id,
    action,
    details
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    p_user_id,
    p_event_type,
    jsonb_build_object(
      'severity', p_severity,
      'timestamp', NOW(),
      'details', p_details,
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    )
  );
END;
$$;