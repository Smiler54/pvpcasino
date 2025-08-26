-- Security Fix: Restrict jackpot ticket visibility to protect user privacy
-- Users should only see their own tickets, not other players' financial data

DROP POLICY IF EXISTS "Users can view all tickets in active games" ON public.jackpot_tickets;

-- New policy: Users can only view their own tickets
CREATE POLICY "Users can view their own tickets" 
ON public.jackpot_tickets 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow viewing aggregate data only (for game statistics)
-- This will be handled by the database function get_jackpot_aggregate_data

-- Security Fix: Enhance chat privacy controls
-- Current policy allows all authenticated users to read all messages
-- Add room-based privacy controls

DROP POLICY IF EXISTS "Authenticated users can read chat messages" ON public.chat_messages;

-- New policy: Users can read messages in public rooms they have access to
-- For now, keeping global room public but preparing for future room-based controls
CREATE POLICY "Users can read chat messages in accessible rooms" 
ON public.chat_messages 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  (
    room = 'global' OR  -- Global room accessible to all authenticated users
    room = 'jackpot'    -- Jackpot room accessible to all authenticated users
  )
);

-- Security Enhancement: Add function to get user's own jackpot tickets only
CREATE OR REPLACE FUNCTION public.get_user_jackpot_tickets(p_game_id uuid, p_user_id uuid)
RETURNS TABLE(
  tickets_bought integer,
  amount_paid numeric,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Verify the requesting user matches the user_id parameter
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Can only view your own tickets';
  END IF;

  RETURN QUERY
  SELECT 
    jt.tickets_bought,
    jt.amount_paid,
    jt.created_at
  FROM public.jackpot_tickets jt
  WHERE jt.game_id = p_game_id 
  AND jt.user_id = p_user_id;
END;
$function$;