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

-- Add enhanced chat message validation
CREATE OR REPLACE FUNCTION public.validate_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Sanitize the message content
  NEW.message := public.sanitize_text_input(NEW.message);
  
  -- Check if message is not empty after sanitization
  IF NEW.message IS NULL OR trim(NEW.message) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  
  -- Prevent messages longer than 500 characters
  IF length(NEW.message) > 500 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to validate chat messages
DROP TRIGGER IF EXISTS validate_chat_message_trigger ON public.chat_messages;
CREATE TRIGGER validate_chat_message_trigger
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_chat_message();