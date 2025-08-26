-- CRITICAL SECURITY FIXES

-- 1. Fix jackpot_games RLS policies - Remove dangerous "ALL operations" policy
DROP POLICY IF EXISTS "System can insert/update jackpot games" ON public.jackpot_games;

-- Create secure admin-only policies for jackpot games
CREATE POLICY "Admins can manage jackpot games" 
ON public.jackpot_games 
FOR INSERT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update jackpot games" 
ON public.jackpot_games 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete jackpot games" 
ON public.jackpot_games 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Fix transactions RLS - Replace dangerous "System can insert" policy
DROP POLICY IF EXISTS "System can insert transactions" ON public.transactions;

-- Create secure service-role-only policy for transactions
CREATE POLICY "Service role can insert transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- 3. Fix chat privacy - Replace "Anyone can read" with authenticated users only
DROP POLICY IF EXISTS "Anyone can read chat messages" ON public.chat_messages;

CREATE POLICY "Authenticated users can read chat messages" 
ON public.chat_messages 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 4. Fix database function security - Add proper search_path to vulnerable functions
CREATE OR REPLACE FUNCTION public.get_jackpot_aggregate_data(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_tickets', COALESCE(SUM(tickets_bought), 0),
    'total_players', COUNT(DISTINCT user_id),
    'total_pool', (SELECT total_pool FROM public.jackpot_games WHERE id = p_game_id)
  )
  INTO v_result
  FROM public.jackpot_tickets
  WHERE game_id = p_game_id;
  
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.make_user_admin(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Update user balance to very high amount (effectively unlimited)
  UPDATE public.profiles 
  SET balance = 99999999.99
  WHERE user_id = p_user_id;
  
  -- Assign admin role (insert if not exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Also assign default user role if needed
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  SELECT json_build_object(
    'success', true,
    'user_id', p_user_id,
    'message', 'User has been granted admin role and unlimited credits'
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;