-- Fix security warning: Set search_path for the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clean up old completed games (keep last 7 days)
  DELETE FROM public.coinflip_games 
  WHERE status = 'completed' 
  AND completed_at < NOW() - INTERVAL '7 days';
  
  DELETE FROM public.jackpot_games 
  WHERE status = 'completed' 
  AND completed_at < NOW() - INTERVAL '7 days';
  
  -- Clean up old audit logs (keep last 30 days)
  DELETE FROM public.admin_audit_log 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Clean up orphaned tickets
  DELETE FROM public.jackpot_tickets 
  WHERE game_id NOT IN (SELECT id FROM public.jackpot_games);
END;
$$;