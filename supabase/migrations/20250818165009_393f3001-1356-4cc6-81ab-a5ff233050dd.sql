-- Create chat_messages table for live chat
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for chat messages
CREATE POLICY "Anyone can view chat messages" 
ON public.chat_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can send messages" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add trigger to validate messages
CREATE TRIGGER validate_chat_message_trigger
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_chat_message_enhanced();