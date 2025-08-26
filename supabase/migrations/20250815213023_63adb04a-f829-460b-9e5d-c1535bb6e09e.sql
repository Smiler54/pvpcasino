-- Clean up unused database features for better performance (simplified)

-- Remove chat functionality (not used in current website)
DROP TABLE IF EXISTS public.chat_messages CASCADE;

-- Remove level rewards system (not implemented in current website)
DROP TABLE IF EXISTS public.level_rewards CASCADE;

-- Remove withdrawals system (not used in current website)
DROP TABLE IF EXISTS public.withdrawals CASCADE;

-- Clean up old audit logs older than 30 days to reduce database size
DELETE FROM public.admin_audit_log 
WHERE created_at < NOW() - INTERVAL '30 days';

-- Clean up old completed games older than 7 days to reduce database size
DELETE FROM public.coinflip_games 
WHERE status = 'completed' 
AND completed_at < NOW() - INTERVAL '7 days';

-- Clean up old jackpot games older than 7 days
DELETE FROM public.jackpot_games 
WHERE status = 'completed' 
AND completed_at < NOW() - INTERVAL '7 days';

-- Clean up orphaned jackpot tickets (for games that no longer exist)
DELETE FROM public.jackpot_tickets 
WHERE game_id NOT IN (SELECT id FROM public.jackpot_games);

-- Clean up old transactions older than 30 days (keep recent for audit)
DELETE FROM public.transactions 
WHERE created_at < NOW() - INTERVAL '30 days'
AND type NOT IN ('credit_purchase', 'withdrawal_request');

-- Add indexes for better performance on frequently queried tables
CREATE INDEX IF NOT EXISTS idx_coinflip_games_status_created 
ON public.coinflip_games(status, created_at);

CREATE INDEX IF NOT EXISTS idx_jackpot_games_status_timer 
ON public.jackpot_games(status, timer_end_at);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
ON public.transactions(user_id, created_at);

-- Create cleanup function for future automated maintenance
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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